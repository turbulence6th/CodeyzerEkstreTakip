import { isKnownBankName } from '../services/bank-registry';

// "BankAdı - ****XXXX" formatı oluşturur (ManualEntryTab'da kullanılır)
export function formatBankEntryDescription(bankName: string, last4Digits?: string): string {
  return last4Digits ? `${bankName} - ****${last4Digits}` : bankName;
}

// Bu formatı parse eden regex
export const BANK_ENTRY_PATTERN = /^(.+?)\s*-\s*\*+(\d{4})$/;

// Açıklamadan banka adı ve son 4 hane çıkarır
export function parseBankEntryDescription(description: string): { bankName: string; last4Digits: string } | null {
  const match = description.match(BANK_ENTRY_PATTERN);
  if (!match) return null;
  const bankName = match[1].trim();
  const last4Digits = match[2];
  if (!isKnownBankName(bankName)) return null;
  return { bankName, last4Digits };
}
