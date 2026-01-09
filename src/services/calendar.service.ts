// src/services/calendar.service.ts
import type { /* GoogleAuthPlugin, */ CalendarEventOptions, CalendarSearchOptions, CalendarEventResponse, CalendarSearchResponse } from '../plugins/google-auth/definitions'; // Düzeltilmiş import yolu
import { GoogleAuth } from '@plugins/google-auth';

// Redux store ve actionları için importlar
import { getStore } from '../store'; 
import { setAuthCredentials, clearAuth } from '../store/slices/authSlice'; 

// --- Native API Çağrıları için Hata Yönetimi ve Yeniden Deneme Sarmalayıcısı ---
interface NativePluginError extends Error {
  code?: string;
  message: string;
}

async function callNativeGoogleApi<T>(
  nativeApiFunction: () => Promise<T>,
  isRetry: boolean = false
): Promise<T> {
  try {
    return await nativeApiFunction();
  } catch (e) {
    const error = e as NativePluginError;
    // iOS 'NOT_SIGNED_IN', Android 'SIGN_IN_REQUIRED' döndürebilir. Her ikisini de kapsayalım.
    if (error && (error.code === "SIGN_IN_REQUIRED" || error.code === "INVALID_GRANT" || error.code === "NOT_SIGNED_IN")) {
      if (isRetry) {
        console.error(
          'callNativeGoogleApi: Silent sign-in was already attempted and failed, or the API call failed again after retry. Logging out.'
        );
        getStore().dispatch(clearAuth());
        throw new Error('Authentication failed after retry and silent sign-in attempt.');
      }
      console.warn(
        `callNativeGoogleApi: Native API call failed with code: \${error.code}. Attempting silent sign-in.`
      );
      try {
        const silentSignInResult = await GoogleAuth.trySilentSignIn(); 
        if (silentSignInResult && silentSignInResult.idToken) {
          getStore().dispatch(setAuthCredentials(silentSignInResult)); 
          console.log(
            'callNativeGoogleApi: Silent sign-in successful. Retrying original native API call.'
          );
          return await callNativeGoogleApi(nativeApiFunction, true); 
        } else {
          console.error(
            'callNativeGoogleApi: Silent sign-in did not return the necessary credentials (e.g., idToken). Logging out.'
          );
          getStore().dispatch(clearAuth());
          throw new Error('Silent sign-in failed to provide necessary credentials.');
        }
      } catch (silentError) {
        const sError = silentError as NativePluginError;
        console.error('callNativeGoogleApi: Silent sign-in attempt also failed:', sError.message);
        getStore().dispatch(clearAuth());
        throw new Error(`Silent sign-in attempt failed: \${sError.message || 'Unknown error'}`);
      }
    }
    console.error(
      `callNativeGoogleApi: Native API call failed with an unhandled error or a non-auth error: \${error.message}, Code: \${error.code}`
    );
    throw error;
  }
}
// --- Sarmalayıcı Sonu ---


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
     * @returns Eşleşen etkinlik bulunursa true, bulunmazsa false döner (Native plugin response'una göre).
     */
    async searchEvents(appId: string): Promise<boolean> { // accessToken kaldırıldı
        if (!GoogleAuth) {
            console.error('CalendarService: GoogleAuth plugin is not available.');
            throw new Error('GoogleAuth plugin not available');
        }
        // accessToken kontrolü kaldırıldı
        if (!appId) {
            console.error('CalendarService: AppID is required for searchEvents.');
            throw new Error('AppID is required');
        }

        const options: Omit<CalendarSearchOptions, 'accessToken'> = { appId }; // accessToken çıkarıldı

        console.log(`CalendarService: Preparing to call native searchEvents with AppID: "${appId}"`);
        
        // Plugin metodunun (searchCalendarEvents) tip tanımı güncellenmiş olmalı.
        return callNativeGoogleApi(async () => {
            const result = await GoogleAuth.searchCalendarEvents(options as CalendarSearchOptions);
            return result.eventFound;
        });
    }
}

// Servisin tek bir örneğini dışa aktar
export const calendarService = new CalendarService();

// Plugin arayüzleri artık ../plugins/google-auth/definitions.ts içinde tanımlı, buradakiler kaldırılabilir.
/*
// ... (eski tip tanımları yorumlu kaldı)
*/ 