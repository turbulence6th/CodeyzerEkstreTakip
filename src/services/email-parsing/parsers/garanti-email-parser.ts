import type { BankEmailParser, EmailDetails, ParsedStatement, DecodedEmailBody } from '../../statement-parsing/types';
import { parseDottedDate, parseTurkishNumber } from '../../../utils/parsing';

export const garantiEmailParser: BankEmailParser = {
    bankName: 'Garanti BBVA Bonus',

    canParse(sender: string, subject: string, body: DecodedEmailBody): boolean {
        return sender.toLowerCase().includes('garantibbva@garantibbva.com.tr') &&
               subject.toLowerCase().includes('bonus ekstresi');
    },

    parse(email: EmailDetails): ParsedStatement | null {
        const content = email.htmlBody;
        if (!content) {
            console.error('Garanti Email Parser: No HTML content found in email.');
            return null;
        }

        let dueDate: Date | null = null;
        let amount: number | null = null;
        let last4Digits: string | undefined = undefined;

        // --- Kart Numarası (Son 4 Hane) ---
        // Örnek: <span style="color:red;">5549 60** **** 3700</span>
        const cardMatch = content.match(/(\d{4})\s*\d{2}\*\*\s*\*\*\*\*\s*(\d{4})/);
        if (cardMatch && cardMatch[2]) {
            last4Digits = cardMatch[2];
        } else {
            console.warn('Garanti Email Parser: Could not parse last 4 digits.');
        }

        // --- Son Ödeme Tarihi ---
        // Troy format: <td>Son Ödeme Tarihi:</td><td align="right">21.10.2025</td>
        let dateMatch = content.match(/>Son Ödeme Tarihi:<\/td>\s*<td[^>]*>\s*(\d{2}\.\d{2}\.\d{4})/is);
        // Mastercard format: <strong>Son Ödeme Tarihi:</strong><br>03.11.2025
        if (!dateMatch) {
            dateMatch = content.match(/<strong>Son Ödeme Tarihi:<\/strong><br>(\d{2}\.\d{2}\.\d{4})/i);
        }
        
        if (dateMatch && dateMatch[1]) {
            dueDate = parseDottedDate(dateMatch[1]);
        }

        if (!dueDate) {
            console.error('Garanti Email Parser: Could not parse a valid due date. Returning null.');
            return null;
        }

        // --- Toplam Borç Tutarı ---
        // Troy format: <td>Toplam Borç Tutarı:</td><td align="right">+616,80 TL</td>
        let amountMatch = content.match(/>Toplam Borç Tutarı:<\/td>\s*<td[^>]*>\s*[+]?([\d.,]+)\s*TL/is);
        // Mastercard format: <strong>Toplam Borç Tutarı:</strong><br>+4.461,26 TL
        if (!amountMatch) {
            amountMatch = content.match(/<strong>Toplam Borç Tutarı:<\/strong><br>[+]?([\d.,]+)\s*TL/i);
        }

        if (amountMatch && amountMatch[1]) {
            amount = parseTurkishNumber(amountMatch[1]);
        } else {
            console.warn('Garanti Email Parser: Could not parse amount.');
        }

        return {
            bankName: this.bankName,
            dueDate,
            amount,
            last4Digits,
            source: 'email',
            originalMessage: email,
            entryType: 'debt',
        };
    }
}; 