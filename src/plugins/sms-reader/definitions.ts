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
  address?: string; // Belirli bir gönderenden filtrele (tam eşleşme)
  addressRegex?: string; // Gönderen regex ile filtrele
  body?: string; // Mesaj içeriğinde ara (tam eşleşme)
  bodyRegex?: string; // Mesaj içeriğinde regex ile ara
  minDate?: number; // Minimum tarih (timestamp ms)
  maxDate?: number; // Maksimum tarih (timestamp ms)
  maxCount?: number; // Döndürülecek maksimum mesaj sayısı
  // indexFrom?: number; // Sayfalama için başlangıç indeksi (şimdilik eklenmedi)
}

// Native filtreleme için yapılandırma seçenekleri
export interface SmsNativeFilterConfig {
  senders: string[]; // İzin verilen gönderici listesi (Büyük harf)
  keywords: string[]; // Gerekli anahtar kelime listesi (Küçük harf)
}

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
   * @param options Filtreleme seçenekleri (örn. maxCount)
   */
  getMessages(options?: SmsFilterOptions): Promise<{ messages: SmsMessage[] }>;

  /**
   * Native taraftaki SMS alıcısının kullanacağı gönderici ve anahtar kelime
   * filtrelerini ayarlar. Bu, sadece ilgili SMS'lerin JS tarafına
   * bildirilmesini sağlar, Google Play politikalarına uyumluluğu artırır.
   *
   * @param options Gönderici ve anahtar kelime listelerini içeren nesne.
   */
  configureFilters(options: SmsNativeFilterConfig): Promise<void>;

  // Belki gelen SMS'leri dinlemek için:
  // addListener(eventName: 'smsReceived', listenerFunc: (message: SmsMessage) => void): Promise<PluginListenerHandle> & PluginListenerHandle;
  // removeAllListeners(): Promise<void>;
} 