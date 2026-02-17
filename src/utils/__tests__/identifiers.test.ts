import { generateAppId } from '../identifiers';
import type { ParsedStatement, EmailDetails } from '../../services/statement-parsing/types';
import type { ManualEntry } from '../../types/manual-entry.types';
import { BANK_NAMES } from '../../services/bank-registry';

// Ortak mock veriler
const mockEmail: EmailDetails = {
    id: 'test-email-id',
    sender: 'test@example.com',
    subject: 'Test Subject',
    plainBody: 'test body',
    htmlBody: null,
    date: new Date()
};

describe('generateAppId Utility Function', () => {

    it('should generate a correct AppID for a statement', () => {
        const statement: ParsedStatement = {
            bankName: BANK_NAMES.YAPI_KREDI,
            dueDate: new Date('2024-07-15T12:00:00Z'),
            amount: 1500.75,
            last4Digits: '1234',
            originalMessage: mockEmail,
            source: 'email',
            entryType: 'debt',
        };
        const appId = generateAppId(statement);
        expect(appId).toBe('[AppID: ekstre_yapi_kredi_2024-07-15]');
    });

    it('should generate a correct AppID for a manual entry', () => {
        const manualEntry: ManualEntry = {
            id: 'manual-123',
            description: 'Kira Ödemesi',
            amount: 2500,
            dueDate: new Date('2024-07-20T12:00:00Z'),
            source: 'manual',
            entryType: 'expense',
        };
        const appId = generateAppId(manualEntry);
        expect(appId).toBe('[AppID: manuel_kiraodemesi_2024-07-20]');
    });

    it('should generate ekstre AppID for screenshot-imported bank entries', () => {
        // Screenshot'tan eklenen banka kaydı (format: "BankaAdı - ****XXXX")
        const screenshotEntry: ManualEntry = {
            id: 'manual-456',
            description: 'Akbank - ****1234',
            amount: 2500,
            dueDate: new Date('2024-07-15T12:00:00Z'),
            source: 'manual',
            entryType: 'debt',
        };
        const appId = generateAppId(screenshotEntry);
        // Email kaydı ile aynı AppID üretmeli
        expect(appId).toBe('[AppID: ekstre_akbank_2024-07-15]');
    });

    it('should generate same AppID for manual bank entry and email entry with same bank/date', () => {
        // Email kaydı
        const emailStatement: ParsedStatement = {
            bankName: BANK_NAMES.AKBANK,
            dueDate: new Date('2024-07-15T12:00:00Z'),
            amount: 2500,
            last4Digits: '1234',
            originalMessage: mockEmail,
            source: 'email',
            entryType: 'debt',
        };

        // Aynı banka için screenshot'tan eklenen manuel kayıt
        const manualEntry: ManualEntry = {
            id: 'manual-789',
            description: 'Akbank - ****1234',
            amount: 2500,
            dueDate: new Date('2024-07-15T12:00:00Z'),
            source: 'manual',
            entryType: 'debt',
        };

        const emailAppId = generateAppId(emailStatement);
        const manualAppId = generateAppId(manualEntry);

        // Her iki kaynak da aynı AppID'yi üretmeli
        expect(emailAppId).toBe(manualAppId);
    });

    it('should not use ekstre format for non-bank manual entries', () => {
        const manualEntry: ManualEntry = {
            id: 'manual-abc',
            description: 'Market Alışverişi',
            amount: 500,
            dueDate: new Date('2024-07-20T12:00:00Z'),
            source: 'manual',
            entryType: 'expense',
        };
        const appId = generateAppId(manualEntry);
        expect(appId).toBe('[AppID: manuel_marketalisverisi_2024-07-20]');
    });

}); 