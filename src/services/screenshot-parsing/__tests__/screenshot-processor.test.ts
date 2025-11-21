import { describe, it, expect, beforeEach } from 'vitest';
import { ScreenshotProcessor } from '../screenshot-processor';

describe('ScreenshotProcessor', () => {
    let processor: ScreenshotProcessor;

    beforeEach(() => {
        processor = new ScreenshotProcessor();
    });

    describe('initialization', () => {
        it('should initialize with available parsers', () => {
            const supportedBanks = processor.getSupportedBanks();
            expect(supportedBanks).toBeInstanceOf(Array);
            expect(supportedBanks.length).toBeGreaterThan(0);
            expect(supportedBanks).toContain('Akbank');
        });

        it('should have parser for Akbank', () => {
            expect(processor.hasParserForBank('Akbank')).toBe(true);
        });

        it('should not have parser for unsupported bank', () => {
            expect(processor.hasParserForBank('Deneme Bank')).toBe(false);
        });
    });

    describe('processScreenshot', () => {
        it('should successfully process Akbank screenshot', async () => {
            const text = `Akbank ****5678 38.222,22TL Son gün: 26 Kasım 1.234,56TL Ekstreni öde`;

            const result = await processor.processScreenshot(text);

            expect(result).not.toBeNull();
            expect(result?.bankName).toBe('Akbank');
            expect(result?.source).toBe('screenshot');
            expect(result?.amount).toBe(1234.56);
            expect(result?.last4Digits).toBe('5678');
        });

        it('should return null for empty text', async () => {
            const result = await processor.processScreenshot('');
            expect(result).toBeNull();
        });

        it('should return null for unrecognized bank', async () => {
            const text = `
                Some Random Bank
                Statement Date: 15.12.2024
                Amount: 1000 TL
            `;

            const result = await processor.processScreenshot(text);
            expect(result).toBeNull();
        });

        it('should handle text with only bank name but no statement data', async () => {
            const text = `
                AKBANK
                Hoş Geldiniz
                Hesap Özeti
            `;

            const result = await processor.processScreenshot(text);
            // canParse false döneceği için null olmalı
            expect(result).toBeNull();
        });

        it('should process screenshot with imageUri', async () => {
            const text = `Akbank ****1234 12.345,67TL Son gün: 20 Aralık 5.000,00TL Ekstreni öde`;
            const imageUri = 'file:///storage/screenshots/test.jpg';

            const result = await processor.processScreenshot(text, imageUri);

            expect(result).not.toBeNull();
            expect(result?.originalMessage).toHaveProperty('imageUri', imageUri);
            expect(result?.originalMessage).toHaveProperty('extractedText', text);
        });

        it('should handle case-insensitive bank detection', async () => {
            const text = `akbank ****9999 10.000,00TL son gün: 15 Aralık 2.500,00tl ekstreni öde`;

            const result = await processor.processScreenshot(text);

            expect(result).not.toBeNull();
            expect(result?.bankName).toBe('Akbank');
        });
    });

    describe('getSupportedBanks', () => {
        it('should return array of bank names', () => {
            const banks = processor.getSupportedBanks();
            expect(banks).toBeInstanceOf(Array);
            expect(banks).toContain('Akbank');
        });
    });

    describe('hasParserForBank', () => {
        it('should return true for supported bank', () => {
            expect(processor.hasParserForBank('Akbank')).toBe(true);
        });

        it('should return false for unsupported bank', () => {
            expect(processor.hasParserForBank('NonExistent Bank')).toBe(false);
        });

        it('should be case-insensitive', () => {
            expect(processor.hasParserForBank('akbank')).toBe(true);
            expect(processor.hasParserForBank('AKBANK')).toBe(true);
            expect(processor.hasParserForBank('AkBaNk')).toBe(true);
        });
    });
});
