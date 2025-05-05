package com.codeyzer.ekstre; // Paket adınız farklıysa güncelleyin

// Android SDK Imports
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log; // Log sınıfı için import

import androidx.annotation.RequiresApi;

// Capacitor Imports
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin; // Annotation için import

// Java Security Imports
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.InvalidAlgorithmParameterException;
import java.security.InvalidKeyException;
import java.security.KeyStore;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.security.SecureRandom;
import java.security.UnrecoverableEntryException;
import java.security.cert.CertificateException;

// Java Crypto Imports
import javax.crypto.BadPaddingException;
import javax.crypto.Cipher;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.KeyGenerator;
import javax.crypto.NoSuchPaddingException;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SecureStorage")
public class SecureStoragePlugin extends Plugin {

    private static final String TAG = "SecureStoragePlugin";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    // redux-persist anahtarını şifrelemek/çözmek için kullanılacak Keystore anahtarının alias'ı
    private static final String ENCRYPTOR_KEY_ALIAS = "EkstreAppStringEncryptorKeyAlias";
    private static final String AES_MODE = KeyProperties.KEY_ALGORITHM_AES;
    private static final String BLOCK_MODE = KeyProperties.BLOCK_MODE_GCM;
    private static final String PADDING = KeyProperties.ENCRYPTION_PADDING_NONE; // GCM padding gerektirmez
    private static final int GCM_TAG_LENGTH = 128; // bit cinsinden, 16 byte
    private static final int GCM_IV_LENGTH = 12; // byte cinsinden

    @RequiresApi(api = Build.VERSION_CODES.M)
    private SecretKey getOrCreateSecretKey() throws KeyStoreException, CertificateException, IOException, NoSuchAlgorithmException, UnrecoverableEntryException, InvalidAlgorithmParameterException, NoSuchProviderException {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);

        if (!keyStore.containsAlias(ENCRYPTOR_KEY_ALIAS)) {
            Log.d(TAG, "Keystore key for encryption not found, generating a new one: " + ENCRYPTOR_KEY_ALIAS);
            generateSecretKey(ENCRYPTOR_KEY_ALIAS);
        }

        KeyStore.SecretKeyEntry secretKeyEntry = (KeyStore.SecretKeyEntry) keyStore.getEntry(ENCRYPTOR_KEY_ALIAS, null);
        if (secretKeyEntry == null) {
            Log.e(TAG, "Failed to retrieve the key entry from Keystore after creation/check.");
            throw new KeyStoreException("Failed to retrieve key entry from Keystore.");
        }
        SecretKey secretKey = secretKeyEntry.getSecretKey();
         if (secretKey == null) {
            Log.e(TAG, "Retrieved SecretKey from entry is null.");
            throw new KeyStoreException("Failed to retrieve valid key from Keystore entry.");
        }
        return secretKey;
    }

    @RequiresApi(api = Build.VERSION_CODES.M)
    private void generateSecretKey(String alias) throws NoSuchProviderException, NoSuchAlgorithmException, InvalidAlgorithmParameterException {
        KeyGenerator keyGenerator = KeyGenerator.getInstance(AES_MODE, ANDROID_KEYSTORE);
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(BLOCK_MODE)
                .setEncryptionPaddings(PADDING)
                .setKeySize(256)
                // .setUserAuthenticationRequired(false) // İsteğe bağlı
                .build();
        keyGenerator.init(spec);
        keyGenerator.generateKey();
        Log.d(TAG, "AES-256 GCM key generated for internal encryption/decryption with alias: " + alias);
    }

    @PluginMethod
    public void encryptString(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
             call.reject("Encryption requires Android M (API 23) or higher.");
             return;
        }
        String dataToEncrypt = call.getString("data");
        if (dataToEncrypt == null || dataToEncrypt.isEmpty()) {
            call.reject("Missing 'data' string to encrypt.");
            return;
        }
        try {
            SecretKey secretKey = getOrCreateSecretKey();
            Cipher cipher = Cipher.getInstance(AES_MODE + "/" + BLOCK_MODE + "/" + PADDING);

            // IV'yi biz oluşturmuyoruz, Keystore'a bırakıyoruz.
            // byte[] iv = new byte[GCM_IV_LENGTH];
            // SecureRandom random = new SecureRandom();
            // random.nextBytes(iv);
            // GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);

            // Cipher'ı IV parametresi olmadan başlatıyoruz.
            cipher.init(Cipher.ENCRYPT_MODE, secretKey);

            byte[] encryptedBytes = cipher.doFinal(dataToEncrypt.getBytes(StandardCharsets.UTF_8));

            // Keystore tarafından oluşturulan IV'yi alıyoruz.
            byte[] iv = cipher.getIV();
            if (iv == null) {
                 // Bu durumun olmaması gerekir ama güvenlik için kontrol edelim.
                 Log.e(TAG, "Cipher did not generate an IV after encryption.");
                 call.reject("Encryption failed: IV was not generated.");
                 return;
            }
            // IV uzunluğunu kontrol edelim (GCM için genellikle 12 byte)
             if (iv.length != GCM_IV_LENGTH) {
                  Log.w(TAG, "Generated IV length (" + iv.length + ") is not the expected GCM IV length (" + GCM_IV_LENGTH + ").");
                  // Yine de devam edebiliriz, decrypt tarafı bu IV'yi kullanacak.
             }

            // IV'yi şifreli verinin başına ekle (IV + Ciphertext)
            byte[] ivAndEncryptedBytes = new byte[iv.length + encryptedBytes.length];
            System.arraycopy(iv, 0, ivAndEncryptedBytes, 0, iv.length);
            System.arraycopy(encryptedBytes, 0, ivAndEncryptedBytes, iv.length, encryptedBytes.length);

            // Sonucu Base64 string olarak döndür
            String encryptedBase64 = Base64.encodeToString(ivAndEncryptedBytes, Base64.NO_WRAP);

            JSObject ret = new JSObject();
            ret.put("encryptedData", encryptedBase64);
            call.resolve(ret);
            Log.d(TAG, "String encrypted successfully (Keystore IV).");

        } catch (NoSuchAlgorithmException | NoSuchPaddingException | InvalidKeyException |
                 InvalidAlgorithmParameterException | IllegalBlockSizeException | BadPaddingException |
                 KeyStoreException | CertificateException | IOException | UnrecoverableEntryException |
                 NoSuchProviderException e) {
            // InvalidAlgorithmParameterException artık burada yakalanmamalı (IV hatası için)
            // ama diğer nedenlerle gelebilir.
            Log.e(TAG, "Error encrypting string", e);
            call.reject("Encryption failed: " + e.getMessage(), e);
        } catch (Exception e) {
            Log.e(TAG, "Unexpected error during encryption", e);
            call.reject("Unexpected encryption error: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void decryptString(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            call.reject("Decryption requires Android M (API 23) or higher.");
            return;
        }
        String encryptedBase64 = call.getString("encryptedData");
        if (encryptedBase64 == null || encryptedBase64.isEmpty()) {
            call.reject("Missing 'encryptedData' string to decrypt.");
            return;
        }
        try {
            byte[] ivAndEncryptedBytes = Base64.decode(encryptedBase64, Base64.NO_WRAP);
            if (ivAndEncryptedBytes.length <= GCM_IV_LENGTH) {
                 call.reject("Invalid encrypted data format (too short).");
                 return;
            }
            byte[] iv = new byte[GCM_IV_LENGTH];
            byte[] encryptedBytes = new byte[ivAndEncryptedBytes.length - GCM_IV_LENGTH];
            System.arraycopy(ivAndEncryptedBytes, 0, iv, 0, iv.length);
            System.arraycopy(ivAndEncryptedBytes, iv.length, encryptedBytes, 0, encryptedBytes.length);

            SecretKey secretKey = getOrCreateSecretKey();
            Cipher cipher = Cipher.getInstance(AES_MODE + "/" + BLOCK_MODE + "/" + PADDING);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            // Decrypt için IV vermek zorunlu ve doğrudur.
            cipher.init(Cipher.DECRYPT_MODE, secretKey, parameterSpec);
            byte[] decryptedBytes = cipher.doFinal(encryptedBytes);
            String decryptedString = new String(decryptedBytes, StandardCharsets.UTF_8);
            JSObject ret = new JSObject();
            ret.put("decryptedData", decryptedString);
            call.resolve(ret);
            Log.d(TAG, "String decrypted successfully.");
        } catch (NoSuchAlgorithmException | NoSuchPaddingException | InvalidKeyException |
                 InvalidAlgorithmParameterException | IllegalBlockSizeException | BadPaddingException |
                 KeyStoreException | CertificateException | IOException | UnrecoverableEntryException |
                 NoSuchProviderException e) {
            Log.e(TAG, "Error decrypting string", e);
            call.reject("Decryption failed: " + e.getMessage(), e);
         } catch (IllegalArgumentException e) {
             Log.e(TAG, "Base64 decoding failed", e);
             call.reject("Invalid Base64 data: " + e.getMessage(), e);
         } catch (Exception e) {
            Log.e(TAG, "Unexpected error during decryption", e);
            call.reject("Unexpected decryption error: " + e.getMessage(), e);
        }
    }
} 