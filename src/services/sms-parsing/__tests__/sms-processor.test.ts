import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatementProcessor, availableBankProcessors } from '../sms-processor';
import { GmailService } from '../../gmail.service';
import { ziraatEmailParser } from '../../email-parsing/parsers/ziraat-email-parser';
import type { ParsedStatement, EmailDetails } from '../types';

// Dış bağımlılıkları mock'la
vi.mock('@plugins/sms-reader', () => ({
  SmsReader: {
    checkPermissions: vi.fn().mockResolvedValue({ readSms: 'denied' }), // Testin SMS kısmını devre dışı bırak
  },
}));
vi.mock('../../gmail.service');
vi.mock('../../email-parsing/parsers/ziraat-email-parser');

describe('StatementProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Her testten önce mock'ları temizle
  });

  it('should process multiple cards from the same bank and deduplicate correctly', async () => {
    // --- ARRANGE (Hazırlık) ---
    const createMockEmailDetails = (id: string, date: Date): EmailDetails => ({
        id,
        date,
        sender: 'mock-sender@ziraat.com.tr',
        subject: 'mock e-ekstre',
        plainBody: 'mock plain body',
        htmlBody: '<p>mock html body</p>',
        originalResponse: {},
    });

    // 1. Sahte parser'ımızın döndüreceği mock ekstreleri tanımla
    const statementCard1_new: ParsedStatement = {
      bankName: 'Ziraat Bankası',
      last4Digits: '1111',
      amount: 1000,
      dueDate: new Date('2025-05-15'),
      source: 'email',
      entryType: 'debt',
      originalMessage: createMockEmailDetails('email1', new Date('2025-05-02')),
    };

    const statementCard1_old: ParsedStatement = {
      bankName: 'Ziraat Bankası',
      last4Digits: '1111',
      amount: 900,
      dueDate: new Date('2025-04-15'),
      source: 'email',
      entryType: 'debt',
      originalMessage: createMockEmailDetails('email3', new Date('2025-04-02')),
    };

    const statementCard2: ParsedStatement = {
      bankName: 'Ziraat Bankası',
      last4Digits: '2222',
      amount: 2500,
      dueDate: new Date('2025-05-20'),
      source: 'email',
      entryType: 'debt',
      originalMessage: createMockEmailDetails('email2', new Date('2025-05-03')),
    };

    // 2. GmailService'in sahte (mock) uygulamasını ayarla
    const mockGmailService = vi.mocked(GmailService, true);
    const ziraatProcessor = availableBankProcessors.find(p => p.bankName === 'Ziraat Bankası');
    
    mockGmailService.prototype.searchEmails.mockImplementation(async (query) => {
        if (query === ziraatProcessor?.gmailQuery) {
            // Ziraat sorgusu geldiğinde 3 e-posta ID'si ve threadId'si döndür
            return { messages: [
                { id: 'email1', threadId: 'thread1' }, 
                { id: 'email2', threadId: 'thread2' }, 
                { id: 'email3', threadId: 'thread3' }
            ] };
        }
        return { messages: [] };
    });

    mockGmailService.prototype.getEmailDetails.mockImplementation(async (id: string) => ({
        id,
        payload: { headers: [] }, // Parser'ın çalışması için minimal bir nesne
    } as any));

    mockGmailService.prototype.decodeEmailBody.mockReturnValue({ htmlBody: 'body', plainBody: 'body' });

    // 3. Ziraat parser'ının sahte uygulamasını ayarla
    const mockZiraatParser = vi.mocked(ziraatEmailParser);
    mockZiraatParser.canParse.mockResolvedValue(true);
    mockZiraatParser.parse.mockImplementation(async (email: EmailDetails) => {
      if (email.id === 'email1') return statementCard1_new;
      if (email.id === 'email2') return statementCard2;
      if (email.id === 'email3') return statementCard1_old;
      return null;
    });

    // --- ACT (Çalıştırma) ---
    const statementProcessor = new StatementProcessor();
    const finalStatements = await statementProcessor.fetchAndParseStatements();

    // --- ASSERT (Doğrulama) ---

    // Sonuçta 2 ekstre olmalı (eski olan elenmeli)
    expect(finalStatements).toHaveLength(2);

    // '1111' nolu kart için en yeni ekstrenin (1000 TL) tutulduğunu kontrol et
    const resultCard1 = finalStatements.find(s => s.last4Digits === '1111');
    expect(resultCard1).toBeDefined();
    expect(resultCard1?.amount).toBe(1000);
    expect((resultCard1?.originalMessage as EmailDetails).id).toBe('email1');

    // '2222' nolu kart için ekstrenin listede olduğunu kontrol et
    const resultCard2 = finalStatements.find(s => s.last4Digits === '2222');
    expect(resultCard2).toBeDefined();
    expect(resultCard2?.amount).toBe(2500);

    // Son ödeme tarihine göre doğru sıralandığını kontrol et (en yeni en üstte)
    expect(finalStatements[0].last4Digits).toBe('2222'); // Son ödeme: 20 Mayıs
    expect(finalStatements[1].last4Digits).toBe('1111'); // Son ödeme: 15 Mayıs
  });
});
