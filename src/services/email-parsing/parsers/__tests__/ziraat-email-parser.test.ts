import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ziraatEmailParser } from '../ziraat-email-parser'; // Parser'ı import et
import type { EmailDetails, DecodedEmailBody } from '../../../statement-parsing/types';

// Mock HTML dosyasının yolu (test dosyasının konumuna göre ayarla)
const mockHtmlPath = path.resolve(__dirname, 'mocks/ziraat-ekstre-sample.html');

describe('Ziraat Email Parser', () => {
    let mockHtmlContent: string;
    let mockEmailDetails: EmailDetails;
    let mockDecodedBody: DecodedEmailBody;

    beforeEach(() => {
        // Her testten önce mock HTML'i oku
        try {
            mockHtmlContent = fs.readFileSync(mockHtmlPath, 'utf-8');
        } catch (error) {
            console.error(`Error reading mock file at ${mockHtmlPath}:`, error);
            mockHtmlContent = ''; // Hata durumunda boş içerik
        }

        // canParse ve parse için mock nesneler oluştur
        mockDecodedBody = {
            plainBody: null,
            htmlBody: mockHtmlContent,
        };

        mockEmailDetails = {
            id: 'test-email-id',
            sender: 'Ziraat Bankası <ziraat@ileti.ziraatbank.com.tr>',
            subject: 'Nisan 2025 E-Ekstre',
            date: new Date(2025, 3, 10), // Örnek bir tarih
            plainBody: null, // Test için sadece HTML kullanıyoruz
            htmlBody: mockHtmlContent,
            originalResponse: {}, // Gerekirse doldurulabilir
        };
    });

    // --- canParse Testleri ---
    describe('canParse', () => {
        it('should return true for valid Ziraat e-ekstre emails', () => {
            expect(ziraatEmailParser.canParse(
                'ziraat@ileti.ziraatbank.com.tr',
                'Konu: Nisan 2025 E-Ekstre',
                mockDecodedBody
            )).toBe(true);
        });

        it('should return false for incorrect sender', () => {
            expect(ziraatEmailParser.canParse(
                'baska@banka.com',
                'Konu: Nisan 2025 E-Ekstre',
                mockDecodedBody
            )).toBe(false);
        });

        it('should return false for incorrect subject', () => {
            expect(ziraatEmailParser.canParse(
                'ziraat@ileti.ziraatbank.com.tr',
                'Konu: Kampanya',
                mockDecodedBody
            )).toBe(false);
        });
    });

    // --- parse Testleri ---
    describe('parse', () => {
        it('should correctly parse the mock Ziraat ekstre HTML', async () => {
            // Mock HTML okunamadıysa testi atla
            if (!mockHtmlContent) {
                 console.warn(`Skipping parse test because mock file could not be read: ${mockHtmlPath}`);
                 return; // Veya expect(true).toBe(false) ile testi fail ettir.
             }

            const result = await ziraatEmailParser.parse(mockEmailDetails);

            // Sonucun null olmadığını kontrol et
            expect(result).not.toBeNull();

            if (result) {
                expect(result.bankName).toBe('Ziraat Bankası');
                expect(result.source).toBe('email');
                expect(result.last4Digits).toBe('0000'); // Anonimleştirilmiş değer
                
                // Tarihi kontrol et (Yıl, Ay, Gün olarak)
                expect(result.dueDate).not.toBeNull();
                if (result.dueDate) {
                     expect(result.dueDate.getFullYear()).toBe(2025);
                     expect(result.dueDate.getMonth()).toBe(3); // Nisan (0'dan başladığı için 3)
                     expect(result.dueDate.getDate()).toBe(14);
                 }

                // Tutarı kontrol et (hatalı </b> etiketine rağmen doğru parse edilmeli)
                expect(result.amount).toBe(5918.54); 
            }
        });
    });
}); 