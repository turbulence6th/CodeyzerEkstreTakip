import { WebPlugin } from '@capacitor/core';
import type { SecureStoragePlugin } from './definitions';

export class SecureStorageWeb extends WebPlugin implements SecureStoragePlugin {
  async getEncryptionKey(): Promise<{ key: string }> {
    console.log('SecureStorageWeb: Mock getEncryptionKey');
    return { key: 'WEB_TEST_SECRET_KEY' };
  }
} 