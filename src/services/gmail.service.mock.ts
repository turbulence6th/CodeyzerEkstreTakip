// src/services/gmail.service.mock.ts
import type { EmailDetails, DecodedEmailBody } from "./statement-parsing/types"; // DecodedEmailBody eklendi

const MOCK_DELAY = 500; // Sahte ağ gecikmesi

// Mock verisini, statement-processor'ın beklediği payload.headers yapısını içerecek şekilde güncelleyelim
const mockEmails = [
    {
        id: 'mock_email_1', threadId: 'thread_1',
        // Gerçek API'ye benzer payload yapısı ekleyelim
        payload: {
            headers: [
                { name: 'From', value: 'Ekstre <ekstre@ekstre.yapikredi.com.tr>' }, // Gönderici adı da olabilir
                { name: 'Subject', value: 'Yapı Kredi Hesap Özeti' },
                { name: 'Date', value: new Date(Date.now() - 86400000 * 5).toUTCString() } // String formatında tarih
            ],
            // Body bilgisi decodeEmailBody tarafından kullanılacak, payload içine koymaya gerek yok
            // Ancak gerçek API'de body bilgisi de payload içinde farklı yerlerde olabilir (parts vb.)
        },
        // Body bilgisini ayrı tutalım, decodeEmailBody bunu doğrudan kullanacak
        mockBody: {
            plainBody: 'Son Ödeme Tarihi: 18 Nisan 2026.',
            htmlBody: '<p>Son Ödeme Tarihi: 18 Nisan 2026</p>',
        },
        snippet: 'Yapı Kredi Hesap Özeti...' // Gerçek API'deki snippet alanı
    },
    {
        id: 'mock_email_2', threadId: 'thread_2',
        payload: {
             headers: [
                { name: 'From', value: 'Ziraat Bankası <ziraat@ileti.ziraatbank.com.tr>' },
                { name: 'Subject', value: 'Kasım Ayı E-Ekstre Servisi' },
                { name: 'Date', value: new Date(Date.now() - 86400000 * 2).toUTCString() }
            ],
        },
         mockBody: {
            plainBody: 'Dönem Borcu : 5.918,54 Son Ödeme Tarihi : 14/11/2025',
            htmlBody: `
              <table>
                <tbody>
                  <tr bgcolor="#dbdbdb">
                    <td width="25" height="25" style="border-top-left-radius:10px"></td>
                    <td width="150" height="25"><b>Dönem&nbsp;Borcu</b></td>
                    <td width="25" height="25">:</td>
                    <td width="200" height="25"><center>5.918,54 </center></td>
                    <td width="200" height="25" style="border-top-right-radius:10px"><center>0,00 </center></td>
                </tr>
                <tr bgcolor="#dbdbdb">
                    <td width="25" height="25"></td>
                    <td width="150" height="25"><b>Asgari&nbsp;Ödeme&nbsp;Tutarı</b></td>
                    <td width="25" height="25">:</td>
                    <td width="200" height="25"><center>2.367,42 </center></td>
                    <td width="200" height="25"><center>0,00 </center></td>
                </tr>
                <tr bgcolor="#dbdbdb">
                    <td width="25" height="25" style="border-bottom-left-radius:10px"></td>
                    <td width="150" height="25"><b>Son&nbsp;Ödeme&nbsp;Tarihi</b></td>
                    <td width="25" height="25">:</td>
                    <td width="200" height="25"><center>14/11/2025</center></td>
                    <td width="200" height="25" style="border-bottom-right-radius:10px"></td>
                </tr>
                </tbody>
              </table>
            `,
        },
        snippet: 'Ziraat E-Ekstre...'
    }
];

class GmailServiceMock {
    constructor() {
        console.log('--- Using Mock Gmail Service ---');
    }

    async searchEmails(query: string, maxResults: number = 10): Promise<{ id: string; threadId: string }[]> {
        console.log(`[Mock] GmailService.searchEmails called with query: ${query}`);
        await new Promise(res => setTimeout(res, MOCK_DELAY));
        
        // Sorguyu ayrıştırmak için basit bir yaklaşım
        let fromQuery = '';
        let subjectQuery = '';
        const fromMatch = query.match(/from:\(([^)]+)\)/i);
        const subjectMatch = query.match(/subject:\("?([^)"]+)"?\)/i);
        
        if (fromMatch && fromMatch[1]) {
            fromQuery = fromMatch[1].toLowerCase();
        }
        if (subjectMatch && subjectMatch[1]) {
            subjectQuery = subjectMatch[1].toLowerCase();
        }

        console.log(`[Mock] Parsed query - From: '${fromQuery}', Subject: '${subjectQuery}'`);

        // Filtrelemeyi ayrıştırılmış sorgu parçalarına göre yap
        const results = mockEmails
            .filter(email => { 
                const fromHeader = email.payload.headers.find(h => h.name === 'From')?.value?.toLowerCase() || '';
                const subjectHeader = email.payload.headers.find(h => h.name === 'Subject')?.value?.toLowerCase() || '';
                
                let fromMatchResult = true;
                let subjectMatchResult = true;

                if (fromQuery && !fromHeader.includes(fromQuery)) {
                    fromMatchResult = false;
                }
                if (subjectQuery && !subjectHeader.includes(subjectQuery)) {
                    subjectMatchResult = false;
                }
                
                return fromMatchResult && subjectMatchResult; // Her iki kriter de (varsa) eşleşmeli
            })
            .slice(0, maxResults) 
            .map(email => ({ id: email.id, threadId: email.threadId })); 
            
        console.log(`[Mock] GmailService.searchEmails returning ${results.length} results based on parsed query.`);
        return results;
    }

    // getEmailDetails artık payload içeren yapıyı döndürecek
    async getEmailDetails(messageId: string): Promise<any> { 
        console.log(`[Mock] GmailService.getEmailDetails called for ID: ${messageId}`);
        await new Promise(res => setTimeout(res, MOCK_DELAY));
        const foundEmail = mockEmails.find(email => email.id === messageId);
        if (foundEmail) {
            console.log(`[Mock] GmailService.getEmailDetails returning details structure for ${messageId}`);
            // Body bilgisini de içeren tam objeyi döndür (sms-processor bunu bekliyor olabilir)
             return { 
                 id: foundEmail.id,
                 threadId: foundEmail.threadId,
                 snippet: foundEmail.snippet,
                 payload: foundEmail.payload,
                 // sms-processor body'yi decodeEmailBody'den alacak ama 
                 // decodeEmailBody'nin de bu objeyi alması gerekiyor.
                 // Bu yüzden mockBody'yi de ekleyelim.
                 mockBody: foundEmail.mockBody 
             }; 
        }
        console.error(`[Mock] GmailService.getEmailDetails: No mock email found for ID ${messageId}`);
        const errorResponse = new Response(JSON.stringify({ error: { message: 'Not Found', code: 404 } }), { status: 404 });
        return Promise.reject(errorResponse);
    }

    // decodeEmailBody şimdi getEmailDetails'dan gelen tam objeyi alacak
    decodeEmailBody(emailDetailsResponse: any): DecodedEmailBody { // Tipi DecodedEmailBody olarak belirtelim
         console.log('[Mock] GmailService.decodeEmailBody called with mock structure');
         // Artık payload yerine emailDetailsResponse.mockBody'den okuyalım
         if (emailDetailsResponse && emailDetailsResponse.mockBody) {
             return {
                 plainBody: emailDetailsResponse.mockBody.plainBody || null,
                 htmlBody: emailDetailsResponse.mockBody.htmlBody || null,
             };
         }
         console.warn('[Mock] decodeEmailBody did not find mockBody in received structure:', emailDetailsResponse);
         return { plainBody: null, htmlBody: null };
    }

    // Mock getAttachment metodu
    async getAttachment(messageId: string, attachmentId: string): Promise<any> {
        console.log(`[Mock] GmailService.getAttachment called for messageId: ${messageId}, attachmentId: ${attachmentId}`);

        // Hangi mesaj ve ek için sahte veri döndüreceğimizi belirleyebiliriz.
        // Şimdilik basit bir base64 kodlu "Mock PDF Content" döndürelim.
        if (messageId === 'isbank-pdf-test-id' && attachmentId === 'isbank-pdf-attachment-id') {
            const mockBase64Pdf = btoa("Mock PDF Content for Isbank"); // Metni base64'e çevir
            return Promise.resolve({
                size: mockBase64Pdf.length,
                data: mockBase64Pdf.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_') // base64url formatına çevir
            });
        }

        // Başka durumlar için hata veya boş data
        // throw new Error('[Mock] Attachment not found');
        return Promise.resolve({ size: 0, data: '' });
    }
}

// Sahte servisin bir örneğini dışa aktar
export const gmailServiceMock = new GmailServiceMock(); 