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
import { fetchWithAuth } from './apiClient'; 

/**
 * Gmail API ile etkileşim kurmak için servis.
 */
class GmailService {
    // accessToken ve setAccessToken kaldırıldı
    private readonly gmailApiBaseUrl = 'https://www.googleapis.com/gmail/v1';

    /**
     * Belirtilen sorguyla eşleşen e-postaları arar.
     * @param query - Gmail arama sorgusu (örn: "from:banka@example.com subject:ekstre").
     * @param maxResults - Döndürülecek maksimum sonuç sayısı.
     * @returns E-posta listesi (ID ve threadId içerir).
     */
    async searchEmails(query: string, maxResults: number = 10): Promise<{ id: string; threadId: string }[]> {
        // accessToken kontrolü kaldırıldı
        const url = `${this.gmailApiBaseUrl}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
        console.log(`GmailService: Searching emails with query: ${query}`);

        try {
            // fetch yerine fetchWithAuth kullan
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
            throw error; // Hata yeniden fırlatılıyor
        }
    }

    /**
     * Belirli bir e-postanın detaylarını alır.
     * @param messageId - Alınacak e-postanın ID'si.
     * @returns E-posta detayları (payload içerir).
     */
    async getEmailDetails(messageId: string): Promise<any> { // Tip daha spesifik olabilir (örn: gapi.client.gmail.Message)
        // accessToken kontrolü kaldırıldı
        const url = `${this.gmailApiBaseUrl}/users/me/messages/${messageId}?format=full`; // format=full tüm payload'u getirir
        console.log(`GmailService: Getting details for message ID: ${messageId}`);

        try {
             // fetch yerine fetchWithAuth kullan
            const response = await fetchWithAuth(url, { method: 'GET' });
            const data = await response.json();
            // console.log('GmailService: Email details received:', data); // Çok büyük olabilir, loglamayı kaldır
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

        // Content-Type başlığından charset'i al
        const contentTypeHeader = payload.headers?.find((h: any) => h.name.toLowerCase() === 'content-type');
        if (contentTypeHeader) {
            const match = contentTypeHeader.value.match(/charset=["]?([^;"]*)["]?/i);
            if (match && match[1]) {
                charset = match[1].trim().toLowerCase();
                console.log(`GmailService: Detected charset: ${charset}`);
            }
        }

        // Rekürsif olarak payload içinde text/plain ve text/html bölümlerini ara
        const findBodyParts = (part: any) => {
            if (!part) return;

            const mimeType = part.mimeType;
            const bodyData = part.body?.data;

            if (bodyData) { // Sadece data içeren partları işle
                 if (mimeType === 'text/plain' && !plainBodyData) {
                    plainBodyData = bodyData;
                 } else if (mimeType === 'text/html' && !htmlBodyData) {
                     htmlBodyData = bodyData;
                 }
             }

            // Eğer multipart ise içindeki partları işle
            if (part.parts && part.parts.length > 0 && (!plainBodyData || !htmlBodyData)) {
                for (const subPart of part.parts) {
                    findBodyParts(subPart);
                    // İki türü de bulduysak aramayı durdur
                    if (plainBodyData && htmlBodyData) break;
                }
            }
        };

        findBodyParts(payload);

        // Bulunan base64 veriyi çöz (yerleşik atob ve TextDecoder kullanarak)
        const decodePart = (base64Data: string | null): string | null => {
            if (!base64Data) return null;
            try {
                // Base64 çözme için atob kullan
                const binaryString = atob(base64Data.replace(/-/g, '+').replace(/_/g, '/'));
                // Binary string'i Uint8Array'e çevir
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                 // Belirlenen charset veya varsayılan ile decode et (yerleşik TextDecoder)
                 const decoder = new TextDecoder(charset, { fatal: false }); // fatal:false hatayı önler
                 return decoder.decode(bytes);
            } catch (e) {
                console.error('GmailService: Error decoding base64 body part with charset '+charset+':', e);
                 // Hata durumunda UTF-8 ile tekrar dene (yaygın bir durum)
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
}

// Servisin tek bir örneğini dışa aktar
export const gmailService = new GmailService(); 