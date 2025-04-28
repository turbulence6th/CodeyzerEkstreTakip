import { generateAppId } from '../identifiers';
import type { ParsedStatement, ParsedLoan, SmsDetails, EmailDetails } from '../../services/sms-parsing/types';
import type { ManualEntry } from '../../types/manual-entry.types';

// Ortak mock veriler
const mockSms: SmsDetails = { sender: 'test', body: 'test body', date: Date.now() };

describe('generateAppId Utility Function', () => {

    it('should generate correct AppID for ParsedStatement', () => {
        const statement: ParsedStatement = {
            bankName: 'Yapı Kredi', // Test Turkish chars and space
            dueDate: new Date(2024, 6, 15), // July 15, 2024 (month is 0-indexed)
            amount: 1234.56,
            last4Digits: '9876',
            originalMessage: mockSms,
            source: 'sms'
        };
        const expectedAppId = '[AppID: ekstre_yapi_kredi_2024-07-15]';
        expect(generateAppId(statement)).toEqual(expectedAppId);
    });

    it('should generate correct AppID for ParsedLoan (without installment)', () => {
        const loan: ParsedLoan = {
            bankName: 'Garanti BBVA',
            loanAmount: 15000,
            installmentAmount: 1500.50,
            termMonths: 12,
            firstPaymentDate: new Date(2024, 7, 1), // August 1, 2024
            originalMessage: mockSms,
            source: 'sms'
        };
        const expectedAppId = '[AppID: kredi_garanti_bbva_2024-08-01]';
        expect(generateAppId(loan)).toEqual(expectedAppId);
    });

    it('should generate correct AppID for ManualEntry', () => {
        const manualEntry: ManualEntry = {
            id: 'manual-123',
            description: 'İş Bankası Ekstre Ödemesi!', // Test Turkish chars, space, punctuation
            amount: 999.99,
            dueDate: new Date(2024, 11, 25), // December 25, 2024
            source: 'manual'
        };
        const expectedAppId = '[AppID: manuel_isbankasiekstreodemesi_2024-12-25]';
        expect(generateAppId(manualEntry)).toEqual(expectedAppId);
    });

}); 