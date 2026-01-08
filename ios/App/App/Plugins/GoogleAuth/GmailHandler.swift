import Foundation
import GoogleSignIn
import GoogleAPIClientForREST

class GmailHandler {
    private let gmailService: GTLRGmailService

    init(user: GIDGoogleUser) {
        gmailService = GTLRGmailService()
        gmailService.authorizer = user.fetcherAuthorizer
    }

    func searchMessages(query: String, completion: @escaping (Result<[String: Any], Error>) -> Void) {
        let listQuery = GTLRGmailQuery_UsersMessagesList.query(withUserId: "me")
        listQuery.q = query

        gmailService.executeQuery(listQuery) { ticket, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let messagesResponse = response as? GTLRGmail_ListMessagesResponse else {
                completion(.failure(NSError(domain: "GmailHandler", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response type"])))
                return
            }

            var messages: [[String: Any]] = []
            for message in messagesResponse.messages ?? [] {
                messages.append([
                    "id": message.identifier ?? "",
                    "threadId": message.threadId ?? ""
                ])
            }

            completion(.success([
                "messages": messages,
                "nextPageToken": messagesResponse.nextPageToken ?? "",
                "resultSizeEstimate": messagesResponse.resultSizeEstimate ?? 0
            ]))
        }
    }

    func getMessageDetails(messageId: String, completion: @escaping (Result<[String: Any], Error>) -> Void) {
        let query = GTLRGmailQuery_UsersMessagesGet.query(withUserId: "me", identifier: messageId)
        query.format = "full"

        gmailService.executeQuery(query) { [weak self] ticket, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let message = response as? GTLRGmail_Message else {
                completion(.failure(NSError(domain: "GmailHandler", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response type"])))
                return
            }

            completion(.success(self?.messageToDict(message) ?? [:]))
        }
    }

    func getAttachment(messageId: String, attachmentId: String, completion: @escaping (Result<[String: Any], Error>) -> Void) {
        let query = GTLRGmailQuery_UsersMessagesAttachmentsGet.query(
            withUserId: "me",
            messageId: messageId,
            identifier: attachmentId
        )

        gmailService.executeQuery(query) { ticket, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let attachment = response as? GTLRGmail_MessagePartBody else {
                completion(.failure(NSError(domain: "GmailHandler", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response type"])))
                return
            }

            completion(.success([
                "attachmentId": attachment.attachmentId ?? "",
                "size": attachment.size ?? 0,
                "data": attachment.data ?? ""  // Base64url encoded
            ]))
        }
    }

    // MARK: - Private Helpers

    private func messageToDict(_ message: GTLRGmail_Message) -> [String: Any] {
        return [
            "id": message.identifier ?? "",
            "threadId": message.threadId ?? "",
            "labelIds": message.labelIds ?? [],
            "snippet": message.snippet ?? "",
            "historyId": message.historyId?.stringValue ?? "",
            "internalDate": message.internalDate?.stringValue ?? "",
            "payload": payloadToDict(message.payload) ?? [:],
            "sizeEstimate": message.sizeEstimate ?? 0
        ]
    }

    private func payloadToDict(_ payload: GTLRGmail_MessagePart?) -> [String: Any]? {
        guard let payload = payload else { return nil }

        var headers: [[String: String]] = []
        for header in payload.headers ?? [] {
            headers.append([
                "name": header.name ?? "",
                "value": header.value ?? ""
            ])
        }

        var parts: [[String: Any]] = []
        for part in payload.parts ?? [] {
            if let partDict = partToDict(part) {
                parts.append(partDict)
            }
        }

        return [
            "partId": payload.partId ?? "",
            "mimeType": payload.mimeType ?? "",
            "filename": payload.filename ?? "",
            "headers": headers,
            "body": bodyToDict(payload.body),
            "parts": parts
        ]
    }

    private func partToDict(_ part: GTLRGmail_MessagePart) -> [String: Any]? {
        var headers: [[String: String]] = []
        for header in part.headers ?? [] {
            headers.append([
                "name": header.name ?? "",
                "value": header.value ?? ""
            ])
        }

        var nestedParts: [[String: Any]] = []
        for nestedPart in part.parts ?? [] {
            if let nestedPartDict = partToDict(nestedPart) {
                nestedParts.append(nestedPartDict)
            }
        }

        return [
            "partId": part.partId ?? "",
            "mimeType": part.mimeType ?? "",
            "filename": part.filename ?? "",
            "headers": headers,
            "body": bodyToDict(part.body),
            "parts": nestedParts
        ]
    }

    private func bodyToDict(_ body: GTLRGmail_MessagePartBody?) -> [String: Any] {
        return [
            "attachmentId": body?.attachmentId ?? "",
            "size": body?.size ?? 0,
            "data": body?.data ?? ""
        ]
    }
}
