import { BANK_NAMES, isKnownBankName, getKnownBankMatchPatterns } from '../bank-registry';

describe('bank-registry', () => {
  describe('BANK_NAMES', () => {
    it('should contain all expected bank names', () => {
      expect(BANK_NAMES.AKBANK).toBe('Akbank');
      expect(BANK_NAMES.YAPI_KREDI).toBe('Yapı Kredi');
      expect(BANK_NAMES.ZIRAAT).toBe('Ziraat Bankası');
      expect(BANK_NAMES.GARANTI).toBe('Garanti BBVA Bonus');
      expect(BANK_NAMES.KUVEYT_TURK).toBe('Kuveyt Türk');
      expect(BANK_NAMES.IS_BANKASI).toBe('İş Bankası');
      expect(BANK_NAMES.QNB).toBe('QNB Finansbank');
    });
  });

  describe('getKnownBankMatchPatterns', () => {
    it('should return an array of lowercase patterns', () => {
      const patterns = getKnownBankMatchPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach(p => {
        expect(p).toBe(p.toLowerCase());
      });
    });

    it('should include canonical names and aliases', () => {
      const patterns = getKnownBankMatchPatterns();
      expect(patterns).toContain('akbank');
      expect(patterns).toContain('yapı kredi');
      expect(patterns).toContain('yapikredi');
      expect(patterns).toContain('ziraat');
      expect(patterns).toContain('garanti');
      expect(patterns).toContain('kuveyt türk');
      expect(patterns).toContain('kuveytturk');
      expect(patterns).toContain('iş bankası');
      expect(patterns).toContain('isbank');
      expect(patterns).toContain('qnb');
      expect(patterns).toContain('finansbank');
    });
  });

  describe('isKnownBankName', () => {
    it('should return true for exact canonical bank names', () => {
      expect(isKnownBankName('Akbank')).toBe(true);
      expect(isKnownBankName('Yapı Kredi')).toBe(true);
      expect(isKnownBankName('Ziraat Bankası')).toBe(true);
      expect(isKnownBankName('Garanti BBVA Bonus')).toBe(true);
      expect(isKnownBankName('Kuveyt Türk')).toBe(true);
      expect(isKnownBankName('İş Bankası')).toBe(true);
      expect(isKnownBankName('QNB Finansbank')).toBe(true);
    });

    it('should return true for aliases (case insensitive)', () => {
      expect(isKnownBankName('yapikredi')).toBe(true);
      expect(isKnownBankName('AKBANK')).toBe(true);
      expect(isKnownBankName('isbank')).toBe(true);
      expect(isKnownBankName('kuveytturk')).toBe(true);
      expect(isKnownBankName('finansbank')).toBe(true);
    });

    it('should return false for unknown bank names', () => {
      expect(isKnownBankName('Denizbank')).toBe(false);
      expect(isKnownBankName('HSBC')).toBe(false);
      expect(isKnownBankName('Kira Ödemesi')).toBe(false);
      expect(isKnownBankName('Market Alışverişi')).toBe(false);
    });

    it('should match partial text containing bank name', () => {
      expect(isKnownBankName('Akbank kartı')).toBe(true);
      expect(isKnownBankName('Garanti BBVA Bonus ekstre')).toBe(true);
    });
  });
});
