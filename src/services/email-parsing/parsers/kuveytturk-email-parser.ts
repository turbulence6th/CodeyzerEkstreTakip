import type { BankEmailParser, EmailDetails, ParsedStatement, DecodedEmailBody } from '../../sms-parsing/types';
import { parseDMYDate, parseDottedDate, parseStandardNumber, parseTurkishNumber } from "../../../utils/parsing";

export const kuveytturkEmailParser: BankEmailParser = {
    bankName: 'Kuveyt Türk',

    canParse(sender: string, subject: string, body: DecodedEmailBody): boolean {
        // Gönderen ve konu kontrolü
        return sender.toLowerCase().includes('bilgilendirme@kuveytturk.com.tr') &&
               subject.toLowerCase().includes('kuveyt türk kredi kartı hesap ekstreniz');
    },

    parse(email: EmailDetails): ParsedStatement | null {
        const content = email.htmlBody;

        if (!content) {
            console.error('Kuveyt Türk Email Parser: No HTML content found in email.');
            return null;
        }

        let dueDate: Date | null = null;
        let amount: number | null = null;
        let last4Digits: string | undefined = undefined;

        // --- Kart Numarası (Son 4 Hane) --- 
        // Örnek: <p>...000000******0000 nolu...</p>
        const cardMatch = content.match(/(\d{6})\*{6}(\d{4})\s+nolu/i);
        if (cardMatch && cardMatch[2]) {
            last4Digits = cardMatch[2];
            // console.log('Kuveyt Türk Email Parser: Found last 4 digits:', last4Digits);
        } else {
            console.warn('Kuveyt Türk Email Parser: Could not parse last 4 digits.');
        }

        // --- Son Ödeme Tarihi --- 
        // Örnek: ...Son Ödeme Tarihi</span></td><td ...><span ...>DD.MM.YYYY</span>
        // Hücre yapısını ve span içindeki olası boşlukları içeren regex
        const dateMatch = content.match(/Son Ödeme Tarihi\s*<\/span>\s*<\/td>\s*<td[^>]*>\s*<span[^>]*>\s*([\d.]{10})\s*<\/span>/is);
       
        if (dateMatch && dateMatch[1]) {
            const dateStr = dateMatch[1];
            dueDate = parseDottedDate(dateStr); // parseDMYDate null dönebilir
            // console.log('Kuveyt Türk Email Parser: Found due date string:', dateStr, 'Parsed:', dueDate);
        }

        // dueDate bulunamadıysa veya geçersizse, parse işlemi başarısızdır.
        if (!dueDate) {
            console.error('Kuveyt Türk Email Parser: Could not parse a valid due date. Returning null.');
            return null;
        }

        // --- Ekstre Dönem Tutarı --- 
        // Örnek: ...Ekstre Dönem Tutarı</span></td><td ...><span ...>X,XXX.XX TL</span>
        // Hücre yapısını ve span içindeki olası boşlukları içeren regex
        const amountMatch = content.match(/Ekstre Dönem Tutarı\s*<\/span>\s*<\/td>\s*<td[^>]*>\s*<span[^>]*>\s*([\d.,]+)\s*TL\s*<\/span>/is);
        if (amountMatch && amountMatch[1]) {
            const amountStr = amountMatch[1];
            amount = parseStandardNumber(amountStr);
            // console.log('Kuveyt Türk Email Parser: Found amount string:', amountStr, 'Parsed:', amount);
        } else {
            console.warn('Kuveyt Türk Email Parser: Could not parse amount.');
        }

        return {
            bankName: this.bankName,
            dueDate: dueDate, // Artık null olamaz
            amount: amount, // null olabilir
            last4Digits: last4Digits, // undefined olabilir
            source: 'email',
            originalMessage: email, // Orijinal mesajı sakla
        };
    }
}; 