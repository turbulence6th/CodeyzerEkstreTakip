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
import { store } from 'store';
import { fetchWithAuth } from './apiClient'; 
import { CapacitorHttp, HttpResponse } from '@capacitor/core';

/**
 * Gmail API ile etkileşim kurmak için servis.
 */
export class GmailService {
    private readonly gmailApiBaseUrl = 'https://www.googleapis.com/gmail/v1';

    /**
     * Belirtilen sorguyla eşleşen e-postaları arar.
     * @param query - Gmail arama sorgusu (örn: "from:banka@example.com subject:ekstre").
     * @param maxResults - Döndürülecek maksimum sonuç sayısı.
     * @returns E-posta listesi (ID ve threadId içerir).
     */
    async searchEmails(query: string, maxResults: number = 10): Promise<{ id: string; threadId: string }[]> {
        const url = `${this.gmailApiBaseUrl}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
        console.log(`GmailService: Searching emails with query: ${query}`);

        try {
            const response = await fetchWithAuth(url, { method: 'GET' });
            const data = await response.json();

            if (!data.messages) {
                console.log('GmailService: No messages found for query.');
                return [];
            }
            console.log(`GmailService: Found ${data.messages.length} messages.`);
            return data.messages;
        } catch (error) {
            console.error('GmailService: Error searching emails:', error);
            throw error;
        }
    }

    /**
     * Belirli bir e-postanın detaylarını alır.
     * @param messageId - Alınacak e-postanın ID'si.
     * @returns E-posta detayları (payload içerir).
     */
    async getEmailDetails(messageId: string): Promise<any> {
        const url = `${this.gmailApiBaseUrl}/users/me/messages/${messageId}?format=full`;
        console.log(`GmailService: Getting details for message ID: ${messageId}`);

        try {
            const response = await fetchWithAuth(url, { method: 'GET' });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`GmailService: Error getting email details for ${messageId}:`, error);
            throw error;
        }
    }

     /**
     * E-posta gövdesini (body) base64'ten çözer ve metin olarak döndürür.
     * Mime tipine göre doğru bölümü bulmaya çalışır.
     * Content-Type başlığındaki charset'e göre decode eder.
     * @param payload - E-postanın payload nesnesi.
     * @returns Çözülmüş e-posta gövdesi (string) veya null.
     */
    decodeEmailBody(payload: any): { plainBody: string | null; htmlBody: string | null } {
        let plainBodyData: string | null = null;
        let htmlBodyData: string | null = null;
        let charset = 'utf-8'; // Varsayılan

        const contentTypeHeader = payload.headers?.find((h: any) => h.name.toLowerCase() === 'content-type');
        if (contentTypeHeader) {
            const match = contentTypeHeader.value.match(/charset=[\"\']?([^;\"\']*)[\"\']?/i); // Updated regex for quotes
            if (match && match[1]) {
                charset = match[1].trim().toLowerCase();
                console.log(`GmailService: Detected charset: ${charset}`);
            }
        }

        const findBodyParts = (part: any) => {
            if (!part) return;

            const mimeType = part.mimeType;
            const bodyData = part.body?.data;

            if (bodyData) {
                 if (mimeType === 'text/plain' && !plainBodyData) {
                    plainBodyData = bodyData;
                 } else if (mimeType === 'text/html' && !htmlBodyData) {
                     htmlBodyData = bodyData;
                 }
             }

            if (part.parts && part.parts.length > 0 && (!plainBodyData || !htmlBodyData)) {
                for (const subPart of part.parts) {
                    findBodyParts(subPart);
                    if (plainBodyData && htmlBodyData) break;
                }
            }
        };

        findBodyParts(payload);

        const decodePart = (base64Data: string | null): string | null => {
            if (!base64Data) return null;
            try {
                const binaryString = atob(base64Data.replace(/-/g, '+').replace(/_/g, '/'));
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                 const decoder = new TextDecoder(charset, { fatal: false });
                 return decoder.decode(bytes);
            } catch (e) {
                console.error(`GmailService: Error decoding base64 body part with charset ${charset}:`, e);
                 if (charset !== 'utf-8') {
                     try {
                         console.warn('GmailService: Retrying decoding with UTF-8');
                         const binaryString = atob(base64Data.replace(/-/g, '+').replace(/_/g, '/'));
                         const bytes = new Uint8Array(binaryString.length);
                         for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
                         const decoder = new TextDecoder('utf-8', { fatal: false });
                         return decoder.decode(bytes);
                     } catch (utf8Error) {
                          console.error('GmailService: Error decoding base64 body part with UTF-8 fallback:', utf8Error);
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

    // --- YENİ METOT: Eki Alma (fetchWithAuth ile) ---
    async getAttachment(messageId: string, attachmentId: string): Promise<any> {
        // Token kontrolü (store'dan alma fetchWithAuth içinde yapılmalı)
        // Eğer fetchWithAuth token almıyorsa, burada alıp options'a eklemek gerekir.

        const url = `${this.gmailApiBaseUrl}/users/me/messages/${messageId}/attachments/${attachmentId}`;

        console.log(`GmailService: Fetching attachment using fetchWithAuth: ${url}`);
        try {
            // CapacitorHttp yerine fetchWithAuth kullan
            const response = await fetchWithAuth(url, { 
                method: 'GET',
                // fetchWithAuth zaten header ekliyorsa buna gerek yok,
                // eklemiyorsa manuel eklenmeli:
                // headers: { 'Authorization': `Bearer ${token}` } 
            });
            
            console.log(`GmailService: Attachment response status: ${response.status}`);
            // fetch ile response.headers'a doğrudan erişim olmayabilir, loglamayı kaldıralım veya fetchWithAuth'a ekleyelim.
            // console.log(`GmailService: Attachment response headers:`, JSON.stringify(response.headers, null, 2));

            if (response.ok) { // fetch API'si response.ok kullanır (status 200-299)
                const data = await response.json(); // Gmail attachment API JSON döner
                
                // Verinin tipini ve boyutunu logla
                console.log(`GmailService: Attachment data type: ${typeof data}, Keys: ${Object.keys(data).join(', ')}`);

                let base64DataToCheck: string | null = null;

                 // Yanıt { size: number, data: string } şeklinde mi (Attachment resource tipi)?
                 if (data?.size !== undefined && data?.data && typeof data.data === 'string') {
                     console.log(`GmailService: Attachment response matches Attachment resource type (size: ${data.size}).`);
                     base64DataToCheck = data.data; // API dokümanına göre bu base64url encoded
                 } else {
                     console.warn('GmailService: Could not find base64 data string in the expected format within response JSON. Response data:', data);
                 }

                // Kontrol edilecek base64 verisi bulunduysa başını/sonunu logla
                if (base64DataToCheck) {
                    console.log(`GmailService: Base64 data length: ${base64DataToCheck.length}`);
                    console.log(`GmailService: Base64 data start: ${base64DataToCheck.substring(0, 100)}...`);
                    console.log(`GmailService: Base64 data end: ...${base64DataToCheck.substring(base64DataToCheck.length - 100)}`);
                }
                
                return data;
            } else {
                console.error('GmailService: Failed to get attachment', response.status, response.statusText);
                // Hata detayını almaya çalış
                let errorBody = null;
                try {
                    errorBody = await response.text(); // veya .json()
                    console.error('Error response body:', errorBody);
                } catch (e) { /* ignore */ }
                throw new Error(`Failed to get attachment: Status ${response.status} ${response.statusText}`);
            }
        } catch (error: any) {
            console.error('GmailService: Error fetching attachment:', error);
            // Network hatası veya response.json() hatası olabilir
            throw error;
        }
    }
}

export const gmailService = new GmailService(); 