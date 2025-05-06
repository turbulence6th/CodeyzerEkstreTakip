// src/services/calendar.service.ts
import type { GoogleAuthPlugin, CalendarEventOptions, CalendarSearchOptions, CalendarEventResponse, CalendarSearchResponse } from '../plugins/google-auth/definitions'; // Düzeltilmiş import yolu
import { GoogleAuth } from '@plugins/google-auth';

// fetchWithAuth importu artık gerekmeyebilir, yerine accessToken doğrudan alınacak.
// import { fetchWithAuth } from './apiClient';

// Plugin'i doğru şekilde import et

/**
 * Google Calendar API ile etkileşim kurmak için servis.
 */
class CalendarService {
    // private readonly calendarApiBaseUrl = 'https://www.googleapis.com/calendar/v3'; // Artık kullanılmayacak

    /**
     * Google Takvim'de yeni bir etkinlik oluşturur (Native Plugin aracılığıyla).
     * @param accessToken - Google API erişim token'ı.
     * @param summary - Etkinliğin başlığı.
     * @param description - Etkinliğin açıklaması.
     * @param startTimeIso - Başlangıç zamanı (ISO 8601 formatında).
     * @param endTimeIso - Bitiş zamanı (ISO 8601 formatında).
     * @param timeZone - Etkinliğin zaman dilimi.
     */
    async createEvent(
        accessToken: string, // EKLENDİ
        summary: string,
        description: string,
        startTimeIso: string,
        endTimeIso: string,
        timeZone: string = 'Europe/Istanbul'
    ): Promise<CalendarEventResponse> { // Dönen tip native plugin'den gelene göre güncellendi
        if (!GoogleAuth) {
            console.error('CalendarService: GoogleAuth plugin is not available.');
            throw new Error('GoogleAuth plugin not available');
        }
        if (!accessToken) {
            console.error('CalendarService: Access token is required for createEvent.');
            throw new Error('Access token is required');
        }

        const options: CalendarEventOptions = {
            accessToken,
            summary,
            description,
            startTimeIso,
            endTimeIso,
            timeZone,
        };

        console.log('CalendarService: Calling native createEvent with options:', options);

        try {
            const result = await GoogleAuth.createCalendarEvent(options);
            console.log('CalendarService: Native event creation successful:', result);
            return result;
        } catch (error: any) {
            console.error('CalendarService: Error calling native createEvent:', error);
            // Native'den gelen hata mesajını veya standart bir mesajı fırlat
            const errorMessage = error?.message || 'Takvim etkinliği oluşturulamadı (native).';
            const errorCode = error?.code; // Opsiyonel: Hata kodunu da ekleyebiliriz
            const newError = new Error(errorMessage);
            (newError as any).code = errorCode;
            throw newError;
        }
    }

    /**
     * Belirli bir AppID'ye sahip etkinliği Google Takvim'de arar (Native Plugin aracılığıyla).
     * @param accessToken - Google API erişim token'ı.
     * @param appId - Aranacak etkinliğin AppID'si.
     * @returns Eşleşen etkinlik bulunursa true, bulunmazsa false döner (Native plugin response'una göre).
     */
    async searchEvents(accessToken: string, appId: string): Promise<boolean> { // Dönen tip native plugin'den gelene göre güncellendi
        if (!GoogleAuth) {
            console.error('CalendarService: GoogleAuth plugin is not available.');
            throw new Error('GoogleAuth plugin not available');
        }
        if (!accessToken) {
            console.error('CalendarService: Access token is required for searchEvents.');
            throw new Error('Access token is required');
        }
        if (!appId) {
            console.error('CalendarService: AppID is required for searchEvents.');
            throw new Error('AppID is required');
        }

        const options: CalendarSearchOptions = { accessToken, appId };

        console.log(`CalendarService: Calling native searchEvents with AppID: "${appId}"`);

        try {
            const result: CalendarSearchResponse = await GoogleAuth.searchCalendarEvents(options);
            console.log('CalendarService: Native event search successful:', result);
            return result.eventFound; // Native plugin'den dönen eventFound alanını kullan
        } catch (error: any) {
            console.error('CalendarService: Error calling native searchEvents:', error);
            const errorMessage = error?.message || 'Takvim etkinliği aranamadı (native).';
            const errorCode = error?.code; 
            const newError = new Error(errorMessage);
            (newError as any).code = errorCode;
            throw newError;
        }
    }
}

// Servisin tek bir örneğini dışa aktar
export const calendarService = new CalendarService();

// Plugin arayüzleri artık ../plugins/google-auth/definitions.ts içinde tanımlı, buradakiler kaldırılabilir.
/*
export interface CalendarEventOptions {
    accessToken: string;
    summary: string;
    description: string;
    startTimeIso: string;
    endTimeIso: string;
    timeZone: string;
}

export interface CalendarSearchOptions {
    accessToken: string;
    appId: string;
}

export interface CalendarEventResponse {
    id: string;
    htmlLink?: string;
    summary?: string;
    // Native plugin'den dönebilecek diğer alanlar...
}

export interface CalendarSearchResponse {
    eventFound: boolean;
    // Native plugin'den dönebilecek diğer alanlar...
}
*/ 