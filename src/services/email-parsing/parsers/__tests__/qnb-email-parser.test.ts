import { qnbEmailParser } from '../qnb-email-parser';
import { EmailDetails } from '../../../statement-parsing/types';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('QNB Email Parser', () => {
    const mockEmail: EmailDetails = {
        id: 'test-id',
        sender: 'eekstre@eekstre.qnb.com.tr',
        subject: 'QNB E-Ekstre',
        date: new Date('2026-01-15T10:00:00Z'),
        plainBody: null,
        htmlBody: '',
    };

    const mockHtmlPath = join(__dirname, 'mocks', 'qnb-ekstre-sample.html');
    const baseHtmlTemplate = readFileSync(mockHtmlPath, 'utf-8');

    it('should identify QNB emails', () => {
        expect(qnbEmailParser.canParse('eekstre@eekstre.qnb.com.tr', 'Subject', { plainBody: '', htmlBody: '' })).toBe(true);
        expect(qnbEmailParser.canParse('info@qnb.com', 'Subject', { plainBody: '', htmlBody: '' })).toBe(true);
        expect(qnbEmailParser.canParse('other@bank.com', 'Subject', { plainBody: '', htmlBody: '' })).toBe(false);
    });

    it('should parse valid QNB statement (Turkish format amount)', async () => {
        const html = baseHtmlTemplate
            .replace('1,119.55 TL', '1.250,50 TL')
            .replace('26/01/2026', '28/02/2026');

        const result = await qnbEmailParser.parse({ ...mockEmail, htmlBody: html });

        expect(result).not.toBeNull();
        expect(result?.bankName).toBe('QNB Finansbank');
        expect(result?.amount).toBe(1250.50);
        expect(result?.last4Digits).toBe('7890');
        expect(result?.dueDate).toEqual(new Date(2026, 1, 28, 12, 0, 0, 0));
    });

    it('should parse valid QNB statement (default template amount - 1,119.55)', async () => {
        const html = baseHtmlTemplate
            .replace('26/01/2026', '28/02/2026');

        const result = await qnbEmailParser.parse({ ...mockEmail, htmlBody: html });

        expect(result).not.toBeNull();
        expect(result?.amount).toBe(1119.55);
    });

     it('should parse valid QNB statement (Dot decimal amount - 123.45)', async () => {
        const html = baseHtmlTemplate
            .replace('1,119.55 TL', '123.45 TL')
            .replace('26/01/2026', '28/02/2026');

        const result = await qnbEmailParser.parse({ ...mockEmail, htmlBody: html });

        expect(result).not.toBeNull();
        expect(result?.amount).toBe(123.45);
    });
});