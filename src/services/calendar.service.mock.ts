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

        // Mock'ta oluşturulan etkinliklerin açıklamalarında ara
        const found = createdEvents.some(event => {
            // Açıklama varsa ve AppID'yi içeriyorsa true dön
            return event.description && event.description.includes(appId);
        });

        console.log(`[Mock] CalendarService.searchEvents returning: ${found}`);
        return found;
    }
}

// Sahte servisin bir örneğini dışa aktar
export const calendarServiceMock = new CalendarServiceMock(); 