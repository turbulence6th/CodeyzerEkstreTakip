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
   * Kullanıcının girdiği açıklama (örn: "Kira Ödemesi", "Market Faturası").
   * Bu alan, `AccountTab`'da `bankName` yerine gösterilebilir.
   */
  description: string;
  /**
   * Ödeme tutarı.
   */
  amount: number;
  /**
   * Son ödeme tarihi veya fatura tarihi.
   */
  dueDate: Date;
  /**
   * Kaynağın manuel olduğunu belirtir.
   */
  source: 'manual';
  /**
   * Takvime eklenip eklenmediğini takip etmek için (opsiyonel).
   * Bu state `AccountTab` içinde yönetilebilir, tipte olması şart değil.
   */
  // isAddedToCalendar?: boolean; 
} 