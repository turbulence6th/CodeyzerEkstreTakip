import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { garantiEmailParser } from '../garanti-email-parser';
import type { EmailDetails, DecodedEmailBody } from '../../../sms-parsing/types';

const mockHtmlTroyPath = path.resolve(__dirname, 'mocks/garanti-ekstre-troy.html');
const mockHtmlMastercardPath = path.resolve(__dirname, 'mocks/garanti-ekstre-mastercard.html');

describe('Garanti BBVA Email Parser', () => {
    let mockEmailDetails: EmailDetails;
    let mockDecodedBody: DecodedEmailBody;

    const createMockEmail = (htmlContent: string): EmailDetails => ({
        id: 'test-garanti-email-id',
        sender: 'garantibbva@garantibbva.com.tr',
        subject: 'Bonus Ekstresi (TL) - Ekim',
        date: new Date(2025, 9, 12),
        plainBody: null,
        htmlBody: htmlContent,
        originalResponse: {},
    });

    beforeEach(() => {
        mockDecodedBody = {
            plainBody: null,
            htmlBody: '',
        };

        mockEmailDetails = {
            id: 'test-garanti-email-id',
            sender: 'garantibbva@garantibbva.com.tr',
            subject: 'Bonus Ekstresi (TL) - Ekim',
            date: new Date(2025, 9, 12),
            plainBody: null,
            htmlBody: '',
            originalResponse: {},
        };
    });

    describe('canParse', () => {
        it('should return true for valid Garanti ekstre emails', () => {
            expect(garantiEmailParser.canParse(
                mockEmailDetails.sender,
                mockEmailDetails.subject,
                mockDecodedBody
            )).toBe(true);
        });

        it('should return false for incorrect sender', () => {
            expect(garantiEmailParser.canParse(
                'baska@banka.com',
                mockEmailDetails.subject,
                mockDecodedBody
            )).toBe(false);
        });

        it('should return false for incorrect subject', () => {
            expect(garantiEmailParser.canParse(
                mockEmailDetails.sender,
                'Farklı bir konu',
                mockDecodedBody
            )).toBe(false);
        });
    });

    describe('parse', () => {
        it('should correctly parse Troy format Garanti ekstre HTML', async () => {
            let mockHtmlContent: string;
            try {
                mockHtmlContent = fs.readFileSync(mockHtmlTroyPath, 'utf-8');
            } catch (error) {
                console.warn(`Skipping Troy test because mock file could not be read: ${mockHtmlTroyPath}`);
                return;
            }

            const mockEmail = createMockEmail(mockHtmlContent);
            const result = await garantiEmailParser.parse(mockEmail);
            expect(result).not.toBeNull();
            if (result) {
                expect(result.bankName).toBe('Garanti BBVA Bonus');
                expect(result.source).toBe('email');
                expect(result.last4Digits).toBe('0000');
                expect(result.dueDate).not.toBeNull();
                if (result.dueDate) {
                    expect(result.dueDate.getFullYear()).toBe(2025);
                    expect(result.dueDate.getMonth()).toBe(9); // Ekim (0-index)
                    expect(result.dueDate.getDate()).toBe(21);
                }
                expect(result.amount).toBe(616.80);
            }
        });

        it('should correctly parse Mastercard format Garanti ekstre HTML', async () => {
            let mockHtmlContent: string;
            try {
                mockHtmlContent = fs.readFileSync(mockHtmlMastercardPath, 'utf-8');
            } catch (error) {
                console.warn(`Skipping Mastercard test because mock file could not be read: ${mockHtmlMastercardPath}`);
                return;
            }

            const mockEmail = createMockEmail(mockHtmlContent);
            const result = await garantiEmailParser.parse(mockEmail);
            expect(result).not.toBeNull();
            if (result) {
                expect(result.bankName).toBe('Garanti BBVA Bonus');
                expect(result.source).toBe('email');
                expect(result.last4Digits).toBe('9999');
                expect(result.dueDate).not.toBeNull();
                if (result.dueDate) {
                    expect(result.dueDate.getFullYear()).toBe(2025);
                    expect(result.dueDate.getMonth()).toBe(11); // Aralık (0-index)
                    expect(result.dueDate.getDate()).toBe(15);
                }
                expect(result.amount).toBe(1234.56);
            }
        });

        it('should return null if HTML content is missing', async () => {
            const emailWithoutHtml: EmailDetails = { ...mockEmailDetails, htmlBody: null };
            const result = await garantiEmailParser.parse(emailWithoutHtml);
            expect(result).toBeNull();
        });
    });
}); 