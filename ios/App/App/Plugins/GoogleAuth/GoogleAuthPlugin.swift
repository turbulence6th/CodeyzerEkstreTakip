import Capacitor
import GoogleSignIn
import FirebaseCore
import FirebaseAuth

@objc(GoogleAuthPlugin)
public class GoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "GoogleAuthPlugin"
    public let jsName = "GoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "trySilentSignIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createCalendarEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "searchCalendarEvents", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "searchGmailMessages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getGmailMessageDetails", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getGmailAttachment", returnType: CAPPluginReturnPromise)
    ]

    private var currentUser: GIDGoogleUser?
    private var gmailHandler: GmailHandler?
    private var calendarHandler: CalendarHandler?

    private let scopes = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar.events"
    ]

    public override func load() {
        // Önceki oturumu restore et (Android'deki gibi)
        restorePreviousSession()
    }

    private func restorePreviousSession() {
        GIDSignIn.sharedInstance.restorePreviousSignIn { [weak self] user, error in
            if let user = user {
                print("[GoogleAuthPlugin] Previous session restored successfully")
                self?.currentUser = user
                self?.setupHandlers(user: user)
            } else {
                print("[GoogleAuthPlugin] No previous session to restore: \(error?.localizedDescription ?? "unknown")")
            }
        }
    }

    // MARK: - Authentication

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let presentingVC = self.bridge?.viewController else {
                call.reject("Configuration error")
                return
            }

            // Önce eski oturumu kapat
            GIDSignIn.sharedInstance.signOut()

            GIDSignIn.sharedInstance.signIn(
                withPresenting: presentingVC,
                hint: nil,
                additionalScopes: self.scopes
            ) { [weak self] result, error in
                if let error = error {
                    let nsError = error as NSError
                    if nsError.code == GIDSignInError.canceled.rawValue {
                        call.reject("User cancelled sign in", "SIGN_IN_CANCELLED")
                    } else {
                        call.reject(error.localizedDescription, "SIGN_IN_FAILED")
                    }
                    return
                }

                guard let user = result?.user else {
                    call.reject("No user returned", "NO_USER")
                    return
                }

                self?.handleSignInSuccess(user: user, call: call)
            }
        }
    }

    @objc func trySilentSignIn(_ call: CAPPluginCall) {
        GIDSignIn.sharedInstance.restorePreviousSignIn { [weak self] user, error in
            if let error = error {
                call.reject(error.localizedDescription, "SILENT_SIGN_IN_FAILED")
                return
            }

            guard let user = user else {
                call.reject("No previous sign-in", "NO_PREVIOUS_SIGN_IN")
                return
            }

            // Token'ları yenile
            user.refreshTokensIfNeeded { refreshedUser, error in
                if let error = error {
                    call.reject(error.localizedDescription, "TOKEN_REFRESH_FAILED")
                    return
                }

                guard let refreshedUser = refreshedUser else {
                    call.reject("Failed to refresh tokens", "TOKEN_REFRESH_FAILED")
                    return
                }

                self?.currentUser = refreshedUser
                self?.setupHandlers(user: refreshedUser)

                call.resolve(self?.userToDict(refreshedUser) ?? [:])
            }
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        GIDSignIn.sharedInstance.signOut()
        try? Auth.auth().signOut()
        currentUser = nil
        gmailHandler = nil
        calendarHandler = nil
        call.resolve()
    }

    // MARK: - Gmail Methods

    @objc func searchGmailMessages(_ call: CAPPluginCall) {
        guard let gmailHandler = gmailHandler else {
            call.reject("Not signed in", "NOT_SIGNED_IN")
            return
        }

        guard let query = call.getString("query") else {
            call.reject("Missing query parameter")
            return
        }

        gmailHandler.searchMessages(query: query) { result in
            switch result {
            case .success(let data):
                call.resolve(data)
            case .failure(let error):
                call.reject(error.localizedDescription, "GMAIL_SEARCH_FAILED")
            }
        }
    }

    @objc func getGmailMessageDetails(_ call: CAPPluginCall) {
        guard let gmailHandler = gmailHandler else {
            call.reject("Not signed in", "NOT_SIGNED_IN")
            return
        }

        guard let messageId = call.getString("messageId") else {
            call.reject("Missing messageId parameter")
            return
        }

        gmailHandler.getMessageDetails(messageId: messageId) { result in
            switch result {
            case .success(let data):
                call.resolve(data)
            case .failure(let error):
                call.reject(error.localizedDescription, "GMAIL_DETAILS_FAILED")
            }
        }
    }

    @objc func getGmailAttachment(_ call: CAPPluginCall) {
        guard let gmailHandler = gmailHandler else {
            call.reject("Not signed in", "NOT_SIGNED_IN")
            return
        }

        guard let messageId = call.getString("messageId"),
              let attachmentId = call.getString("attachmentId") else {
            call.reject("Missing messageId or attachmentId parameter")
            return
        }

        gmailHandler.getAttachment(messageId: messageId, attachmentId: attachmentId) { result in
            switch result {
            case .success(let data):
                call.resolve(data)
            case .failure(let error):
                call.reject(error.localizedDescription, "GMAIL_ATTACHMENT_FAILED")
            }
        }
    }

    // MARK: - Calendar Methods

    @objc func createCalendarEvent(_ call: CAPPluginCall) {
        guard let calendarHandler = calendarHandler else {
            call.reject("Not signed in", "NOT_SIGNED_IN")
            return
        }

        guard let summary = call.getString("summary"),
              let description = call.getString("description"),
              let startTimeIso = call.getString("startTimeIso"),
              let endTimeIso = call.getString("endTimeIso") else {
            call.reject("Missing required parameters")
            return
        }

        let timeZone = call.getString("timeZone") ?? "Europe/Istanbul"

        calendarHandler.createEvent(
            summary: summary,
            description: description,
            startTimeIso: startTimeIso,
            endTimeIso: endTimeIso,
            timeZone: timeZone
        ) { result in
            switch result {
            case .success(let data):
                call.resolve(data)
            case .failure(let error):
                call.reject(error.localizedDescription, "CALENDAR_CREATE_FAILED")
            }
        }
    }

    @objc func searchCalendarEvents(_ call: CAPPluginCall) {
        guard let calendarHandler = calendarHandler else {
            call.reject("Not signed in", "NOT_SIGNED_IN")
            return
        }

        guard let appId = call.getString("appId") else {
            call.reject("Missing appId parameter")
            return
        }

        calendarHandler.searchEvents(appId: appId) { result in
            switch result {
            case .success(let data):
                call.resolve(data)
            case .failure(let error):
                call.reject(error.localizedDescription, "CALENDAR_SEARCH_FAILED")
            }
        }
    }

    // MARK: - Private Helpers

    private func handleSignInSuccess(user: GIDGoogleUser, call: CAPPluginCall) {
        self.currentUser = user
        self.setupHandlers(user: user)

        // Firebase ile authenticate
        guard let idToken = user.idToken?.tokenString else {
            call.reject("No ID token", "NO_ID_TOKEN")
            return
        }

        let credential = GoogleAuthProvider.credential(
            withIDToken: idToken,
            accessToken: user.accessToken.tokenString
        )

        Auth.auth().signIn(with: credential) { [weak self] authResult, error in
            if let error = error {
                call.reject(error.localizedDescription, "FIREBASE_AUTH_FAILED")
                return
            }

            call.resolve(self?.userToDict(user) ?? [:])
        }
    }

    private func setupHandlers(user: GIDGoogleUser) {
        gmailHandler = GmailHandler(user: user)
        calendarHandler = CalendarHandler(user: user)
    }

    private func userToDict(_ user: GIDGoogleUser) -> [String: Any] {
        return [
            "id": user.userID ?? "",
            "name": user.profile?.name ?? "",
            "email": user.profile?.email ?? "",
            "imageUrl": user.profile?.imageURL(withDimension: 100)?.absoluteString ?? "",
            "idToken": user.idToken?.tokenString ?? "",
            "accessToken": user.accessToken.tokenString
        ]
    }
}
