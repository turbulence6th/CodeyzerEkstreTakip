import { GarantiParser, garantiLoanParser } from '../garanti-parser';
import type { SmsDetails, ParsedStatement, ParsedLoan } from '../../types';

describe('Garanti Parser Tests', () => {

  const garantiBonusStatementParser = new GarantiParser();

  describe('GarantiParser (Bonus Statement)', () => {
    it('should correctly parse a standard Bonus statement SMS', () => {
      const testDate = Date.now();
      const sms: SmsDetails = {
        sender: 'BONUS',
        body: 'Degerli musterimiz, 0000 ile biten kartinizin 2,120.76 TL ekstresinin minimum tutarini odeyip, kalan kismini aylik %3.50 faizle (vergiler haric) 1 ay ertelemek icin 01.05.2025 tarihine kadar ATLAT yazip kartinizin son 6 hanesini 3340\'a gonderin. SMS almamak icin IPT yazip 3342\'ye ucretsiz gonderin. Mersis:0879001756600379 B001',
        date: testDate,
      };

      const expectedDueDate = new Date(2025, 4, 2);

      // Burada Omit kullanmak yerine beklenen nesneyi tam olarak tanımlayalım
      // minimumPayment alanı ParsedStatement'ta opsiyonel olduğu için belirtmezsek sorun olmaz.
      const expectedResult: ParsedStatement = {
        bankName: 'Garanti BBVA Bonus',
        last4Digits: '0000',
        amount: 2120.76,
        dueDate: expectedDueDate,
        originalMessage: sms, // originalMessage'ı da doğrudan ekleyelim
        source: 'sms',
        isPaid: false, // Varsayılan olarak isPaid ekleyelim
        entryType: 'debt', // entryType ekleyelim
      };

      const result = garantiBonusStatementParser.parse(sms);

      expect(result).not.toBeNull();

      // Tüm nesneyi doğrudan karşılaştıralım
      // Date nesneleri için direkt karşılaştırma sorunlu olabileceğinden
      // önce diğer alanları kontrol edip sonra tarihi ayrı kontrol edebiliriz.
      if (result) {
          expect(result.bankName).toEqual(expectedResult.bankName);
          expect(result.last4Digits).toEqual(expectedResult.last4Digits);
          expect(result.amount).toEqual(expectedResult.amount);
          expect(result.source).toEqual(expectedResult.source);
          expect(result.originalMessage).toEqual(expectedResult.originalMessage);
          // Tarihleri ISO string olarak karşılaştırmak daha güvenilir
          expect(result.dueDate.toISOString()).toEqual(expectedResult.dueDate.toISOString());
      }
    });

    // TODO: Add more test cases for GarantiParser (Bonus Statement)
  });

  describe('garantiLoanParser', () => {
      it('should correctly parse a standard loan approval SMS', () => {
          const testDate = Date.now();
          const sms: SmsDetails = {
            sender: 'Garantibbva',
            body: 'Degerli musterimiz, 15.000 TL tutarinda 12 ay vadeli ihtiyac krediniz hesabiniza aktarilmis, kullaniminiza acilmistir. Saglikli gunlerde kullanmanizi dileriz. Mersis:0879001756600379 B001',
            date: testDate,
          };

          const expectedResult: ParsedLoan = {
              bankName: 'Garanti BBVA',
              loanAmount: 15000,
              termMonths: 12,
              installmentAmount: null,
              firstPaymentDate: null,
              accountNumber: undefined,
              originalMessage: sms,
              source: 'sms',
              entryType: 'debt',
          };

          const result = garantiLoanParser.parse(sms);
          expect(result).not.toBeNull();
          expect(result).toEqual(expectedResult); // Tüm nesneyi karşılaştır
      });

    // TODO: Add more test cases for garantiLoanParser
  });

});
