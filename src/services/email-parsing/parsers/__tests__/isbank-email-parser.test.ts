import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isbankEmailParser } from '../isbank-email-parser';
import type { EmailDetails, ParsedStatement } from '../../../sms-parsing/types';
import type { ParsePdfResult } from '../../../../plugins/pdf-parser/definitions';

// --- Mocking Dependencies --- //

// Mock gmailService
vi.mock('../../../index', () => ({
  gmailService: {
    getAttachment: vi.fn(),
  },
}));

// Mock PdfParser plugin
vi.mock('../../../../plugins/pdf-parser', () => ({
  PdfParser: {
    parsePdfText: vi.fn(),
  },
}));

// Import mocks after mocking
import { gmailService } from '../../../index';
import { PdfParser } from '../../../../plugins/pdf-parser';


describe('IsbankEmailParser', () => {

  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // --- Test Data --- //

  const mockPdfText = `
    Some irrelevant text before.
    Another line.
    0000********0000
    More text.
    Son Ödeme Tarihi: 22.07.2025
    Random data in between.
    Hesap Özeti Borcu: 2.001,44 TL
    Some footer text.
  `;

  const mockBase64PdfData = 'dGVzdF9wZGZfY29udGVudA=='; // Dummy base64 data

  const sampleEmail: EmailDetails = {
    id: 'isbank-test-123',
    sender: 'Ad Soyad <bilgilendirme@ileti.isbank.com.tr>',
    subject: '1234 **** **** 5678 - Temmuz 2025 Maximum Kredi Kartı Hesap Özeti',
    date: new Date(2025, 6, 10), // Irrelevant for parsing, but needed for type
    plainBody: null,
    htmlBody: null,
    // Mock the structure indicating a PDF attachment
    originalResponse: {
      payload: {
        parts: [
          { mimeType: 'text/plain', body: { size: 100 } },
          {
            mimeType: 'application/pdf',
            filename: 'hesap_ozeti_isbank.pdf',
            body: { attachmentId: 'att-isbank-pdf-1' },
          },
        ],
      },
    },
  };

   const expectedDate = new Date(Date.UTC(2025, 6, 22)); // July 22, 2025 (Month is 0-indexed)

  const expectedStatement: Omit<ParsedStatement, 'originalMessage'> = {
    bankName: 'İş Bankası',
    dueDate: expectedDate,
    amount: 2001.44,
    source: 'email', // Source should be 'email' according to the updated parser logic
  };

  // --- Happy Path Test --- //

  it('should parse statement correctly when PDF attachment is present and valid', async () => {
    // Arrange: Setup mock implementations
    vi.mocked(gmailService.getAttachment).mockResolvedValue({ data: mockBase64PdfData });

    const mockParseResult: ParsePdfResult = {
      text: mockPdfText,
    };
    vi.mocked(PdfParser.parsePdfText).mockResolvedValue(mockParseResult);

    // Act: Call the parse method
    const result = await isbankEmailParser.parse(sampleEmail);

    // Assert: Check the results
    expect(result).not.toBeNull();
    expect(result?.bankName).toBe(expectedStatement.bankName);
    expect(result?.amount).toBe(expectedStatement.amount);
    // Compare date timestamps for reliable comparison
    expect(result?.dueDate?.getTime()).toBe(expectedStatement.dueDate.getTime());
    expect(result?.source).toBe(expectedStatement.source);
    // Check original message is passed correctly
    expect(result?.originalMessage).toEqual(sampleEmail);

    // Verify mocks were called
    expect(gmailService.getAttachment).toHaveBeenCalledOnce();
    expect(gmailService.getAttachment).toHaveBeenCalledWith(sampleEmail.id, 'att-isbank-pdf-1');
    expect(PdfParser.parsePdfText).toHaveBeenCalledOnce();
    expect(PdfParser.parsePdfText).toHaveBeenCalledWith({ base64Data: mockBase64PdfData });
  });
}); 