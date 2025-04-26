import type { BankEmailParser, EmailDetails, ParsedStatement, DecodedEmailBody } from '../../sms-parsing/types'; // DecodedEmailBody import edildi
import { parseTurkishDate, parseTurkishNumber } from "../../../utils/parsing"; // parseTurkishNumber da eklendi

export const yapikrediEmailParser: BankEmailParser = {
    bankName: 'Yapı Kredi',

    // canParse imzası güncellendi, body parametresi yeni tipi kullanıyor
    canParse(sender: string, subject: string, body: DecodedEmailBody): boolean {
        return sender.includes('ekstre.yapikredi.com.tr') && 
               subject.includes('Hesap Özeti');
        // body içeriğine bakmaya gerek yok, gönderen ve konu yeterli
    },

    parse(email: EmailDetails): ParsedStatement | null {
        // HTML içeriğini önceliklendir
        const content = email.htmlBody || email.plainBody;

        if (!content) return null;

        // --- Son Ödeme Tarihi --- 
        // "... son ödeme tarihi DD Ay YYYY olan ..." formatını ara
        const dateMatch = content.match(/son [oö]deme tarihi (\d{1,2}\s+\S+\s+\d{4})\s+olan/i);
        const dateTr = dateMatch ? dateMatch[1] : null;
        const dueDate = dateTr ? parseTurkishDate(dateTr) : null;

        if (!dueDate) {
            console.error('Yapı Kredi Email Parser: Could not parse due date.');
            return null;
        }

        // --- Toplam Borç --- 
        // "Toplam Borç: 1.234,56 TL" formatını ara
        const amountMatch = content.match(/Toplam Bor[cç]:?\s*([\d.,]+)\s*TL/i);
        let amount: number | null = null;
        if (amountMatch && amountMatch[1]) {
            try {
                // parseTurkishNumber kullanmaya gerek yok, standart parse yeterli
                const amountStr = amountMatch[1].replace(/\./g, '').replace(/,/g, '.');
                amount = parseFloat(amountStr);
            } catch (e) {
                console.error('Yapı Kredi Email Parser: Error parsing amount string:', amountMatch[1], e);
            }
        }

        // Kart Numarası (opsiyonel) - Genellikle e-postalarda tam olmaz
        // Örnek: "Kart Numarası: XXXX XXXX XXXX 1234"
        const cardMatch = content.match(/Kart Numaras[ıi]:?\s*.*(\d{4})\s*</i); // Son 4 hane
        const last4Digits = cardMatch ? cardMatch[1] : null;

        if (amount === null) {
             console.warn('Yapı Kredi Email Parser: Could not parse amount.');
             // Tutar bulunamasa bile tarihi loglayabiliriz belki?
             // return null; // Tutar yoksa null dönebiliriz veya tutarı 0 varsayabiliriz.
        }

        return {
            bankName: this.bankName,
            dueDate: dueDate,
            amount: amount, // null olabilir
            last4Digits: last4Digits === null ? undefined : last4Digits, // null ise undefined yap
            source: 'email',
            originalMessage: email,
        };
    }
}; 