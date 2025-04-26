import { describe, it, expect } from 'vitest';
import { KuveytTurkSmsParser } from '../kuveytturk-parser';
import type { SmsDetails, ParsedStatement } from '../../types'; 
import { parseDottedDate } from '../../../../utils/parsing';

describe('KuveytTurkSmsParser', () => {
    const parser = new KuveytTurkSmsParser();

    // --- canParse Testleri ---
    describe('canParse', () => {
        it('should return true for relevant sender and body keywords', () => {
            const body = "6071 ile biten kartinizin ekstresi kesildi. Son Odeme Tarihi: 10.02.2025";
            expect(parser.canParse('KUVEYT TURK', body)).toBe(true);
            expect(parser.canParse('kuveyt turk', body)).toBe(true); // Küçük harf kontrolü
        });

        it('should return false for irrelevant sender', () => {
             const body = "6071 ile biten kartinizin ekstresi kesildi. Son Odeme Tarihi: 10.02.2025";
            expect(parser.canParse('BaskaBanka', body)).toBe(false);
        });

        it('should return false for missing keywords in body', () => {
            expect(parser.canParse('KUVEYT TURK', 'Sadece ekstresi kesildi')).toBe(false);
            expect(parser.canParse('KUVEYT TURK', 'Sadece Son Odeme Tarihi: 10.02.2025')).toBe(false);
        });
    });

    // --- parse Testleri --- (Sadece Happy Path)
    describe('parse', () => {
        it('should correctly parse the provided Kuveyt Türk ekstre SMS', () => {
            const sms: SmsDetails = {
                sender: 'KUVEYT TURK',
                body: "Degerli musterimiz, 0000 ile biten kartinizin ekstresi kesildi. \nToplam Borc: 1.492,42 TL \nAsgari Odeme Tutari: 1.492,42 TL \nSon Odeme Tarihi: 10.02.2025 \nKuveyt Turk Mobil uygulamanizdan ya da Cagri Merkezi 444 0 123'u arayarak ayrintili bilgi alabilirsiniz. B002",
                date: new Date('2025-01-25T10:00:00Z').getTime(),
            };

            const result = parser.parse(sms);

            // Sonucun null olmadığını kontrol et
            expect(result).not.toBeNull();

            // Beklenen değerleri tanımla
            const expectedDueDate = parseDottedDate('10.02.2025');
            expect(expectedDueDate).not.toBeNull(); // Tarih helper'ının çalıştığından emin ol

            if (result) {
                expect(result.bankName).toBe('Kuveyt Türk');
                expect(result.source).toBe('sms');
                expect(result.last4Digits).toBe('0000');
                
                // Tarihi kontrol et
                expect(result.dueDate?.getTime()).toBe(expectedDueDate!.getTime());

                // Tutarı kontrol et
                expect(result.amount).toBe(1492.42);
                
                // Orijinal mesajın saklandığını kontrol et
                expect(result.originalMessage).toEqual(sms);
            }
        });
    });
}); 