import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { kuveytturkEmailParser } from '../kuveytturk-email-parser'; // Test edilecek parser
import type { EmailDetails, DecodedEmailBody } from '../../../statement-parsing/types';

// Mock HTML dosyasının yolu
const mockHtmlPath = path.resolve(__dirname, 'mocks/kuveytturk-ekstre-sample.html');

describe('Kuveyt Türk Email Parser', () => {
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
            id: 'test-kuveytturk-email-id',
            sender: 'bilgilendirme@kuveytturk.com.tr', // Kuveyt Türk göndericisi
            subject: 'Kuveyt Türk Kredi Kartı Hesap Ekstreniz', // Kuveyt Türk konusu
            date: new Date(2025, 2, 1), // Örnek bir e-posta tarihi (Mart 1)
            plainBody: null, // Test için sadece HTML kullanıyoruz
            htmlBody: mockHtmlContent,
            originalResponse: {}, // Gerekirse doldurulabilir
        };
    });

    // --- canParse Testi (Happy Path) ---
    describe('canParse', () => {
        it('should return true for valid Kuveyt Türk e-ekstre emails', () => {
            expect(kuveytturkEmailParser.canParse(
                mockEmailDetails.sender,
                mockEmailDetails.subject,
                mockDecodedBody
            )).toBe(true);
        });

         it('should return false for incorrect sender', () => {
            expect(kuveytturkEmailParser.canParse(
                'baska@banka.com',
                mockEmailDetails.subject,
                mockDecodedBody
            )).toBe(false);
        });

         it('should return false for incorrect subject', () => {
            expect(kuveytturkEmailParser.canParse(
                mockEmailDetails.sender,
                'Farklı bir konu',
                mockDecodedBody
            )).toBe(false);
        });
    });

    // --- parse Testi (Happy Path) ---
    describe('parse', () => {
        it('should correctly parse the mock Kuveyt Türk ekstre HTML', async () => {
            // Mock HTML okunamadıysa testi atla
            if (!mockHtmlContent) {
                 console.warn(`Skipping parse test because mock file could not be read: ${mockHtmlPath}`);
                 return;
            }

            // *** ÖNEMLİ: Bu testin geçmesi için kuveytturk-email-parser.ts içindeki parse fonksiyonunun
            // *** HTML'den verileri (tutar, tarih, kart no) çıkaracak şekilde implemente edilmesi gerekir.
            // *** Şu anki haliyle (sadece loglama yapıp null dönen haliyle) bu test BAŞARISIZ olacaktır.
            const result = await kuveytturkEmailParser.parse(mockEmailDetails);

            // Sonucun null olmadığını ve beklenen değerleri içerdiğini kontrol et
            expect(result).not.toBeNull();

            if (result) {
                expect(result.bankName).toBe('Kuveyt Türk');
                expect(result.source).toBe('email');
                // Mock HTML'deki kart numarası: 000000******0000
                expect(result.last4Digits).toBe('0000');
                
                // Tarihi kontrol et (Mock HTML'deki tarih: 06.03.2025)
                expect(result.dueDate).not.toBeNull();
                if (result.dueDate) {
                     expect(result.dueDate.getFullYear()).toBe(2025);
                     expect(result.dueDate.getMonth()).toBe(2); // Mart (0'dan başladığı için 2)
                     expect(result.dueDate.getDate()).toBe(6);
                 }

                // Tutarı kontrol et (Mock HTML'deki tutar: 2,331.23 TL)
                expect(result.amount).toBe(2331.23);
            }
        });

        it('should return null if HTML content is missing', async () => {
             const emailWithoutHtml: EmailDetails = { ...mockEmailDetails, htmlBody: null };
             const result = await kuveytturkEmailParser.parse(emailWithoutHtml);
             expect(result).toBeNull();
         });

    });
}); 