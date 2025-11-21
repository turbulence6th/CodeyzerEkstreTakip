// SMS mesajının temel yapısı (SmsReader eklentisinden gelen tipe benzer)
export interface SmsDetails {
  sender: string;
  body: string;
  date: number; // Timestamp
  // Eklentiden gelen diğer alanlar olabilir (id vb.)
}

// Ayrıştırılmış ekstre bilgilerini tutacak yapı
export interface ParsedStatement {
  bankName: string;
  dueDate: Date;
  amount: number | null; // Bazen borç bilgisi olmayabilir
  last4Digits?: string; // Kartın son 4 hanesi (varsa)
  originalMessage: SmsDetails | EmailDetails | ScreenshotDetails; // SMS, E-posta ve Screenshot detaylarını kabul etsin
  source: 'sms' | 'email' | 'screenshot'; // Kaynağı belirtmek için alan ekleyelim
  isPaid?: boolean; // Ödendi durumu
  entryType: 'debt'; // Otomatik kayıtlar her zaman borçtur
}


// Tüm banka parser'larının uygulaması gereken interface
export interface BankSmsParser {
  /**
   * Bu parser'ın verilen mesajı işleyip işleyemeyeceğini belirler.
   * @param sender Mesajı gönderen
   * @param body Mesajın içeriği
   * @returns Mesaj işlenebilirse true, aksi takdirde false
   */
  canParse(sender: string, body: string): boolean;

  /**
   * Verilen mesajı ayrıştırarak ekstre bilgilerini çıkarır.
   * `canParse` true döndürdüğünde çağrılmalıdır.
   * @param message Ayrıştırılacak SMS mesajı
   * @returns Ayrıştırılmış ekstre bilgileri veya null (başarısız olursa)
   */
  parse(message: SmsDetails): ParsedStatement | null;
}

// --- Email Parsing Types --- //

// E-posta detayları (Gmail API'den alınacak temel bilgiler)
export interface EmailDetails {
  id: string;
  sender: string; // From başlığından alınacak
  subject: string;
  date: Date;
  plainBody: string | null;
  htmlBody: string | null;
  originalResponse?: any; // Ekin alınması için tüm yanıtı saklayalım
}

// E-posta içeriği (düz metin ve HTML)
export interface DecodedEmailBody {
  plainBody: string | null;
  htmlBody: string | null;
}

// E-posta ile gelen ekstreler için ParsedStatement'a benzer yapı
// Şimdilik aynı yapıyı kullanabiliriz, gerekirse ayrılır.
/* // Bu tipe artık gerek yok
export type ParsedEmailStatement = ParsedStatement & {
   originalMessage: EmailDetails; // Orijinal mesaj tipi farklı
};
*/

// Email Parser arayüzü
export interface BankEmailParser {
  bankName: string;
  // canParse imzası güncellendi
  canParse(sender: string, subject: string, body: DecodedEmailBody, emailDetails?: EmailDetails): Promise<boolean> | boolean;
  // parse metodundan accessToken parametresi kaldırıldı
  parse(email: EmailDetails): Promise<ParsedStatement | null> | ParsedStatement | null;
}

// --- Screenshot Parsing Types --- //

// Screenshot (OCR'dan gelen) detayları
export interface ScreenshotDetails {
  extractedText: string; // OCR'dan çıkan ham metin
  imageUri?: string; // Görüntü URI'si (isteğe bağlı, log/debug için)
  date: Date; // Ne zaman çekildi (SmsDetails ve EmailDetails ile tutarlı olmak için 'date' olarak adlandırıldı)
}

// Screenshot Parser arayüzü
export interface BankScreenshotParser {
  bankName: string;

  /**
   * Bu parser'ın verilen OCR metnini işleyip işleyemeyeceğini belirler.
   * Bankayı tanımlamak için OCR metninde banka ismini, logosunu veya karakteristik ifadeleri arar.
   * @param extractedText OCR'dan çıkan metin
   * @returns Bu banka için parse edilebilirse true
   */
  canParse(extractedText: string): boolean;

  /**
   * OCR metnini ayrıştırarak ekstre bilgilerini çıkarır.
   * `canParse` true döndürdüğünde çağrılmalıdır.
   * @param screenshot Screenshot detayları
   * @returns Ayrıştırılmış ekstre bilgileri veya null (başarısız olursa)
   */
  parse(screenshot: ScreenshotDetails): ParsedStatement | null;
}

// --- Ortak Parser Tipleri --- //

// Tek bir banka için hem SMS hem de E-posta hem de Screenshot parser'larını tutabilen yapı
export interface BankProcessor {
  bankName: string;
  smsSenderKeywords?: string[]; // Bankanın SMS gönderirken kullandığı numara/başlıklar (opsiyonel)
  smsStatementQueryKeyword?: string; // Ekstre SMS içeriği için anahtar kelime (opsiyonel)
  smsParser?: BankSmsParser; // SMS parser (opsiyonel)
  emailParser?: BankEmailParser; // Email parser (opsiyonel)
  screenshotParser?: BankScreenshotParser; // Screenshot parser (opsiyonel)
  gmailQuery?: string; // Bu bankanın e-postalarını bulmak için Gmail sorgusu
  // Diğer banka özel ayarları buraya eklenebilir
}

// Not: ParsedStatement içindeki originalMessage tipi SMS'e özel.
// Email parse edildiğinde ParsedEmailStatement kullanılmalı veya
// ParsedStatement içindeki originalMessage tipi SmsDetails | EmailDetails olmalı. 