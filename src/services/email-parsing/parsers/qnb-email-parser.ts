import type { BankEmailParser, EmailDetails, ParsedStatement, DecodedEmailBody } from '../../statement-parsing/types';
import { parseDMYDate, parseTurkishNumber, parseStandardNumber } from '../../../utils/parsing';

export const qnbEmailParser: BankEmailParser = {
    bankName: 'QNB Finansbank',

    canParse(sender: string, subject: string, body: DecodedEmailBody): boolean {
        return sender.toLowerCase().includes('eekstre.qnb.com.tr') || 
               sender.toLowerCase().includes('qnb');
    },

    parse(email: EmailDetails): ParsedStatement | null {
        const content = email.htmlBody;
        if (!content) {
            console.error('QNB Email Parser: No HTML content found in email.');
            return null;
        }

        let dueDate: Date | null = null;
        let amount: number | null = null;
        let last4Digits: string | undefined = undefined;

        // --- Kart Numarası (Son 4 Hane) ---
        // Örnek: 5311 57** **** 7535
        const cardMatch = content.match(/(\d{4})\s*\d{2}\*\*\s*\*\*\*\*\s*(\d{4})/);
        if (cardMatch && cardMatch[2]) {
            last4Digits = cardMatch[2];
        }

        // --- Son Ödeme Tarihi ---
        // Örnek: <strong>Son Ödeme Tarihi</strong>... 26/01/2026
        const dateMatch = content.match(/Son Ödeme Tarihi.*?(\d{2}\/\d{2}\/\d{4})/s);
        if (dateMatch && dateMatch[1]) {
            dueDate = parseDMYDate(dateMatch[1]);
        }

        // --- Dönem Borcu ---
        // Örnek: <strong>Dönem Borcu</strong>... 0.00 TL
        const amountMatch = content.match(/Dönem Borcu.*?([\d.,]+)\s*TL/s);
        if (amountMatch && amountMatch[1]) {
            const amountStr = amountMatch[1];
            // Ayrıştırma stratejisi:
            // 1. Virgül içeriyorsa kesinlikle Türkçe formatıdır (1.234,56 veya 12,50)
            // 2. Virgül yok, nokta varsa:
            //    a. Tek bir nokta varsa ve sondan 2 basamak ayırıyorsa (123.45) -> Standart (nokta ondalık)
            //    b. Diğer durumlar (1.000 veya 1.000.000) -> Türkçe (nokta binlik)
            
            if (amountStr.includes(',')) {
                 amount = parseTurkishNumber(amountStr);
            } else if (amountStr.includes('.')) {
                const firstDotIndex = amountStr.indexOf('.');
                const lastDotIndex = amountStr.lastIndexOf('.');
                const decimals = amountStr.length - lastDotIndex - 1;

                if (firstDotIndex === lastDotIndex && decimals === 2) {
                     amount = parseStandardNumber(amountStr);
                } else {
                     amount = parseTurkishNumber(amountStr);
                }
            } else {
                // Ne nokta ne virgül var, düz sayı
                amount = parseFloat(amountStr);
            }
        }

        if (!dueDate) {
            console.error('QNB Email Parser: Could not parse a valid due date.');
            return null;
        }

        return {
            bankName: this.bankName,
            dueDate: dueDate,
            amount,
            last4Digits,
            source: 'email',
            originalMessage: email,
            entryType: 'debt',
        };
    }
};
