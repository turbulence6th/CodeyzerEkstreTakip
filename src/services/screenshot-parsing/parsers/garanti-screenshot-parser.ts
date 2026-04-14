import type { BankScreenshotParser, ScreenshotDetails, ParsedStatement } from '../../statement-parsing/types';
import { parseTurkishNumber, parseDMYDate } from '../../../utils/parsing';
import { BANK_NAMES } from '../../bank-registry';

/**
 * Garanti BBVA Bonus mobil ekstre ekran görüntüsünden veri çıkaran parser
 *
 * Gerçek OCR format örneği:
 * "...BONUS CLASSIC TROY\n9792 ******** 7134\n...\nHesap Kesim\nSon Ödeme\n11/04/2026\n21/04/2026\n
 *  Toplam Limit\nKullanılabilir Limit\nKalan TL Borcu\nMinimum Ödeme Tutarı\n
 *  Min. Ödeme Tutarından Kalan Borç\n960.000,00 TL\n819.581,88 TL\n32.141,85 TL\n..."
 *
 * Çıkarılacak bilgiler:
 * - Kart No: 7134 (son 4 hane)
 * - Son Ödeme: 21/04/2026 (Hesap Kesim / Son Ödeme'den sonraki ikinci tarih)
 * - Kalan TL Borcu: 32.141,85 TL (etiketler bloğundaki üçüncü tutar)
 */
export const garantiScreenshotParser: BankScreenshotParser = {
    bankName: BANK_NAMES.GARANTI,

    canParse(extractedText: string): boolean {
        const lowerText = extractedText.toLowerCase();

        // Garanti BBVA Bonus tanımlama: "bonus" kelimesi geçmeli
        const hasBonus = lowerText.includes('bonus');

        // Ekstre ile ilgili kelimeler: "kalan tl borcu" veya DD/MM/YYYY formatlı "son ödeme"
        const hasStatement = lowerText.includes('kalan tl borcu') ||
            (lowerText.includes('son ödeme') && /\d{2}\/\d{2}\/\d{4}/.test(lowerText));

        return hasBonus && hasStatement;
    },

    parse(screenshot: ScreenshotDetails): ParsedStatement | null {
        const text = screenshot.extractedText;

        if (!text) {
            console.error('Garanti Screenshot Parser: No extracted text found.');
            return null;
        }

        let dueDate: Date | null = null;
        let amount: number | null = null;
        let last4Digits: string | undefined = undefined;

        // --- Kart Numarası (Son 4 Hane) ---
        // Format: "9792 ******** 7134" (ilk 4 rakam + yıldızlar + son 4 rakam)
        const cardMatch = text.match(/\d{4}\s+\*+\s*(\d{4})/);
        if (cardMatch && cardMatch[1]) {
            last4Digits = cardMatch[1];
        } else {
            console.warn('Garanti Screenshot Parser: Could not parse last 4 digits.');
        }

        // --- Son Ödeme Tarihi ---
        // Ekranda "Hesap Kesim" ve "Son Ödeme" etiketleri arka arkaya,
        // ardından iki DD/MM/YYYY tarih gelir: ilki Hesap Kesim, ikincisi Son Ödeme.
        // Örnek:
        //   Hesap Kesim
        //   Son Ödeme
        //   11/04/2026   <- Hesap Kesim tarihi
        //   21/04/2026   <- Son Ödeme tarihi (istenen)
        const dateMatch = text.match(
            /Hesap\s+Kesim\s+Son\s+[Öo]deme\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/iu
        );
        if (dateMatch && dateMatch[2]) {
            dueDate = parseDMYDate(dateMatch[2]);
        }

        if (!dueDate) {
            // Fallback: "Son Ödeme" sonrasındaki ikinci DD/MM/YYYY tarihi
            const sonOdemeIndex = text.search(/Son\s+[Öo]deme/iu);
            if (sonOdemeIndex !== -1) {
                const textAfter = text.substring(sonOdemeIndex);
                const datesAfter = [...textAfter.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)].map(m => m[1]);
                if (datesAfter.length >= 2) {
                    dueDate = parseDMYDate(datesAfter[1]);
                } else if (datesAfter.length === 1) {
                    dueDate = parseDMYDate(datesAfter[0]);
                }
            }
        }

        if (!dueDate) {
            console.error('Garanti Screenshot Parser: Could not parse a valid due date. Returning null.');
            return null;
        }

        // --- Ekstre Tutarı (Kalan TL Borcu) ---
        // Garanti ekranında etiketler önce, değerler aynı sırayla sonra listelenir:
        //   Toplam Limit           -> 960.000,00 TL  (1.)
        //   Kullanılabilir Limit   -> 819.581,88 TL  (2.)
        //   Kalan TL Borcu         -> 32.141,85 TL   (3.) <- istenen
        //   Minimum Ödeme Tutarı   -> 12.857,00 TL   (4.)
        //   Min. Ödeme Tutarından Kalan Borç -> 12.857,00 TL (5.)
        //
        // Son etiket olan "Min. Ödeme Tutarından Kalan Borç"tan sonra değerler başlar.
        // Değerler arasında 3. sıra "Kalan TL Borcu" değeridir.
        const lastLabelSplit = text.split(/Min\.?\s*[Öo]deme\s*Tutar[ıi]ndan\s*Kalan\s*Borç/iu);
        if (lastLabelSplit.length >= 2) {
            const amountsSection = lastLabelSplit[1];
            const amountMatches = [...amountsSection.matchAll(/([\d.,]+)\s*TL/gi)];
            if (amountMatches.length >= 3) {
                amount = parseTurkishNumber(amountMatches[2][1]);
            }
        }

        if (amount === null) {
            console.warn('Garanti Screenshot Parser: Could not parse amount. Continuing with null.');
        }

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
