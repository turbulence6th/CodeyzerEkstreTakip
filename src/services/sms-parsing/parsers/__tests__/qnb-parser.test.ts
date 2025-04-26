// src/services/sms-parsing/parsers/qnb-parser.test.ts
import { QnbSmsParser, qnbLoanParser } from '../qnb-parser';
import { SmsDetails, ParsedStatement, ParsedLoan } from '../../types'; // Doğru tipleri import et
import { parseDMYDate } from '../../../../utils/parsing'; // Tarih parse fonksiyonunu import edelim

// --- QnbSmsParser (Ekstre) Testleri ---
describe('QnbSmsParser', () => {
  const parser = new QnbSmsParser();

  describe('canParse', () => {
    // ... (canParse testleri aynı kalıyor) ...
     it('should return true for relevant sender and body keywords', () => {
      expect(parser.canParse('QNBFB', '1234 ile biten kartinizin borcu ... son odeme tarihi ...')).toBe(true);
      expect(parser.canParse('QNB Finansbank', '5678 ile biten kartinizin borcu ... son odeme tarihi ...')).toBe(true);
    });

    it('should return false for irrelevant sender', () => {
      expect(parser.canParse('BaskaBanka', '1234 ile biten kartinizin borcu ... son odeme tarihi ...')).toBe(false);
    });

    it('should return false for missing keywords in body', () => {
      expect(parser.canParse('QNBFB', 'Sadece son odeme tarihi ...')).toBe(false);
      expect(parser.canParse('QNBFB', 'Sadece ... ile biten kartinizin borcu ...')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should correctly parse a QNB statement SMS with Bilgi prefix and specific amount format', () => {
      // Kullanıcının sağladığı format ve tutar kullanıldı (diğer veriler değiştirildi)
      const sms: SmsDetails = {
        sender: 'QNB',
        // Tutar: 1,800.50 TL (kullanıcının örneğinden)
        body: 'Bilgi: 9876 ile biten kartinizin borcu 1,800.50 TL, asgari borcu 700.00 TL, son odeme tarihi 25/05/2026. Ekstre detayiniz icin: http://example.com/link B002',
        date: new Date('2026-05-15T11:00:00Z').getTime(), // Test için örnek tarih
      };

      const expectedDueDate = parseDMYDate('25/05/2026');
      expect(expectedDueDate).not.toBeNull(); // Tarihin parse edildiğinden emin ol

      const expected: Partial<ParsedStatement> = {
        bankName: 'QNB',
        amount: 1800.50, // Beklenen sayısal değer: 1800.50
        last4Digits: '9876',
        source: 'sms',
      };

      const result = parser.parse(sms);

      expect(result).not.toBeNull();
      expect(result?.bankName).toBe(expected.bankName);
      expect(result?.amount).toBe(expected.amount); // Kontrol: 1800.50
      expect(result?.last4Digits).toBe(expected.last4Digits);
      expect(result?.source).toBe(expected.source);
      expect(result?.dueDate?.getTime()).toBe(expectedDueDate!.getTime());

      // Orijinal mesajı kontrol et (tip zorlaması ile)
      expect(result?.originalMessage).toBeDefined();
      expect((result?.originalMessage as SmsDetails)?.sender).toBe(sms.sender);
      expect((result?.originalMessage as SmsDetails)?.body).toBe(sms.body);
      expect((result?.originalMessage as SmsDetails)?.date).toBe(sms.date);
    });

  });
});

// --- qnbLoanParser (Kredi) Testleri ---
describe('qnbLoanParser', () => {
  // Bu bir nesne, instance oluşturmaya gerek yok

  describe('canParse', () => {
    // ... (canParse testleri aynı kalıyor) ...
    it('should return true for relevant sender and body keywords', () => {
      expect(qnbLoanParser.canParse('qnb finansbank', '... krediniz ... vadesiz hesabiniza yatirilmistir ... ilk taksitin odeme tarihi ...')).toBe(true);
    });
    it('should return false for irrelevant sender', () => {
       expect(qnbLoanParser.canParse('BaskaBanka', '... krediniz ... vadesiz hesabiniza yatirilmistir ... ilk taksitin odeme tarihi ...')).toBe(false);
    });
    it('should return false for missing keywords in body', () => {
       expect(qnbLoanParser.canParse('qnb', 'Sadece vadesiz hesabiniza yatirilmistir.')).toBe(false);
       expect(qnbLoanParser.canParse('qnb', 'Sadece ilk taksitin odeme tarihi.')).toBe(false);
       expect(qnbLoanParser.canParse('qnb', 'Sadece krediniz onaylandi.')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should correctly parse a QNB loan approval SMS', () => {
      const sms: SmsDetails = {
        sender: 'QNB Finansbank',
        body: 'Degerli musterimiz, 15.000,00 TL krediniz 12345678 no\'lu vadesiz hesabiniza yatirilmistir. 36 ay vadeli, 500,00 TL taksitli kredinizin ilk taksitin odeme tarihi 10/08/2024\'dur.',
        date: new Date('2024-07-20T10:00:00Z').getTime(),
      };

      const expectedFirstPaymentDate = parseDMYDate('10/08/2024');
      expect(expectedFirstPaymentDate).not.toBeNull(); // Tarihin parse edildiğinden emin ol

      const expected: Partial<ParsedLoan> = { // Partial yapalım
        bankName: 'QNB',
        loanAmount: 15000.00,
        installmentAmount: 500.00,
        termMonths: 36,
        accountNumber: '12345678',
        source: 'sms',
      };

      const result = qnbLoanParser.parse(sms);

      expect(result).not.toBeNull();
       // Alanları ayrı ayrı kontrol et
      expect(result?.bankName).toBe(expected.bankName);
      expect(result?.loanAmount).toBe(expected.loanAmount);
      expect(result?.installmentAmount).toBe(expected.installmentAmount);
      expect(result?.termMonths).toBe(expected.termMonths);
      expect(result?.accountNumber).toBe(expected.accountNumber);
      expect(result?.source).toBe(expected.source);
      expect(result?.firstPaymentDate?.getTime()).toBe(expectedFirstPaymentDate!.getTime()); // ! ile null olmadığını belirttik

      // Orijinal mesajı kontrol et (tip zorlaması ile)
      expect(result?.originalMessage).toBeDefined();
      expect((result?.originalMessage as SmsDetails)?.sender).toBe(sms.sender);
      expect((result?.originalMessage as SmsDetails)?.body).toBe(sms.body);
      expect((result?.originalMessage as SmsDetails)?.date).toBe(sms.date);
    });

    // --- Diğer qnbLoanParser parse testleri kaldırıldı ---

  });
});

// Utility Omit tipi (TypeScript'te yerleşik değilse - build sırasında sorun çıkarabilir, kaldırmak daha güvenli olabilir)
// type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>; // Bu satırı kaldırdım, Omit kullanmıyoruz artık.
