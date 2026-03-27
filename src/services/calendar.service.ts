// src/services/calendar.service.ts
import type { CalendarEventOptions, CalendarSearchOptions, CalendarEventResponse, CalendarSearchResponse, CalendarUpdateOptions, CalendarUpdateResponse } from '../plugins/google-auth/definitions';
import { GoogleAuth } from '@plugins/google-auth';
import { callNativeGoogleApi } from '../utils/googleApiClient';


/**
 * Google Calendar API ile etkileşim kurmak için servis.
 */
class CalendarService {
    // private readonly calendarApiBaseUrl = 'https://www.googleapis.com/calendar/v3'; // Artık kullanılmayacak

    /**
     * Google Takvim'de yeni bir etkinlik oluşturur (Native Plugin aracılığıyla).
     * @param summary - Etkinliğin başlığı.
     * @param description - Etkinliğin açıklaması.
     * @param startTimeIso - Başlangıç zamanı (ISO 8601 formatında).
     * @param endTimeIso - Bitiş zamanı (ISO 8601 formatında).
     * @param timeZone - Etkinliğin zaman dilimi.
     */
    async createEvent(
        // accessToken: string, // KALDIRILDI
        summary: string,
        description: string,
        startTimeIso: string,
        endTimeIso: string,
        timeZone: string = 'Europe/Istanbul'
    ): Promise<CalendarEventResponse> { 
        if (!GoogleAuth) {
            console.error('CalendarService: GoogleAuth plugin is not available.');
            throw new Error('GoogleAuth plugin not available');
        }
        // accessToken kontrolü kaldırıldı

        const options: Omit<CalendarEventOptions, 'accessToken'> = { // accessToken çıkarıldı
            summary,
            description,
            startTimeIso,
            endTimeIso,
            timeZone,
        };

        console.log('CalendarService: Preparing to call native createEvent with options:', options);

        // Plugin metodunun (createCalendarEvent) tip tanımı güncellenmiş olmalı.
        return callNativeGoogleApi(() => GoogleAuth.createCalendarEvent(options as CalendarEventOptions));
    }

    /**
     * Belirli bir AppID'ye sahip etkinliği Google Takvim'de arar (Native Plugin aracılığıyla).
     * @param appId - Aranacak etkinliğin AppID'si.
     * @returns Eşleşen etkinlik bulunursa true, bulunmazsa false döner.
     */
    async searchEvents(appId: string): Promise<boolean> {
        if (!GoogleAuth) {
            console.error('CalendarService: GoogleAuth plugin is not available.');
            throw new Error('GoogleAuth plugin not available');
        }
        if (!appId) {
            console.error('CalendarService: AppID is required for searchEvents.');
            throw new Error('AppID is required');
        }

        const options: Omit<CalendarSearchOptions, 'accessToken'> = { appId };

        console.log(`CalendarService: Preparing to call native searchEvents with AppID: "${appId}"`);

        return callNativeGoogleApi(async () => {
            const result = await GoogleAuth.searchCalendarEvents(options as CalendarSearchOptions);
            return result.eventFound;
        });
    }

    /**
     * Belirli bir AppID'ye sahip etkinliği arar ve detaylı bilgi döner (eventId dahil).
     * @param appId - Aranacak etkinliğin AppID'si.
     * @returns Eşleşen etkinlik bilgisi: found ve eventId.
     */
    async searchEventDetails(appId: string): Promise<{ found: boolean; eventId?: string }> {
        if (!GoogleAuth) {
            throw new Error('GoogleAuth plugin not available');
        }
        if (!appId) {
            throw new Error('AppID is required');
        }

        const options: Omit<CalendarSearchOptions, 'accessToken'> = { appId };

        return callNativeGoogleApi(async () => {
            const result = await GoogleAuth.searchCalendarEvents(options as CalendarSearchOptions);
            return { found: result.eventFound, eventId: result.eventId };
        });
    }

    /**
     * Mevcut bir takvim etkinliğini günceller (Native Plugin aracılığıyla).
     * @param eventId - Güncellenecek etkinliğin ID'si.
     * @param summary - Yeni başlık (opsiyonel).
     * @param description - Yeni açıklama (opsiyonel).
     */
    async updateEvent(
        eventId: string,
        summary?: string,
        description?: string,
    ): Promise<CalendarUpdateResponse> {
        if (!GoogleAuth) {
            console.error('CalendarService: GoogleAuth plugin is not available.');
            throw new Error('GoogleAuth plugin not available');
        }
        if (!eventId) {
            console.error('CalendarService: eventId is required for updateEvent.');
            throw new Error('eventId is required');
        }

        const options: Omit<CalendarUpdateOptions, 'accessToken'> = { eventId, summary, description };

        console.log(`CalendarService: Preparing to call native updateCalendarEvent for eventId: "${eventId}"`);

        return callNativeGoogleApi(() => GoogleAuth.updateCalendarEvent(options as CalendarUpdateOptions));
    }
}

// Servisin tek bir örneğini dışa aktar
export const calendarService = new CalendarService();

// Plugin arayüzleri artık ../plugins/google-auth/definitions.ts içinde tanımlı, buradakiler kaldırılabilir.
/*
// ... (eski tip tanımları yorumlu kaldı)
*/ 