import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { akbankEmailParser } from '../akbank-email-parser';
import type { EmailDetails, DecodedEmailBody } from '../../../statement-parsing/types';

const mockHtmlPath = path.resolve(__dirname, 'mocks/akbank-ekstre-sample.html');

describe('Akbank Email Parser', () => {
    let mockHtmlContent: string;
    let mockEmailDetails: EmailDetails;
    let mockDecodedBody: DecodedEmailBody;

    beforeEach(() => {
        try {
            mockHtmlContent = fs.readFileSync(mockHtmlPath, 'utf-8');
        } catch (error) {
            console.error(`Error reading mock file at ${mockHtmlPath}:`, error);
            mockHtmlContent = '';
        }

        mockDecodedBody = {
            plainBody: null,
            htmlBody: mockHtmlContent,
        };

        mockEmailDetails = {
            id: 'test-akbank-email-id',
            sender: 'HIZMET@bilgi.akbank.com',
            subject: 'Kredi kartı ekstre bilgileri',
            date: new Date(2025, 4, 24),
            plainBody: null,
            htmlBody: mockHtmlContent,
            originalResponse: {},
        };
    });

    describe('canParse', () => {
        it('should return true for valid Akbank ekstre emails', () => {
            expect(akbankEmailParser.canParse(
                mockEmailDetails.sender,
                mockEmailDetails.subject,
                mockDecodedBody
            )).toBe(true);
        });

        it('should return false for incorrect sender', () => {
            expect(akbankEmailParser.canParse(
                'baska@banka.com',
                mockEmailDetails.subject,
                mockDecodedBody
            )).toBe(false);
        });

        it('should return false for incorrect subject', () => {
            expect(akbankEmailParser.canParse(
                mockEmailDetails.sender,
                'Farklı bir konu',
                mockDecodedBody
            )).toBe(false);
        });
    });

    describe('parse', () => {
        it('should correctly parse the mock Akbank ekstre HTML', async () => {
            if (!mockHtmlContent) {
                console.warn(`Skipping parse test because mock file could not be read: ${mockHtmlPath}`);
                return;
            }
            const result = await akbankEmailParser.parse(mockEmailDetails);
            expect(result).not.toBeNull();
            if (result) {
                expect(result.bankName).toBe('Akbank');
                expect(result.source).toBe('email');
                expect(result.last4Digits).toBe('0000');
                expect(result.dueDate).not.toBeNull();
                if (result.dueDate) {
                    expect(result.dueDate.getFullYear()).toBe(2025);
                    expect(result.dueDate.getMonth()).toBe(4); // Mayıs (0-index)
                    expect(result.dueDate.getDate()).toBe(26);
                }
                expect(result.amount).toBe(2022.95);
            }
        });

        it('should return null if HTML content is missing', async () => {
            const emailWithoutHtml: EmailDetails = { ...mockEmailDetails, htmlBody: null };
            const result = await akbankEmailParser.parse(emailWithoutHtml);
            expect(result).toBeNull();
        });
    });
}); 