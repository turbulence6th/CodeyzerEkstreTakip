export interface SecureStoragePlugin {
  /**
   * Encrypts a string using the underlying secure key storage.
   *
   * @param options Options containing the string data to encrypt.
   * @param options.data The string to encrypt.
   * @returns {Promise<{ encryptedData: string }> } A promise that resolves with the Base64 encoded encrypted data (IV prefixed).
   * @rejects {string} An error message if encryption fails.
   */
  encryptString(options: { data: string }): Promise<{ encryptedData: string }>;

  /**
   * Decrypts a Base64 encoded string that was previously encrypted using `encryptString`.
   *
   * @param options Options containing the encrypted Base64 string.
   * @param options.encryptedData The Base64 encoded string (IV prefixed) to decrypt.
   * @returns {Promise<{ decryptedData: string }> } A promise that resolves with the original decrypted string.
   * @rejects {string} An error message if decryption fails (e.g., wrong key, corrupted data, invalid format).
   */
  decryptString(options: { encryptedData: string }): Promise<{ decryptedData: string }>;
} 