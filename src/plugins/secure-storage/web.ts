import { WebPlugin } from '@capacitor/core';
import type { SecureStoragePlugin } from './definitions';

export class SecureStorageWeb extends WebPlugin implements SecureStoragePlugin {

  private readonly MOCK_PREFIX = 'webmock:';

  async encryptString(options: { data: string }): Promise<{ encryptedData: string }> {
    console.warn(
      'SecureStorage.encryptString web implementation is NOT secure! Using simple Base64 encoding.'
    );
    try {
      // Basitçe Base64'e çevir ve prefix ekle
      const encryptedData = this.MOCK_PREFIX + btoa(unescape(encodeURIComponent(options.data)));
      return { encryptedData };
    } catch (e) {
      console.error('Web mock encryption failed', e);
      throw new Error('Web mock encryption failed');
    }
  }

  async decryptString(options: { encryptedData: string }): Promise<{ decryptedData: string }> {
    console.warn(
      'SecureStorage.decryptString web implementation is NOT secure! Using simple Base64 decoding.'
    );
    if (!options.encryptedData || !options.encryptedData.startsWith(this.MOCK_PREFIX)) {
      throw new Error('Invalid web mock encrypted data format.');
    }
    try {
      // Prefix'i kaldır ve Base64'den çöz
      const base64Data = options.encryptedData.substring(this.MOCK_PREFIX.length);
      const decryptedData = decodeURIComponent(escape(atob(base64Data)));
      return { decryptedData };
    } catch (e) {
      console.error('Web mock decryption failed', e);
      throw new Error('Web mock decryption failed. Data might be corrupted or not Base64.');
    }
  }
} 