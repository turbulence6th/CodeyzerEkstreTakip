import { parseStandardNumber } from 'utils/parsing';
import type { BankSmsParser, ParsedStatement, SmsDetails } from '../types';

export class GarantiParser implements BankSmsParser {
    bankName = "Garanti BBVA Bonus"; // Ayrı bir isim verelim

    canParse(sender: string, body: string): boolean {
        const lowerSender = sender.toLowerCase();
        const lowerBody = body.toLowerCase();
        return (
            lowerSender === 'bonus' && // Gönderen tam olarak 'bonus' olmalı
            lowerBody.includes('ekstresinin minimum tutarini') &&
            lowerBody.includes('kalan kismini aylik') &&
            lowerBody.includes('ertelemek icin') &&
            lowerBody.includes('tarihine kadar atlat') // Tarih bilgisini içeren kısım
        );
    }

    parse(message: SmsDetails): ParsedStatement | null {
        if (!this.canParse(message.sender, message.body)) {
            return null;
        }

        try {
            const cardNumberMatch = message.body.match(/(\d{4}) ile biten/i);
            const last4Digits = cardNumberMatch ? cardNumberMatch[1] : undefined;

            const amountMatch = message.body.match(/([\d.,]+) TL ekstresinin/i);
            const amount = amountMatch ? parseStandardNumber(amountMatch[1]) : null;
            
            const dateMatch = message.body.match(/(\d{2}\.\d{2}\.\d{4}) tarihine kadar/i);
            let dueDate: Date | null = null;
            if (dateMatch) {
                const [day, month, year] = dateMatch[1].split('.').map(Number);
                // JavaScript Date nesnesinde ay 0'dan başlar (Ocak=0)
                const baseDate = new Date(year, month - 1, day);
                if (!isNaN(baseDate.getTime())) {
                     // Tarihe 1 gün ekle
                     baseDate.setDate(baseDate.getDate() + 1);
                     dueDate = baseDate;
                } else {
                    console.warn(`[${this.bankName}] Invalid date format found in SMS: ${dateMatch[1]}`);
                }
            }

            if (amount !== null && dueDate !== null && last4Digits) {
                console.log(`[${this.bankName}] Successfully parsed statement from SMS.`);
                return {
                    bankName: this.bankName,
                    last4Digits,
                    amount,
                    dueDate,
                    originalMessage: message,
                    source: 'sms',
                    entryType: 'debt',
                };
            } else {
                console.warn(`[${this.bankName}] Could not parse required fields (amount, dueDate, last4Digits) from SMS: ${message.body}`);
            }
        } catch (error) {
            console.error(`[${this.bankName}] Error parsing message: ${message.body}`, error);
        }

        return null;
    }
}; 