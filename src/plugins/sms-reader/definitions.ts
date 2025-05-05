import type { PermissionState } from '@capacitor/core';

// İzin durumunu döndürecek yapı
export interface SmsPermissionStatus {
  readSms: PermissionState; // alias ile eşleşmeli
}

// Tek bir SMS mesajını temsil edecek yapı
export interface SmsMessage {
  id: string; // Android _id genellikle long'dur, string olarak tutmak daha güvenli
  address: string; // Gönderen numarası
  body: string; // Mesaj içeriği
  date: number; // Tarih (timestamp ms)
  // İhtiyaç olursa başka alanlar eklenebilir (date_sent, thread_id, type vb.)
}

// Mesajları filtrelemek için opsiyonlar
export interface SmsFilterOptions {
  // address?: string; // Belirli bir gönderenden filtrele (tam eşleşme) - Native artık IN kullanıyor
  // addressRegex?: string; // Gönderen regex ile filtrele - Kaldırıldı
  // body?: string; // Mesaj içeriğinde ara (tam eşleşme) - Native artık LIKE kullanıyor
  // bodyRegex?: string; // Mesaj içeriğinde regex ile ara - Kaldırıldı
  minDate?: number; // Minimum tarih (timestamp ms)
  maxDate?: number; // Maksimum tarih (timestamp ms)
  maxCount?: number; // Döndürülecek maksimum mesaj sayısı

  // Native tarafta SQL sorgusu için kullanılacak filtreler
  senders?: string[]; // İzin verilen gönderici adresleri (tam eşleşme, case-insensitive yapılacak)
  keywords?: string[]; // Mesaj gövdesinde bulunması gereken anahtar kelimeler (case-insensitive yapılacak)

  // indexFrom?: number; // Sayfalama için başlangıç indeksi (şimdilik eklenmedi)
}

// Native filtreleme için yapılandırma seçenekleri - KALDIRILDI

// Pluginimizin metodlarını tanımlayan interface
export interface SmsReaderPlugin {
  /**
   * Gerekli SMS okuma izinlerinin durumunu kontrol eder.
   */
  checkPermissions(): Promise<SmsPermissionStatus>;

  /**
   * Gerekli SMS okuma izinlerini kullanıcıdan ister.
   */
  requestPermissions(): Promise<SmsPermissionStatus>;

  /**
   * Belirtilen filtrelere göre SMS mesajlarını getirir.
   * @param options Filtreleme seçenekleri (örn. maxCount, senders, keywords)
   */
  getMessages(options?: SmsFilterOptions): Promise<{ messages: SmsMessage[] }>;

  // configureFilters metodu kaldırıldı

  // Belki gelen SMS'leri dinlemek için:
  // addListener(eventName: 'smsReceived', listenerFunc: (message: SmsMessage) => void): Promise<PluginListenerHandle> & PluginListenerHandle;
  // removeAllListeners(): Promise<void>;
} 