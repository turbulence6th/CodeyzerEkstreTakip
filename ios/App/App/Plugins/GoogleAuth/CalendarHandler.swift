import Foundation
import GoogleSignIn
import GoogleAPIClientForREST

class CalendarHandler {
    private let calendarService: GTLRCalendarService

    init(user: GIDGoogleUser) {
        calendarService = GTLRCalendarService()
        calendarService.authorizer = user.fetcherAuthorizer
    }

    func createEvent(
        summary: String,
        description: String,
        startTimeIso: String,
        endTimeIso: String,
        timeZone: String = "Europe/Istanbul",
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        let event = GTLRCalendar_Event()
        event.summary = summary
        event.descriptionProperty = description

        // Start time
        let startDateTime = GTLRCalendar_EventDateTime()
        if let startDate = parseISO8601Date(startTimeIso) {
            startDateTime.dateTime = GTLRDateTime(date: startDate)
        }
        startDateTime.timeZone = timeZone
        event.start = startDateTime

        // End time
        let endDateTime = GTLRCalendar_EventDateTime()
        if let endDate = parseISO8601Date(endTimeIso) {
            endDateTime.dateTime = GTLRDateTime(date: endDate)
        }
        endDateTime.timeZone = timeZone
        event.end = endDateTime

        // Hatırlatıcı ekle (1 gün önce)
        let reminder = GTLRCalendar_EventReminder()
        reminder.method = "popup"
        reminder.minutes = NSNumber(value: 60 * 24)  // 1 gün önce

        let reminders = GTLRCalendar_Event_Reminders()
        reminders.useDefault = false
        reminders.overrides = [reminder]
        event.reminders = reminders

        let query = GTLRCalendarQuery_EventsInsert.query(withObject: event, calendarId: "primary")

        calendarService.executeQuery(query) { ticket, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let createdEvent = response as? GTLRCalendar_Event else {
                completion(.failure(NSError(domain: "CalendarHandler", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response type"])))
                return
            }

            completion(.success([
                "id": createdEvent.identifier ?? "",
                "htmlLink": createdEvent.htmlLink ?? "",
                "summary": createdEvent.summary ?? ""
            ]))
        }
    }

    func searchEvents(appId: String, completion: @escaping (Result<[String: Any], Error>) -> Void) {
        // AppID'den tarihi çıkar (format: YYYY-MM-DD-...)
        let pattern = #"(\d{4}-\d{2}-\d{2})"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: appId, range: NSRange(appId.startIndex..., in: appId)),
              let range = Range(match.range(at: 1), in: appId) else {
            completion(.success(["eventFound": false]))
            return
        }

        let dateString = String(appId[range])
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        dateFormatter.timeZone = TimeZone(identifier: "Europe/Istanbul")

        guard let date = dateFormatter.date(from: dateString) else {
            completion(.success(["eventFound": false]))
            return
        }

        // Aynı günün başı ve sonu
        var calendar = Calendar(identifier: .gregorian)
        if let tz = TimeZone(identifier: "Europe/Istanbul") {
            calendar.timeZone = tz
        }
        
        let startOfDay = calendar.startOfDay(for: date)
        guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else {
            completion(.success(["eventFound": false]))
            return
        }

        let query = GTLRCalendarQuery_EventsList.query(withCalendarId: "primary")
        query.timeMin = GTLRDateTime(date: startOfDay)
        query.timeMax = GTLRDateTime(date: endOfDay)
        query.singleEvents = true

        calendarService.executeQuery(query) { ticket, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let events = response as? GTLRCalendar_Events else {
                completion(.success(["eventFound": false]))
                return
            }

            // Description'da appId'yi ara
            let eventFound = events.items?.contains { event in
                event.descriptionProperty?.contains(appId) ?? false
            } ?? false

            completion(.success(["eventFound": eventFound]))
        }
    }

    // MARK: - Private Helpers

    private func parseISO8601Date(_ isoString: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = formatter.date(from: isoString) {
            return date
        }

        // Fractional seconds olmadan dene
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: isoString)
    }
}
