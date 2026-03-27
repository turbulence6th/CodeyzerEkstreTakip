const MOCK_DELAY = 300; // Sahte ağ gecikmesi
const createdEvents: any[] = []; // Mock'ta oluşturulan etkinlikleri takip etmek için

class CalendarServiceMock {
    constructor() {
        console.log('--- Using Mock Calendar Service ---');
    }

    async createEvent(
        summary: string,
        description: string,
        startTimeIso: string,
        endTimeIso: string,
        timeZone: string = 'Europe/Istanbul'
    ): Promise<any> {
        console.log(`[Mock] CalendarService.createEvent called with summary: ${summary}`);
        await new Promise(res => setTimeout(res, MOCK_DELAY));

        // Sahte etkinlik objesi oluştur
        const mockEvent = {
            id: `mock_event_${Date.now()}`,
            status: 'confirmed',
            summary: summary,
            description: description,
            start: { dateTime: startTimeIso, timeZone: timeZone },
            end: { dateTime: endTimeIso, timeZone: timeZone },
            htmlLink: 'https://calendar.google.com/mock/event'
        };
        createdEvents.push(mockEvent); // Takip için ekle

        console.log('[Mock] CalendarService.createEvent returning success:', mockEvent);
        return mockEvent;
    }

    async searchEvents(appId: string): Promise<boolean> {
        console.log(`[Mock] CalendarService.searchEvents called for AppID: "${appId}"`);
        await new Promise(res => setTimeout(res, MOCK_DELAY));

        const found = createdEvents.some(event => {
            return event.description && event.description.includes(appId);
        });

        console.log(`[Mock] CalendarService.searchEvents returning: ${found}`);
        return found;
    }

    async searchEventDetails(appId: string): Promise<{ found: boolean; eventId?: string }> {
        console.log(`[Mock] CalendarService.searchEventDetails called for AppID: "${appId}"`);
        await new Promise(res => setTimeout(res, MOCK_DELAY));

        const foundEvent = createdEvents.find(event => {
            return event.description && event.description.includes(appId);
        });

        return { found: !!foundEvent, eventId: foundEvent?.id };
    }

    async updateEvent(eventId: string, summary?: string, description?: string): Promise<any> {
        console.log(`[Mock] CalendarService.updateEvent called for eventId: "${eventId}"`);
        await new Promise(res => setTimeout(res, MOCK_DELAY));

        const event = createdEvents.find(e => e.id === eventId);
        if (event) {
            if (summary) event.summary = summary;
            if (description) event.description = description;
        }

        console.log('[Mock] CalendarService.updateEvent returning success');
        return { id: eventId, updated: true };
    }
}

// Sahte servisin bir örneğini dışa aktar
export const calendarServiceMock = new CalendarServiceMock(); 