import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { vakifbankEmailParser } from '../vakifbank-email-parser'; // Test edilecek parser
import type { EmailDetails, DecodedEmailBody } from '../../../statement-parsing/types';

// Mock HTML dosyasının yolu
const mockHtmlPath = path.resolve(__dirname, 'mocks/vakifbank-ekstre-sample.html');

describe('VakıfBank Email Parser', () => {
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
            id: 'test-vakifbank-email-id',
            sender: 'VAKIFBANK <kkm.ekstre@vakifbank.com.tr>', // VakıfBank göndericisi
            subject: 'VakıfBank Kredi Kartı Hesap Özeti', // VakıfBank konusu
            date: new Date(2026, 7, 15), // Örnek bir e-posta tarihi (15 Ağustos 2026)
            plainBody: null, // Test için sadece HTML kullanıyoruz
            htmlBody: mockHtmlContent,
            originalResponse: {}, // Gerekirse doldurulabilir
        };
    });

    // --- canParse Testi ---
    describe('canParse', () => {
        it('should return true for valid VakıfBank ekstre emails', () => {
            expect(vakifbankEmailParser.canParse(
                mockEmailDetails.sender,
                mockEmailDetails.subject,
                mockDecodedBody
            )).toBe(true);
        });

        it('should return true for subject without Turkish characters', () => {
            // Banka bazı metinlerde Türkçe karakter kullanmıyor ("Ozeti")
            expect(vakifbankEmailParser.canParse(
                mockEmailDetails.sender,
                'VakifBank Kredi Karti Hesap Ozeti',
                mockDecodedBody
            )).toBe(true);
        });

        it('should return false for incorrect sender', () => {
            expect(vakifbankEmailParser.canParse(
                'baska@banka.com',
                mockEmailDetails.subject,
                mockDecodedBody
            )).toBe(false);
        });

        it('should return false for incorrect subject', () => {
            expect(vakifbankEmailParser.canParse(
                mockEmailDetails.sender,
                'Farklı bir konu',
                mockDecodedBody
            )).toBe(false);
        });
    });

    // --- parse Testi ---
    describe('parse', () => {
        it('should correctly parse the mock VakıfBank ekstre HTML', async () => {
            // Mock HTML okunamadıysa testi atla
            if (!mockHtmlContent) {
                console.warn(`Skipping parse test because mock file could not be read: ${mockHtmlPath}`);
                return;
            }

            const result = await vakifbankEmailParser.parse(mockEmailDetails);

            // Sonucun null olmadığını ve beklenen değerleri içerdiğini kontrol et
            expect(result).not.toBeNull();

            if (result) {
                expect(result.bankName).toBe('VakıfBank');
                expect(result.source).toBe('email');
                expect(result.entryType).toBe('debt');

                // Mock HTML'deki kart numarası: 0000********0000
                expect(result.last4Digits).toBe('0000');

                // Tarihi kontrol et (Mock HTML'deki tarih: 24.08.2026)
                expect(result.dueDate).not.toBeNull();
                if (result.dueDate) {
                    expect(result.dueDate.getFullYear()).toBe(2026);
                    expect(result.dueDate.getMonth()).toBe(7); // Ağustos (0'dan başladığı için 7)
                    expect(result.dueDate.getDate()).toBe(24);
                }

                // Tutarı kontrol et (Mock HTML'deki Toplam Borç Bakiyesi: 1,234.56TL)
                expect(result.amount).toBe(1234.56);
            }
        });

        it('should parse fields when spacing uses &nbsp; entities instead of raw U+00A0', async () => {
            // Gmail bazı durumlarda boşlukları HTML entity olarak iletebiliyor
            const htmlWithEntities = mockHtmlContent.replace(/\u00a0/g, '&nbsp;');
            const result = await vakifbankEmailParser.parse({ ...mockEmailDetails, htmlBody: htmlWithEntities });

            expect(result).not.toBeNull();
            expect(result?.amount).toBe(1234.56);
            expect(result?.dueDate?.getDate()).toBe(24);
        });

        it('should return null if HTML content is missing', async () => {
            const emailWithoutHtml: EmailDetails = { ...mockEmailDetails, htmlBody: null };
            const result = await vakifbankEmailParser.parse(emailWithoutHtml);
            expect(result).toBeNull();
        });

        it('should return null if due date is missing', async () => {
            const htmlWithoutDate = mockHtmlContent.replace(/Son Ödeme Tarihi/g, 'Kesim Tarihi');
            const result = await vakifbankEmailParser.parse({ ...mockEmailDetails, htmlBody: htmlWithoutDate });
            expect(result).toBeNull();
        });
    });
});
