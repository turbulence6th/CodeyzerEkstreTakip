import { describe, it, expect } from 'vitest';
import { akbankScreenshotParser } from '../akbank-screenshot-parser';
import type { ScreenshotDetails } from '../../../sms-parsing/types';

describe('Akbank Screenshot Parser - Real OCR Test', () => {
    it('should parse real Akbank Axess Platinum mobile app screenshot', () => {
        // Gerçek OCR çıktısı (hassas bilgiler maskelenmiş)
        const realOcrText = `BIMcell D: ll3,51K/s
aIxess
PLATINUM
co0e 1234
Kredi kartı
Dönem içi harcama
8500,00 TL
Kullanilabilir limit: 4.500,00 TL
Toplam limit: 35.000,00 TL
9 Kazanilan Chip-Para:
Toplam OChip-Para:
Daha az
Ekstre kesim tarihi:
Son ödeme tarihi:
Sonraki ekstre kesimi:
Sonraki son ödeme:
Son gün: 26 Kasım
5.200,50 TL
Ana sayfa Transfer ve ödeme
%50 22:30
Senin için
250,00 TL
0.00 TL
16.11.2025
26.11.2025
16.12.2025
26.12.2025
Ekstreni öde
O.
Arama ve asistan`;

        const screenshot: ScreenshotDetails = {
            extractedText: realOcrText,
            date: new Date(),
        };

        // canParse testi
        expect(akbankScreenshotParser.canParse(realOcrText)).toBe(true);

        // parse testi
        const result = akbankScreenshotParser.parse(screenshot);

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe('Akbank');
        expect(result?.last4Digits).toBe('1234'); // OCR'dan gelen kart numarası
        expect(result?.amount).toBe(5200.50); // Son gün tutarı
        expect(result?.dueDate).toBeInstanceOf(Date);
        expect(result?.dueDate?.getDate()).toBe(26);
        expect(result?.dueDate?.getMonth()).toBe(10); // Kasım = 10 (0-indexed)
        expect(result?.source).toBe('screenshot');
        expect(result?.entryType).toBe('debt');
    });

    it('should parse real Akbank Wings Classic Black mobile app screenshot', () => {
        // Gerçek OCR çıktısı (hassas bilgiler maskelenmiş)
        const realOcrText = `BIMcell D: . 5,37K/s $
W/NGS classic
BLACK
5678
Kredi kartı
Dönem içi harcama
O,00 TL
Kullanılabilir limit: 11.690,29 TL
Toplam limit: 40.000,00 TL
Kazanılan mil puan:
* Toplam mil puan:
9 Toplam Chip-Para:
Daha fazla
Son gün: 8 Aralık
1.623,88 TL
Ekstre
Ana sayfa Transfer ve ödeme
%570 09:58
321
Senin için
0,00 TL
-+
Ekstreni öde
Harcamalar
O.
Arama ve asistan`;

        const screenshot: ScreenshotDetails = {
            extractedText: realOcrText,
            date: new Date(),
        };

        // canParse testi
        expect(akbankScreenshotParser.canParse(realOcrText)).toBe(true);

        // parse testi
        const result = akbankScreenshotParser.parse(screenshot);

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe('Akbank');
        expect(result?.last4Digits).toBe('5678'); // OCR'dan gelen kart numarası (maskelenmiş)
        expect(result?.amount).toBe(1623.88); // Son gün tutarı
        expect(result?.dueDate).toBeInstanceOf(Date);
        expect(result?.dueDate?.getDate()).toBe(8);
        expect(result?.dueDate?.getMonth()).toBe(11); // Aralık = 11 (0-indexed)
        expect(result?.source).toBe('screenshot');
        expect(result?.entryType).toBe('debt');
    });
});
