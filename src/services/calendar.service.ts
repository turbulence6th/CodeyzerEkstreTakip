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
     * Belirli bir AppID'ye sahip etkinliği Google Takvim'de arar.
     * AppID'nin formatı: "[AppID: type_name_YYYY-MM-DD...]"
     * @param appId - Aranacak etkinliğin AppID'si (örn: "[AppID: ekstre_yapikredi_2024-07-15]").
     * @returns Eşleşen etkinlik bulunursa true, bulunmazsa false döner.
     */
    async searchEvents(appId: string): Promise<boolean> {
        // AppID'den tarihi çıkar (YYYY-MM-DD kısmını bul)
        const dateMatch = appId.match(/(\d{4}-\d{2}-\d{2})/);
        if (!dateMatch) {
            console.error('CalendarService: Could not extract date from AppID:', appId);
            // Tarih çıkarılamazsa geniş bir aralıkta arama yapmayı deneyebiliriz
            // ancak bu daha yavaş olabilir. Şimdilik hata verelim veya false dönelim.
            // return false; // Veya hata fırlat?
            throw new Error(`AppID'den tarih çıkarılamadı: ${appId}`);
        }
        const targetDate = dateMatch[1]; // YYYY-MM-DD

        // timeMin ve timeMax için UTC RFC3339 formatını kullan
        const startOfDayUtc = `${targetDate}T00:00:00Z`;
        const dateObj = new Date(targetDate + 'T00:00:00Z');
        dateObj.setUTCDate(dateObj.getUTCDate() + 1);
        const endOfDayUtc = dateObj.toISOString();

        const timeMin = startOfDayUtc;
        const timeMax = endOfDayUtc;

        // q parametresi olarak AppID'nin tamamını kullan
        // AppID köşeli parantez içerdiği için encodeURIComponent kullanalım
        const searchQuery = encodeURIComponent(appId);

        // API URL'si
        // q araması açıklama dahil tüm alanlarda yapılır.
        const url = `${this.calendarApiBaseUrl}/calendars/primary/events?q=${searchQuery}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&maxResults=1`;

        console.log(`CalendarService: Searching event with AppID: "${appId}" within date: ${targetDate}`);

        try {
            const response = await fetchWithAuth(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });
            const responseData = await response.json();

            if (!response.ok) {
                console.error('CalendarService: Error searching events:', responseData);
                throw new Error(`Takvim etkinliği aranamadı: ${responseData.error?.message || response.statusText}`);
            }

            console.log('CalendarService: Search response:', responseData);

            // Eğer 'items' dizisi varsa ve içinde en az bir etkinlik varsa, eşleşme bulunmuştur.
            // Google q parametresi bazen alakasız sonuçlar dönebileceği için,
            // dönen sonucun açıklamasında gerçekten aradığımız AppID'nin olup olmadığını kontrol etmek daha güvenli olabilir.
            if (responseData.items && responseData.items.length > 0) {
                const foundEvent = responseData.items[0];
                if (foundEvent.description && foundEvent.description.includes(appId)) {
                    console.log(`CalendarService: Exact match found for AppID: ${appId}`);
                    return true;
                }
                 console.log(`CalendarService: Found event(s) with query, but none contain the exact AppID in description. AppID: ${appId}`);
            }
            
            return false; // Tam eşleşme bulunamadı

        } catch (error) {
            console.error('CalendarService: Error searching events:', error);
            throw error;
        }
    }
}

// Servisin tek bir örneğini dışa aktar
export const calendarService = new CalendarService(); 