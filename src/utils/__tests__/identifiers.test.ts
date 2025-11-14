import { generateAppId } from '../identifiers';
import type { ParsedStatement, SmsDetails } from '../../services/sms-parsing/types';
import type { ManualEntry } from '../../types/manual-entry.types';

// Ortak mock veriler
const mockSms: SmsDetails = { sender: 'test', body: 'test body', date: Date.now() };

describe('generateAppId Utility Function', () => {

    it('should generate a correct AppID for a statement', () => {
        const statement: ParsedStatement = {
            bankName: 'Yapı Kredi',
            dueDate: new Date('2024-07-15T12:00:00Z'),
            amount: 1500.75,
            last4Digits: '1234',
            originalMessage: { sender: 'YAPIKREDI', body: 'Test', date: Date.now() },
            source: 'sms',
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

}); 