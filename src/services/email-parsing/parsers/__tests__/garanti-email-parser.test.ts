import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { garantiEmailParser } from '../garanti-email-parser';
import type { EmailDetails, DecodedEmailBody } from '../../../sms-parsing/types';

const mockHtmlPath = path.resolve(__dirname, 'mocks/garanti-ekstre-sample.html');

describe('Garanti BBVA Email Parser', () => {
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
            id: 'test-garanti-email-id',
            sender: 'garantibbva@garantibbva.com.tr',
            subject: 'Bonus Ekstresi (TL) - Ekim',
            date: new Date(2025, 9, 12),
            plainBody: null,
            htmlBody: mockHtmlContent,
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
        it('should correctly parse the mock Garanti ekstre HTML', async () => {
            if (!mockHtmlContent) {
                console.warn(`Skipping parse test because mock file could not be read: ${mockHtmlPath}`);
                return;
            }
            const result = await garantiEmailParser.parse(mockEmailDetails);
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

        it('should return null if HTML content is missing', async () => {
            const emailWithoutHtml: EmailDetails = { ...mockEmailDetails, htmlBody: null };
            const result = await garantiEmailParser.parse(emailWithoutHtml);
            expect(result).toBeNull();
        });
    });
}); 