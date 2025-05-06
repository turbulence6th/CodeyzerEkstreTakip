// import type { GoogleUser } from './definitions'; // Bu satır gereksiz, kaldırıldı.

/**
 * Google ile kimlik doğrulama sonucunda dönen kullanıcı bilgileri.
 * ÖNEMLİ: accessToken artık doğrudan döndürülmüyor, native tarafta yönetiliyor.
 */
// export interface GoogleUser { ... } // Kaldırıldı

// export interface GoogleAuthPlugin { ... } // Kaldırıldı

// --- Yeni Native API Metodları ---

/**
 * [NATIVE] Gmail API: Belirtilen sorguyla eşleşen e-postaları arar.
 */
// nativeSearchGmailMessages(options: { query: string; maxResults: number; }): Promise<{ messages: { id: string; threadId: string; }[]; }>;

/**
 * [NATIVE] Gmail API: Belirli bir e-postanın temel detaylarını alır.
 * Payload içerir, ancak gövde decode edilmemiştir.
 */
// nativeGetGmailMessageDetails(options: { messageId: string; }): Promise<{ id: string; threadId: string; snippet: string; payload: any; internalDate: string; }>;

/**
 * [NATIVE] Gmail API: Belirli bir e-posta ekini alır.
 * Veri standart Base64 formatındadır.
 */
// nativeGetGmailAttachment(options: { messageId: string; attachmentId: string; }): Promise<{ base64Data: string; }>;

/**
 * [NATIVE] Calendar API: Yeni bir takvim etkinliği oluşturur.
 */
// nativeCreateCalendarEvent(options: { eventData: { summary: string; description: string; startTimeIso: string; endTimeIso: string; timeZone?: string; }; }): Promise<{ eventId: string; htmlLink: string; }>;

/**
 * [NATIVE] Calendar API: Belirli bir AppID ve tarihe göre etkinlik arar.
 * Sadece açıklamasında AppID bulunan etkinlikleri döndürür.
 */
// nativeSearchCalendarEvents(options: { searchParams: { appId: string; targetDate: string; }; }): Promise<{ events: { id: string; description: string; }[]; }>; 