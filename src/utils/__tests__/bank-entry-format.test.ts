import { formatBankEntryDescription, parseBankEntryDescription, BANK_ENTRY_PATTERN } from '../bank-entry-format';
import { BANK_NAMES } from '../../services/bank-registry';

describe('bank-entry-format', () => {
  describe('formatBankEntryDescription', () => {
    it('should format bank name with last 4 digits', () => {
      expect(formatBankEntryDescription('Akbank', '1234')).toBe('Akbank - ****1234');
      expect(formatBankEntryDescription('Yapı Kredi', '5678')).toBe('Yapı Kredi - ****5678');
    });

    it('should return only bank name when last4Digits is undefined', () => {
      expect(formatBankEntryDescription('Akbank')).toBe('Akbank');
      expect(formatBankEntryDescription('Yapı Kredi', undefined)).toBe('Yapı Kredi');
    });

    it('should work with all BANK_NAMES constants', () => {
      Object.values(BANK_NAMES).forEach(bankName => {
        const formatted = formatBankEntryDescription(bankName, '9999');
        expect(formatted).toBe(`${bankName} - ****9999`);
      });
    });
  });

  describe('BANK_ENTRY_PATTERN', () => {
    it('should match bank entry format with asterisks', () => {
      expect(BANK_ENTRY_PATTERN.test('Akbank - ****1234')).toBe(true);
      expect(BANK_ENTRY_PATTERN.test('Yapı Kredi - ****5678')).toBe(true);
      expect(BANK_ENTRY_PATTERN.test('QNB Finansbank - ****0000')).toBe(true);
    });

    it('should not match non-bank descriptions', () => {
      expect(BANK_ENTRY_PATTERN.test('Kira Ödemesi')).toBe(false);
      expect(BANK_ENTRY_PATTERN.test('Market Alışverişi')).toBe(false);
    });
  });

  describe('parseBankEntryDescription', () => {
    it('should parse valid bank entry descriptions', () => {
      const result = parseBankEntryDescription('Akbank - ****1234');
      expect(result).not.toBeNull();
      expect(result!.bankName).toBe('Akbank');
      expect(result!.last4Digits).toBe('1234');
    });

    it('should parse all known bank names', () => {
      expect(parseBankEntryDescription(`${BANK_NAMES.AKBANK} - ****1234`)).toEqual({
        bankName: BANK_NAMES.AKBANK,
        last4Digits: '1234',
      });
      expect(parseBankEntryDescription(`${BANK_NAMES.YAPI_KREDI} - ****5678`)).toEqual({
        bankName: BANK_NAMES.YAPI_KREDI,
        last4Digits: '5678',
      });
      expect(parseBankEntryDescription(`${BANK_NAMES.ZIRAAT} - ****9012`)).toEqual({
        bankName: BANK_NAMES.ZIRAAT,
        last4Digits: '9012',
      });
      expect(parseBankEntryDescription(`${BANK_NAMES.GARANTI} - ****3456`)).toEqual({
        bankName: BANK_NAMES.GARANTI,
        last4Digits: '3456',
      });
      expect(parseBankEntryDescription(`${BANK_NAMES.KUVEYT_TURK} - ****7890`)).toEqual({
        bankName: BANK_NAMES.KUVEYT_TURK,
        last4Digits: '7890',
      });
      expect(parseBankEntryDescription(`${BANK_NAMES.IS_BANKASI} - ****1111`)).toEqual({
        bankName: BANK_NAMES.IS_BANKASI,
        last4Digits: '1111',
      });
      expect(parseBankEntryDescription(`${BANK_NAMES.QNB} - ****2222`)).toEqual({
        bankName: BANK_NAMES.QNB,
        last4Digits: '2222',
      });
    });

    it('should return null for non-bank descriptions', () => {
      expect(parseBankEntryDescription('Kira Ödemesi')).toBeNull();
      expect(parseBankEntryDescription('Market Alışverişi')).toBeNull();
      expect(parseBankEntryDescription('İhtiyaç Kredisi - Taksit 1/12')).toBeNull();
    });

    it('should return null for unknown bank names in correct format', () => {
      expect(parseBankEntryDescription('Denizbank - ****1234')).toBeNull();
      expect(parseBankEntryDescription('HSBC - ****5678')).toBeNull();
    });

    it('should handle descriptions formatted by formatBankEntryDescription', () => {
      // Round-trip test: format -> parse
      Object.values(BANK_NAMES).forEach(bankName => {
        const formatted = formatBankEntryDescription(bankName, '4321');
        const parsed = parseBankEntryDescription(formatted);
        expect(parsed).not.toBeNull();
        expect(parsed!.bankName).toBe(bankName);
        expect(parsed!.last4Digits).toBe('4321');
      });
    });
  });
});
