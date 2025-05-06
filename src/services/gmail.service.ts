// import { environment } from '../environments/environment'; // Bu import kaldırıldı

// Google API İstemci Kütüphanesi (gapi) tipleri için (gerekirse @types/gapi.client.gmail kurun)
// npm install --save-dev @types/gapi @types/gapi.auth2 @types/gapi.client.gmail
// veya yarn add --dev @types/gapi @types/gapi.auth2 @types/gapi.client.gmail
// *** GAPI/GIS artık kullanılmıyor, bu tiplere gerek kalmayabilir ***

// declare global {
//     interface Window {
//         gapi: any; // Kaldırıldı
//         google: any; // Kaldırıldı
//     }
// }

// Yeni API istemcisini import et
// import { fetchWithAuth } from './apiClient'; 
// import { CapacitorHttp, HttpResponse } from '@capacitor/core';

import { GoogleAuth } from '@plugins/google-auth';
import type {
    GoogleAuthPlugin,
    GmailSearchOptions,
    GmailSearchResponse,
    GmailDetailsOptions,
    GmailMessage,
    GmailAttachmentOptions,
    GmailAttachmentResponse
} from '../plugins/google-auth/definitions'; // Düzeltilmiş import yolu

/**
 * Gmail API ile etkileşim kurmak için servis.
 */
export class GmailService {
    // private readonly gmailApiBaseUrl = 'https://www.googleapis.com/gmail/v1'; // Artık kullanılmayacak

    /**
     * Belirtilen sorguyla eşleşen e-postaları arar (Native Plugin aracılığıyla).
     * @param accessToken - Google API erişim token'ı.
     * @param query - Gmail arama sorgusu.
     * @param maxResults - Döndürülecek maksimum sonuç sayısı (Native tarafta henüz implemente edilmedi, opsiyonel).
     * @returns E-posta listesi (ID ve threadId içerir) veya API yanıtı.
     */
    async searchEmails(accessToken: string, query: string, maxResults: number = 100): Promise<GmailSearchResponse> {
        if (!GoogleAuth) {
            console.error('GmailService: GoogleAuth plugin is not available.');
            throw new Error('GoogleAuth plugin not available');
        }
         if (!accessToken) {
            console.error('GmailService: Access token is required for searchEmails.');
            throw new Error('Access token is required');
        }

        const options: GmailSearchOptions = {
            accessToken,
            query,
            // maxResults, // Native tarafta desteklenince eklenebilir
        };

        console.log(`GmailService: Calling native searchGmailMessages with query: ${query}`);

        try {
            // Native metodu çağır
            const result: GmailSearchResponse = await GoogleAuth.searchGmailMessages(options);
            console.log(`GmailService: Native email search successful. Found approx ${result.resultSizeEstimate} messages.`);
            // Native plugin doğrudan Gmail API yanıtını (ListMessagesResponse) döndürüyor
            return result;
        } catch (error: any) {
            console.error('GmailService: Error calling native searchGmailMessages:', error);
            const errorMessage = error?.message || 'E-postalar aranırken hata oluştu (native).';
            const errorCode = error?.code;
            const newError = new Error(errorMessage);
            (newError as any).code = errorCode;
            throw newError;
        }
    }

    /**
     * Belirli bir e-postanın detaylarını alır (Native Plugin aracılığıyla).
     * @param accessToken - Google API erişim token'ı.
     * @param messageId - Alınacak e-postanın ID'si.
     * @returns E-posta detayları (Gmail API Message formatında).
     */
    async getEmailDetails(accessToken: string, messageId: string): Promise<GmailMessage> {
        if (!GoogleAuth) {
            console.error('GmailService: GoogleAuth plugin is not available.');
            throw new Error('GoogleAuth plugin not available');
        }
        if (!accessToken) {
            console.error('GmailService: Access token is required for getEmailDetails.');
            throw new Error('Access token is required');
        }

        const options: GmailDetailsOptions = { accessToken, messageId };

        console.log(`GmailService: Calling native getGmailMessageDetails for ID: ${messageId}`);

        try {
            // Native metodu çağır
            const result: GmailMessage = await GoogleAuth.getGmailMessageDetails(options);
             console.log(`GmailService: Native get details successful for ID: ${messageId}`);
            // Native plugin doğrudan Gmail API yanıtını (Message) döndürüyor
            return result;
        } catch (error: any) {
            console.error(`GmailService: Error calling native getGmailMessageDetails for ${messageId}:`, error);
            const errorMessage = error?.message || 'E-posta detayları alınırken hata oluştu (native).';
            const errorCode = error?.code;
            const newError = new Error(errorMessage);
            (newError as any).code = errorCode;
            throw newError;
        }
    }

    /**
    * E-posta gövdesini (body) base64'ten çözer ve metin olarak döndürür.
    * Mime tipine göre doğru bölümü bulmaya çalışır.
    * Content-Type başlığındaki charset'e göre decode eder.
    * ÖNEMLİ: Bu metod artık doğrudan Gmail API Message objesi (native'den gelen) üzerinde çalışır.
    * @param message - Native getEmailDetails'ten dönen GmailMessage objesi.
    * @returns Çözülmüş e-posta gövdeleri ({ plainBody: string | null; htmlBody: string | null }) veya null.
    */
    decodeEmailBody(message: GmailMessage): { plainBody: string | null; htmlBody: string | null } | null {
        if (!message || !message.payload) {
            console.warn('GmailService.decodeEmailBody: Message or payload is missing.');
            return null;
        }
        const payload = message.payload;
        let plainBodyData: string | null = null;
        let htmlBodyData: string | null = null;
        let charset = 'utf-8'; // Varsayılan

        // Content-Type header'ını bul ve charset'i çıkar
        const contentTypeHeader = payload.headers?.find((h: any) => h.name.toLowerCase() === 'content-type');
        if (contentTypeHeader) {
            const match = contentTypeHeader.value.match(/charset=["']?([^;"']*)["']?/i);
            if (match && match[1]) {
                charset = match[1].trim().toLowerCase();
                console.log(`GmailService.decodeEmailBody: Detected charset: ${charset}`);
            }
        }

        // Rekürsif olarak body part'larını arayan fonksiyon
        const findBodyParts = (part: any) => {
            if (!part) return;

            const mimeType = part.mimeType;
            const bodyData = part.body?.data; // Body verisi base64url encoded

            if (bodyData) {
                if (mimeType === 'text/plain' && !plainBodyData) {
                    plainBodyData = bodyData;
                } else if (mimeType === 'text/html' && !htmlBodyData) {
                    htmlBodyData = bodyData;
                }
            }

            // Eğer hem plain hem html bulunduysa veya alt part yoksa dur
            if ((plainBodyData && htmlBodyData) || !part.parts || part.parts.length === 0) {
                return;
            }

            // Alt part'ları gez
            for (const subPart of part.parts) {
                findBodyParts(subPart);
                if (plainBodyData && htmlBodyData) break; // İkisi de bulunduysa daha fazla aramaya gerek yok
            }
        };

        findBodyParts(payload);

        // Base64url veriyi çözen yardımcı fonksiyon
        const decodePart = (base64urlData: string | null): string | null => {
            if (!base64urlData) return null;
            try {
                // Base64url -> Base64
                let base64 = base64urlData.replace(/-/g, '+').replace(/_/g, '/');
                // Padding ekle (gerekliyse)
                while (base64.length % 4) {
                    base64 += '=';
                }
                const binaryString = atob(base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                // Belirlenen veya varsayılan charset ile decode et
                const decoder = new TextDecoder(charset, { fatal: false });
                return decoder.decode(bytes);
            } catch (e) {
                console.error(`GmailService.decodeEmailBody: Error decoding base64url body part with charset ${charset}:`, e);
                // UTF-8 ile tekrar dene (fallback)
                if (charset !== 'utf-8') {
                    try {
                        console.warn('GmailService.decodeEmailBody: Retrying decoding with UTF-8');
                        let base64 = base64urlData.replace(/-/g, '+').replace(/_/g, '/');
                        while (base64.length % 4) { base64 += '='; }
                        const binaryString = atob(base64);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
                        const decoder = new TextDecoder('utf-8', { fatal: false });
                        return decoder.decode(bytes);
                    } catch (utf8Error) {
                         console.error('GmailService.decodeEmailBody: Error decoding base64url body part with UTF-8 fallback:', utf8Error);
                    }
                }
                return null;
            }
        };

        return {
            plainBody: decodePart(plainBodyData),
            htmlBody: decodePart(htmlBodyData)
        };
    }

    /**
     * Belirli bir e-postadaki bir eki alır (Native Plugin aracılığıyla).
     * @param accessToken - Google API erişim token'ı.
     * @param messageId - Ekin bulunduğu e-postanın ID'si.
     * @param attachmentId - Alınacak ekin ID'si.
     * @returns Ek detayları (Gmail API MessagePartBody formatında, 'data' base64url kodludur).
     */
    async getAttachment(accessToken: string, messageId: string, attachmentId: string): Promise<GmailAttachmentResponse> {
        if (!GoogleAuth) {
            console.error('GmailService: GoogleAuth plugin is not available.');
            throw new Error('GoogleAuth plugin not available');
        }
         if (!accessToken) {
            console.error('GmailService: Access token is required for getAttachment.');
            throw new Error('Access token is required');
        }

        const options: GmailAttachmentOptions = { accessToken, messageId, attachmentId };

        console.log(`GmailService: Calling native getGmailAttachment for msg ${messageId}, att ${attachmentId}`);
        try {
            // Native metodu çağır
            const result: GmailAttachmentResponse = await GoogleAuth.getGmailAttachment(options);
            
            // Native'den dönen yanıtı logla (data kısmı base64url olmalı)
            console.log(`GmailService: Native getAttachment successful. Size: ${result.size}, Data start: ${result.data?.substring(0, 50)}...`);
            
            // Native plugin doğrudan Gmail API yanıtını (MessagePartBody) döndürüyor
            return result; 

        } catch (error: any) {
            console.error('GmailService: Error calling native getGmailAttachment:', error);
            const errorMessage = error?.message || 'E-posta eki alınırken hata oluştu (native).';
            const errorCode = error?.code;
            const newError = new Error(errorMessage);
            (newError as any).code = errorCode;
            throw newError;
        }
    }
}

export const gmailService = new GmailService(); 