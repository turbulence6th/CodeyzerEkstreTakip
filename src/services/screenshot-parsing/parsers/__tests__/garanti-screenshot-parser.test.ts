import { describe, it, expect } from 'vitest';
import { garantiScreenshotParser } from '../garanti-screenshot-parser';
import type { ScreenshotDetails } from '../../../statement-parsing/types';

describe('Garanti Screenshot Parser - Real OCR Test', () => {
    it('should parse real Garanti BBVA Bonus Classic Troy mobile app screenshot', () => {
        // Gerçek OCR çıktısı (hassas bilgiler maskelenmiş)
        const realOcrText = `19:03
.00l
Kredi Kartı İşlemleri
bonus
h
troy.
BONUS CLASSIC TROY
1234 ******** 5678
TEST KART SAHİBİ
Hesap Kesim
Son Ödeme
11/04/2026
21/04/2026
Toplam Limit
Kullanılabilir Limit
Kalan TL Borcu
Minimum Ödeme Tutarı
Min. Ödeme Tutarından Kalan Borç
100.000,00 TL
75.000,00 TL
8.500,00 TL
1.700,00 TL
1.700,00 TL
Kullanılabilir Bonus
0,33
Tel./ Posta Yoluyla Alışveriş
İnternet Üzerinden Alışveriş
Yurt Dışı Kullanımı
BonusFlaş'la alışveriş çok kolay,
Ana Sayfa
Hesap ve Kart
Basvurular
İşlemler
Durumum`;

        const screenshot: ScreenshotDetails = {
            extractedText: realOcrText,
            date: new Date(),
        };

        // canParse testi
        expect(garantiScreenshotParser.canParse(realOcrText)).toBe(true);

        // parse testi
        const result = garantiScreenshotParser.parse(screenshot);

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe('Garanti BBVA Bonus');
        expect(result?.last4Digits).toBe('5678');
        expect(result?.amount).toBe(8500); // Kalan TL Borcu
        expect(result?.dueDate).toBeInstanceOf(Date);
        expect(result?.dueDate?.getDate()).toBe(21);
        expect(result?.dueDate?.getMonth()).toBe(3); // Nisan = 3 (0-indexed)
        expect(result?.dueDate?.getFullYear()).toBe(2026);
        expect(result?.source).toBe('screenshot');
        expect(result?.entryType).toBe('debt');
    });

    it('should not parse Akbank screenshot', () => {
        const akbankText = `alxess PLATINUM co0e 1234 Son gün: 26 Kasım 5.200,50 TL Ekstreni öde`;
        expect(garantiScreenshotParser.canParse(akbankText)).toBe(false);
    });

    it('should not parse unrelated text', () => {
        expect(garantiScreenshotParser.canParse('lorem ipsum dolor sit amet')).toBe(false);
    });
});
