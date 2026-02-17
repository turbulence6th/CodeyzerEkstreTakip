// Kanonik banka adları
export const BANK_NAMES = {
  AKBANK: 'Akbank',
  YAPI_KREDI: 'Yapı Kredi',
  ZIRAAT: 'Ziraat Bankası',
  GARANTI: 'Garanti BBVA Bonus',
  KUVEYT_TURK: 'Kuveyt Türk',
  IS_BANKASI: 'İş Bankası',
  QNB: 'QNB Finansbank',
} as const;

export type BankName = typeof BANK_NAMES[keyof typeof BANK_NAMES];

// Her bankanın alternatif adları (deduplikasyon eşleştirmesi için)
const BANK_ALIASES: Record<BankName, string[]> = {
  [BANK_NAMES.AKBANK]: ['akbank'],
  [BANK_NAMES.YAPI_KREDI]: ['yapı kredi', 'yapikredi'],
  [BANK_NAMES.ZIRAAT]: ['ziraat'],
  [BANK_NAMES.GARANTI]: ['garanti'],
  [BANK_NAMES.KUVEYT_TURK]: ['kuveyt türk', 'kuveytturk'],
  [BANK_NAMES.IS_BANKASI]: ['iş bankası', 'isbank'],
  [BANK_NAMES.QNB]: ['qnb', 'finansbank'],
};

// Tüm bilinen banka adlarını ve alias'larını döndürür (lowercase)
export function getKnownBankMatchPatterns(): string[] {
  return Object.entries(BANK_ALIASES).flatMap(([name, aliases]) => [
    name.toLowerCase(),
    ...aliases,
  ]);
}

// Bir metnin bilinen bir banka adı içerip içermediğini kontrol eder
export function isKnownBankName(text: string): boolean {
  const lower = text.toLowerCase();
  return getKnownBankMatchPatterns().some(pattern => lower.includes(pattern));
}
