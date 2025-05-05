export interface SecureStoragePlugin {
  /**
   * Cihazın güvenli deposundan şifreleme anahtarını getirir.
   * Web için mock implementasyon 'WEB_TEST_SECRET_KEY' dönecek.
   */
  getEncryptionKey(): Promise<{ key: string }>;
} 