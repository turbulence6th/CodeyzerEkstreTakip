// src/services/sms-parsing/parsers/qnb-parser.test.ts
import { QnbSmsParser } from '../qnb-parser';
import { SmsDetails, ParsedStatement } from '../../types'; // Doğru tipleri import et
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
