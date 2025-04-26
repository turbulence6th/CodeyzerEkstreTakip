// src/services/calendar.service.ts
// Yeni API istemcisini import et
import { fetchWithAuth } from './apiClient'; 

/**
 * Google Calendar API ile etkileşim kurmak için servis.
 */
class CalendarService {
    private readonly calendarApiBaseUrl = 'https://www.googleapis.com/calendar/v3';

    /**
     * Google Takvim'de yeni bir etkinlik oluşturur.
     * @param summary - Etkinliğin başlığı.
     * @param description - Etkinliğin açıklaması.
     * @param startTimeIso - Başlangıç zamanı (ISO 8601 formatında, örn: "2024-08-15T09:30:00+03:00").
     * @param endTimeIso - Bitiş zamanı (ISO 8601 formatında, örn: "2024-08-15T10:00:00+03:00").
     * @param timeZone - Etkinliğin zaman dilimi (örn: "Europe/Istanbul").
     */
    async createEvent(
        summary: string,
        description: string,
        startTimeIso: string,
        endTimeIso: string,
        timeZone: string = 'Europe/Istanbul' // Varsayılan zaman dilimi
    ): Promise<any> { // Dönen event objesinin tipi daha detaylı belirtilebilir (gapi.client.calendar.Event gibi)
        const event = {
            summary: summary,
            description: description,
            start: {
                dateTime: startTimeIso,
                timeZone: timeZone,
            },
            end: {
                dateTime: endTimeIso,
                timeZone: timeZone,
            },
            // İsteğe bağlı: Hatırlatıcı ekleyebilirsiniz
            // reminders: {
            //   useDefault: false,
            //   overrides: [
            //     { method: 'popup', minutes: 30 }, // 30 dakika önce bildirim
            //     { method: 'email', minutes: 60 } // 1 saat önce e-posta
            //   ],
            // },
        };

        const url = `${this.calendarApiBaseUrl}/calendars/primary/events`;
        console.log('CalendarService: Creating event with payload:', event);

        try {
            // fetch yerine fetchWithAuth kullan
            const response = await fetchWithAuth(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }, // Auth header'ı fetchWithAuth ekler
                body: JSON.stringify(event),
            });
            const responseData = await response.json();

            if (!response.ok) {
                console.error('CalendarService: Error creating event:', responseData);
                // API'den gelen hata mesajını fırlat
                throw new Error(`Takvim etkinliği oluşturulamadı: ${responseData.error?.message || response.statusText}`);
            }

            console.log('CalendarService: Event created successfully:', responseData);
            return responseData; // Başarılı durumda oluşturulan etkinliği döndür

        } catch (error) {
            console.error('CalendarService: Error creating event:', error);
            // Hata mesajı fetchWithAuth veya API'den gelir
            throw error;
        }
    }

    /**
     * Belirli bir özete ve tarihe sahip etkinlikleri Google Takvim'de arar.
     * @param summary - Aranacak etkinliğin başlığı (tam eşleşme aranır).
     * @param targetDate - Etkinliğin aranacağı tarih (YYYY-MM-DD formatında).
     * @param timeZone - Zaman dilimi (örn: "Europe/Istanbul").
     * @returns Eşleşen etkinlik bulunursa true, bulunmazsa false döner.
     */
    async searchEvents(
        summary: string,
        targetDate: string, // YYYY-MM-DD
        timeZone: string = 'Europe/Istanbul'
    ): Promise<boolean> {
        // timeMin ve timeMax için UTC RFC3339 formatını kullan
        // targetDate'in YYYY-MM-DD olduğu varsayılıyor
        const startOfDayUtc = `${targetDate}T00:00:00Z`;
        // Bitiş zamanı için bir sonraki günün başlangıcı
        const dateObj = new Date(targetDate + 'T00:00:00Z');
        dateObj.setUTCDate(dateObj.getUTCDate() + 1);
        const endOfDayUtc = dateObj.toISOString(); // Bu zaten YYYY-MM-DDTHH:mm:ss.sssZ formatında olacak

        const timeMin = startOfDayUtc;
        const timeMax = endOfDayUtc;

        // API URL'si
        // singleEvents=true -> Tekrarlayan etkinlikleri ayrı ayrı listeler
        // q -> Tam metin araması yapar (özet, açıklama vb.)
        // timeMin/timeMax -> Belirtilen tarih aralığındaki etkinlikleri filtreler
        // maxResults=1 -> Eşleşen ilk etkinliği bulmak yeterli
        const url = `${this.calendarApiBaseUrl}/calendars/primary/events?q=${encodeURIComponent(summary)}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&maxResults=1`;

        console.log(`CalendarService: Searching events with query: "${summary}" on ${targetDate}`);

        try {
            // fetch yerine fetchWithAuth kullan
            const response = await fetchWithAuth(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }, // Auth header'ı fetchWithAuth ekler
            });
            const responseData = await response.json();

            if (!response.ok) {
                console.error('CalendarService: Error searching events:', responseData);
                throw new Error(`Takvim etkinliği aranamadı: ${responseData.error?.message || response.statusText}`);
            }

            console.log('CalendarService: Search response:', responseData);

            // Eğer 'items' dizisi varsa ve içinde en az bir etkinlik varsa, eşleşme bulunmuştur.
            return responseData.items && responseData.items.length > 0;

        } catch (error) {
            console.error('CalendarService: Error searching events:', error);
            // Hata mesajı fetchWithAuth veya API'den gelir
            throw error;
        }
    }
}

// Servisin tek bir örneğini dışa aktar
export const calendarService = new CalendarService(); 