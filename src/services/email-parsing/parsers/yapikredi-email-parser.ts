import type { BankEmailParser, EmailDetails, ParsedStatement, DecodedEmailBody } from '../../sms-parsing/types'; // DecodedEmailBody import edildi
import { parseTurkishDate } from "../../../utils/parsing"; // parseTurkishNumber kaldırıldı

export const yapikrediEmailParser: BankEmailParser = {
    bankName: 'Yapı Kredi',

    // canParse imzası güncellendi, body parametresi yeni tipi kullanıyor
    canParse(sender: string, subject: string, body: DecodedEmailBody): boolean {
        // Gönderen ve konu kontrolü genellikle yeterlidir.
        // Bu email formatında gövdede spesifik bir anahtar kelimeye gerek yok.
        return sender.includes('yapikredi.com.tr') && // Daha genel bir kontrol
               subject.includes('Hesap Özeti');
    },

    parse(email: EmailDetails): ParsedStatement | null {
        // HTML içeriğini önceliklendir
        const content = email.htmlBody || email.plainBody;

        if (!content) {
            console.warn('Yapı Kredi Email Parser: Email content is empty.');
            return null;
        }

        // --- Son Ödeme Tarihi ---
        // "... son ödeme tarihi DD Ay YYYY olan ..." formatını ara
        // "o" ve "ö" harflerini tolere et
        const dateMatch = content.match(/son [oö]deme tarihi (\d{1,2}\s+\S+\s+\d{4})\s+olan/i);
        const dateTr = dateMatch ? dateMatch[1] : null;
        const dueDate = dateTr ? parseTurkishDate(dateTr) : null;

        if (!dueDate) {
            // Bu e-posta türünün ana bilgisi tarih olduğu için tarih bulunamazsa null dönmek mantıklı.
            console.warn(`Yapı Kredi Email Parser (${email.id}): Could not parse due date from content.`);
            return null;
        }

        // --- Toplam Borç ---
        // Bu email formatında tutar bilgisi bulunmuyor.
        const amount: number | null = null;

        // --- Kart Numarası (Son 4 Hane) ---
        // "XXXXXX******XXXX numaralı kartınıza" formatını ara
        const cardMatch = content.match(/(\d{6})\*{6}(\d{4})\s+numaral[ıi]/i); // İlk 6 ve son 4 haneyi yakalar
        const last4Digits = cardMatch && cardMatch[2] ? cardMatch[2] : undefined; // İkinci grup son 4 hanedir

        if (!last4Digits) {
             console.warn(`Yapı Kredi Email Parser (${email.id}): Could not parse last 4 digits of card number.`);
        }

        // Tarih bulunduğundan ve tutar zaten beklenmediğinden, bilgileri döndür.
        return {
            bankName: this.bankName,
            dueDate: dueDate,
            amount: amount, // Tutar bu formatta bulunmadığı için her zaman null olacak
            last4Digits: last4Digits, // Bulunduysa eklenir, bulunmadıysa undefined olur
            source: 'email',
            originalMessage: email,
        };
    }
}; 