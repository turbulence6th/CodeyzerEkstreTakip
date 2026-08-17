import type { BankEmailParser, EmailDetails, ParsedStatement, DecodedEmailBody } from '../../statement-parsing/types';
import { parseDottedDate, parseStandardNumber } from '../../../utils/parsing';
import { BANK_NAMES } from '../../bank-registry';

export const vakifbankEmailParser: BankEmailParser = {
    bankName: BANK_NAMES.VAKIFBANK,

    canParse(sender: string, subject: string, body: DecodedEmailBody): boolean {
        // Gönderen ve konu kontrolü
        // Not: Banka bazı metinlerde Türkçe karakter kullanmıyor ("Ozeti"), her iki yazım da kabul edilir
        return sender.toLowerCase().includes('kkm.ekstre@vakifbank.com.tr') &&
               /hesap [öo]zeti/i.test(subject);
    },

    parse(email: EmailDetails): ParsedStatement | null {
        const content = email.htmlBody;

        if (!content) {
            console.error('VakıfBank Email Parser: No HTML content found in email.');
            return null;
        }

        // Ekstre alanları etiket adı ile değeri arasında &nbsp; (U+00A0) ile hizalanıyor,
        // regex'leri sadeleştirmek için normal boşluğa çevir
        const normalized = content.replace(/&nbsp;/gi, ' ').replace(/\u00a0/g, ' ');

        let dueDate: Date | null = null;
        let amount: number | null = null;
        let last4Digits: string | undefined = undefined;

        // --- Kart Numarası (Son 4 Hane) ---
        // Örnek: <div class="adDiv">0000********0000\n numaralı VakıfBank Kredi Kartı Hesap Ozetiniz...</div>
        const cardMatch = normalized.match(/(\d{4})\*+(\d{4})[\s\S]{0,50}?numaral[ıi]/i);
        if (cardMatch && cardMatch[2]) {
            last4Digits = cardMatch[2];
        } else {
            console.warn('VakıfBank Email Parser: Could not parse last 4 digits.');
        }

        // --- Son Ödeme Tarihi ---
        // Örnek: <div class="tarihDiv">Son Ödeme Tarihi          :24.08.2026</div>
        const dateMatch = normalized.match(/Son [ÖO]deme Tarihi\s*:\s*(\d{2}\.\d{2}\.\d{4})/i);
        if (dateMatch && dateMatch[1]) {
            dueDate = parseDottedDate(dateMatch[1]);
        }

        // dueDate bulunamadıysa veya geçersizse, parse işlemi başarısızdır.
        if (!dueDate) {
            console.error('VakıfBank Email Parser: Could not parse a valid due date. Returning null.');
            return null;
        }

        // --- Toplam Borç Bakiyesi ---
        // Örnek: <div class="tutarDiv">Toplam Borç Bakiyesi    :3,218.34TL</div>
        // VakıfBank standart sayı formatı kullanıyor (virgül binlik, nokta ondalık ayıracı)
        const amountMatch = normalized.match(/Toplam Bor[çc] Bakiyesi\s*:\s*([\d.,]+)\s*TL/i);
        if (amountMatch && amountMatch[1]) {
            amount = parseStandardNumber(amountMatch[1]);
        } else {
            console.warn('VakıfBank Email Parser: Could not parse amount.');
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
