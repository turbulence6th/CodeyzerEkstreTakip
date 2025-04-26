import type { BankEmailParser, EmailDetails, ParsedStatement, DecodedEmailBody } from '../../sms-parsing/types';
import { parseDMYDate, parseTurkishNumber } from "../../../utils/parsing";

export const ziraatEmailParser: BankEmailParser = {
    bankName: 'Ziraat Bankası',

    canParse(sender: string, subject: string, body: DecodedEmailBody): boolean {
        // Gönderen ve konu kontrolü (daha önce olduğu gibi)
        return sender.includes('ziraatbank.com.tr') &&
               subject.toLowerCase().includes('e-ekstre');
    },

    parse(email: EmailDetails): ParsedStatement | null {
        // HTML içeriğini önceliklendir
        const content = email.htmlBody || email.plainBody;

        if (!content) {
            console.error('Ziraat Email Parser: No content found in email.');
            return null;
        }

        let dueDate: Date | null = null;
        let amount: number | null = null;
        let last4Digits: string | undefined = undefined;

        // --- Kart Numarası (HTML içindeki <p> etiketinden) ---
        // Örnek: <p><b>4446-####-####-0811</b> nolu kartınıza ait...</p>
        const cardMatchInP = content.match(/<p><b>(?:\d{4}-####-####-|\d{4} \*{4} \*{4} )(\d{4})<\/b>/i);
        if (cardMatchInP && cardMatchInP[1]) {
            last4Digits = cardMatchInP[1];
            console.log('Ziraat Email Parser: Found last 4 digits:', last4Digits);
        } else {
             console.warn('Ziraat Email Parser: Could not parse last 4 digits from <p> tag.');
        }


        // --- Son Ödeme Tarihi (HTML içindeki tablodan) ---
        // <tr> içinde "<b>Son Ödeme Tarihi</b>" ara, sonraki <center> etiketini bul
        // Regex: <b>Son...</b> etiketini bul, [^]*? ile sonraki <center>'a kadar olan her şeyi atla (non-greedy), tarihi yakala
        const dateRowMatch = content.match(/<b>Son[&nbsp;\s]+[ÖO]deme[&nbsp;\s]+Tarihi<\/b>.*?<center>(\d{2}\/\d{2}\/\d{4})<\/center>/is); // 's' flag'i eklendi (. yeni satırları da eşleştirir)
        if (dateRowMatch && dateRowMatch[1]) {
            const dateStr = dateRowMatch[1];
            dueDate = parseDMYDate(dateStr);
             console.log('Ziraat Email Parser: Found due date string:', dateStr, 'Parsed:', dueDate);
        }

        if (!dueDate) {
            console.error('Ziraat Email Parser: Could not parse due date from table.');
            // Tarih bulunamazsa parse işlemi başarısız sayılabilir.
            return null;
        }

        // --- Dönem Borcu (HTML içindeki tablodan) ---

        // Doğrudan yapıyı hedefleyen Regex (opsiyonel hatalı </b> ile)
        const amountRowMatch = content.match(/<center>\s*([\d.,]+)\s*(?:<\/b>)?\s*<\/center>/is); 
        if (amountRowMatch && amountRowMatch[1]) {
            let amountStr = amountRowMatch[1]; // Yakalanan grup zaten sayıyı içeriyor
            amountStr = amountStr.trim(); // Sayıdan sonra boşluk olabilir, temizle
            amount = parseTurkishNumber(amountStr);
        } else {
             console.warn('Ziraat Regex Parse (Direct Faulty Target): Could not parse amount from table.');
             amount = null; // Ensure amount is null if regex fails
        }

        return {
            bankName: this.bankName,
            dueDate: dueDate,
            amount: amount, // null olabilir
            last4Digits: last4Digits, // undefined olabilir
            source: 'email',
            originalMessage: email, // Orijinal mesajı sakla
        };
    }
}; 