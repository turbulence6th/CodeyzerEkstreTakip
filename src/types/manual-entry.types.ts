/**
 * Kullanıcının manuel olarak girdiği ödeme veya ekstre bilgisini temsil eder.
 */
export interface ManualEntry {
  /**
   * Benzersiz kimlik (isteğe bağlı, Redux state'inde key olarak kullanılabilir).
   * UUID veya basit bir timestamp+random olabilir.
   */
  id: string;
  /**
   * Kullanıcının girdiği açıklama (örn: "Kira Ödemesi", "Market Faturası", "Kredi").
   * Bu alan, `AccountTab`'da `bankName` yerine gösterilebilir.
   */
  description: string;
  /**
   * Ödeme tutarı (tek seferlik ödeme için) veya aylık taksit tutarı (kredi için).
   */
  amount: number;
  /**
   * Son ödeme tarihi veya ilk taksit tarihi (kredi için).
   */
  dueDate: Date;
  /**
   * Kaynağın manuel olduğunu belirtir.
   */
  source: 'manual';
  /**
   * Girdinin türünü belirtir (Borç, Harcama veya Kredi).
   */
  entryType: 'debt' | 'expense' | 'loan';
  /**
   * Ödendi durumunu belirtir.
   */
  isPaid?: boolean;
  /**
   * Kredi için taksit sayısı (sadece entryType: 'loan' için).
   */
  installmentCount?: number;
  /**
   * Takvime eklenip eklenmediğini takip etmek için (opsiyonel).
   * Bu state `AccountTab` içinde yönetilebilir, tipte olması şart değil.
   */
  // isAddedToCalendar?: boolean;
} 