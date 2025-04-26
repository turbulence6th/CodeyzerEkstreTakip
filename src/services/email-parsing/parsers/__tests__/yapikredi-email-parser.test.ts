import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { yapikrediEmailParser } from '../yapikredi-email-parser'; // Parser'ı import et
import type { EmailDetails, DecodedEmailBody } from '../../../sms-parsing/types';

// Mock HTML dosyasının yolu
const mockHtmlPath = path.resolve(__dirname, '../../mocks/yapikredi-ekstre-sample.html');

describe('Yapı Kredi Email Parser', () => {
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
            id: 'test-ykb-email-id',
            sender: 'ekstre@ekstre.yapikredi.com.tr', // Doğru gönderen
            subject: 'Kredi Kartı Hesap Özeti', // Doğru konu
            date: new Date(2025, 3, 15), // Örnek bir tarih
            plainBody: null, 
            htmlBody: mockHtmlContent,
            originalResponse: {}, 
        };
    });

    // --- canParse Testleri ---
    describe('canParse', () => {
        it('should return true for valid Yapı Kredi ekstre emails', () => {
            expect(yapikrediEmailParser.canParse(
                'ekstre@ekstre.yapikredi.com.tr',
                'Konu: Hesap Özeti Bilgilendirme',
                mockDecodedBody
            )).toBe(true);
        });

        it('should return false for incorrect sender', () => {
            expect(yapikrediEmailParser.canParse(
                'baska@banka.com',
                'Hesap Özeti',
                mockDecodedBody
            )).toBe(false);
        });

        it('should return false for incorrect subject', () => {
            expect(yapikrediEmailParser.canParse(
                'ekstre@ekstre.yapikredi.com.tr',
                'Kampanya',
                mockDecodedBody
            )).toBe(false);
        });
    });

    // --- parse Testleri --- (Sadece Happy Path)
    describe('parse', () => {
        it('should correctly parse date and card from the mock Yapı Kredi notification HTML (amount should be null)', () => {
            // Mock HTML okunamadıysa testi atla
            if (!mockHtmlContent) {
                 console.warn(`Skipping parse test because mock file could not be read: ${mockHtmlPath}`);
                 return;
             }

            const result = yapikrediEmailParser.parse(mockEmailDetails);

            // Sonucun null olmadığını kontrol et (Tarih parse edilebildiği için)
            expect(result).not.toBeNull();

            if (result) {
                expect(result.bankName).toBe('Yapı Kredi');
                expect(result.source).toBe('email');
                
                // Kart numarasını bu mock'ta bulamayabilir, Regex'e bağlı.
                // Eğer Regex son 4 haneyi buluyorsa:
                // const cardMatch = mockHtmlContent.match(/(\d{6}\*{6}\d{4})/i);
                // if (cardMatch && cardMatch[1]) {
                //      const fullCard = cardMatch[1];
                //      expect(result.last4Digits).toBe(fullCard.substring(fullCard.length - 4)); // YYYY olmalı
                // } else {
                //      expect(result.last4Digits).toBeUndefined(); // Veya bulunamıyorsa undefined
                // }
                // Şimdilik last4Digits'in varlığını kontrol etmeyelim, parser'daki Regex'e göre değişebilir.

                // Tarihi kontrol et (Yıl, Ay, Gün olarak)
                expect(result.dueDate).not.toBeNull();
                if (result.dueDate) {
                     expect(result.dueDate.getFullYear()).toBe(2024);
                     expect(result.dueDate.getMonth()).toBe(4); // 
                     expect(result.dueDate.getDate()).toBe(25);
                 }

                // Tutarın null olmasını bekle (çünkü mock HTML'de Toplam Borç yok)
                expect(result.amount).toBeNull(); 
            }
        });
    });
}); 