import type { BankScreenshotParser, ScreenshotDetails, ParsedStatement } from '../../sms-parsing/types';
import { parseTurkishNumber, parseTurkishDayMonth } from '../../../utils/parsing';

/**
 * Akbank mobil ekstre ekran görüntüsünden veri çıkaran parser
 *
 * Gerçek OCR format örneği:
 * "Akbank ****1234 38.222,22TL Son gün: 26 Kasım 6.028,66TL Ekstreni öde"
 *
 * Çıkarılacak bilgiler:
 * - Kart No: 1234
 * - Son Gün: 26 Kasım (tarih)
 * - Ekstre Tutarı: 6.028,66 TL (son gün sonrasındaki tutar)
 */
export const akbankScreenshotParser: BankScreenshotParser = {
    bankName: 'Akbank',

    canParse(extractedText: string): boolean {
        const lowerText = extractedText.toLowerCase();

        // Akbank tanımlama: "akbank", "axess" veya "wings" kelimelerinden biri geçmeli
        // OCR hataları için "axess" yerine "aixess", "aıxess" gibi varyasyonları da kabul et
        const hasAkbank = lowerText.includes('akbank') ||
                         lowerText.includes('axess') ||
                         lowerText.includes('aixess') || // OCR: "aIxess" -> "aixess"
                         lowerText.includes('aıxess') || // OCR: "aıxess"
                         lowerText.includes('wings');

        // Ekstre ile ilgili kelimeler: "son gün" veya "ekstre" veya "öde"
        const hasStatement = lowerText.includes('son gün') ||
                           lowerText.includes('ekstre') ||
                           lowerText.includes('öde');

        return hasAkbank && hasStatement;
    },

    parse(screenshot: ScreenshotDetails): ParsedStatement | null {
        const text = screenshot.extractedText;

        if (!text) {
            console.error('Akbank Screenshot Parser: No extracted text found.');
            return null;
        }

        let dueDate: Date | null = null;
        let amount: number | null = null;
        let last4Digits: string | undefined = undefined;

        // --- Kart Numarası (Son 4 Hane) ---
        // Format: "****1234" (başında yıldızlar olan 4 rakam)
        // OCR bazen yıldızları "co0e", "c00e" gibi okuyabilir
        let cardMatch = text.match(/\*+(\d{4})/);
        if (!cardMatch) {
            // OCR hatası için alternatif pattern: "co0e 1234", "c00e 1234" gibi
            cardMatch = text.match(/c[o0]+e\s+(\d{4})/i);
        }
        if (cardMatch && cardMatch[1]) {
            last4Digits = cardMatch[1];
        } else {
            console.warn('Akbank Screenshot Parser: Could not parse last 4 digits.');
        }

        // --- Son Ödeme Tarihi ---
        // Format: "Son gün: 26 Kasım"
        // "Son gün:" sonrasında gelen "DD Ay" formatı
        // Unicode aware pattern for Turkish month names (Kasım, Şubat, Ağustos, etc.)
        const dateMatch = text.match(/son\s+gün\s*:\s*(\d{1,2}\s+[a-zçğıöşü]+)/iu);
        if (dateMatch && dateMatch[1]) {
            dueDate = parseTurkishDayMonth(dateMatch[1]);
        }

        if (!dueDate) {
            console.error('Akbank Screenshot Parser: Could not parse a valid due date. Returning null.');
            return null;
        }

        // --- Ekstre Tutarı ---
        // Format: "Son gün: 26 Kasım 6.028,66TL"
        // Son gün sonrasında gelen tutar (ikinci tutar ekstre tutarıdır)
        // Metin örneği: "38.222,22TL Son gün: 26 Kasım 6.028,66TL Ekstreni öde"
        // Son gün sonrasındaki tutar: 6.028,66TL

        // "Son gün: DD Ay" sonrasında gelen ilk tutarı bul
        // Unicode aware pattern for Turkish month names
        const amountMatch = text.match(/son\s+gün\s*:\s*\d{1,2}\s+[a-zçğıöşü]+\s+([\d.,]+)\s*TL/iu);
        if (amountMatch && amountMatch[1]) {
            amount = parseTurkishNumber(amountMatch[1]);
        }

        if (amount === null) {
            console.warn('Akbank Screenshot Parser: Could not parse amount. Continuing with null.');
        }

        // ParsedStatement oluştur
        return {
            bankName: this.bankName,
            dueDate,
            amount,
            last4Digits,
            source: 'screenshot',
            originalMessage: screenshot,
            entryType: 'debt',
        };
    }
};
