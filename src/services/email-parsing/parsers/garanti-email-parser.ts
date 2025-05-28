import type { BankEmailParser, EmailDetails, ParsedStatement, DecodedEmailBody } from '../../sms-parsing/types';
import { parseDottedDate, parseTurkishNumber } from '../../../utils/parsing';

export const garantiEmailParser: BankEmailParser = {
    bankName: 'Garanti BBVA',

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
        // <strong>Son Ödeme Tarihi:</strong><br>02.06.2025
        const dateMatch = content.match(/Son Ödeme Tarihi:<\/strong><br>(\d{2}\.\d{2}\.\d{4})/i);
        if (dateMatch && dateMatch[1]) {
            dueDate = parseDottedDate(dateMatch[1]);
        }
        if (!dueDate) {
            console.error('Garanti Email Parser: Could not parse a valid due date. Returning null.');
            return null;
        }

        // --- Toplam Borç Tutarı ---
        // <strong>Toplam Borç Tutarı:</strong><br>+2.505,24 TL
        const amountMatch = content.match(/Toplam Borç Tutarı:<\/strong><br>[+]?([\d.,]+) TL/i);
        if (amountMatch && amountMatch[1]) {
            amount = parseTurkishNumber(amountMatch[1]);
        } else {
            console.warn('Garanti Email Parser: Could not parse amount.');
        }

        return {
            bankName: this.bankName,
            dueDate: dueDate,
            amount: amount,
            last4Digits: last4Digits,
            source: 'email',
            originalMessage: email,
        };
    }
}; 