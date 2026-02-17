import type { BankEmailParser, EmailDetails, ParsedStatement, DecodedEmailBody } from '../../statement-parsing/types';
import { parseDottedDate, parseTurkishNumber } from '../../../utils/parsing';
import { BANK_NAMES } from '../../bank-registry';

export const akbankEmailParser: BankEmailParser = {
    bankName: BANK_NAMES.AKBANK,

    canParse(sender: string, subject: string, body: DecodedEmailBody): boolean {
        // Gönderen ve konu kontrolü
        return sender.toLowerCase().includes('hizmet@bilgi.akbank.com') &&
               subject.toLowerCase().includes('kredi kartı ekstre bilgileri');
    },

    parse(email: EmailDetails): ParsedStatement | null {
        const content = email.htmlBody;
        if (!content) {
            console.error('Akbank Email Parser: No HTML content found in email.');
            return null;
        }

        let dueDate: Date | null = null;
        let amount: number | null = null;
        let last4Digits: string | undefined = undefined;

        // --- Kart Numarası (Son 4 Hane) ---
        const cardMatch = content.match(/(\d{4})'le biten/i);
        if (cardMatch && cardMatch[1]) {
            last4Digits = cardMatch[1];
        } else {
            console.warn('Akbank Email Parser: Could not parse last 4 digits.');
        }

        // --- Son Ödeme Tarihi ---
        const dateMatch = content.match(/son ödeme tarihi (\d{2}\.\d{2}\.\d{4})/i);
        if (dateMatch && dateMatch[1]) {
            dueDate = parseDottedDate(dateMatch[1]);
        }
        if (!dueDate) {
            console.error('Akbank Email Parser: Could not parse a valid due date. Returning null.');
            return null;
        }

        // --- Ekstre Tutarı ---
        const amountMatch = content.match(/dönem borcunuz ([\d.,]+) TL/i);
        if (amountMatch && amountMatch[1]) {
            amount = parseTurkishNumber(amountMatch[1]);
        } else {
            console.warn('Akbank Email Parser: Could not parse amount.');
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