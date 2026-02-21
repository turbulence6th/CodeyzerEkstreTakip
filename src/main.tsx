import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { Capacitor } from '@capacitor/core';
import { initializeStore, getStore, getPersistor } from './store';
import { SecureStorage } from './plugins/secure-storage';
import App from './App';
import { Preferences } from '@capacitor/preferences';
import storage from 'redux-persist/lib/storage';

// Platform kontrolü
const isIOSPlatform = Capacitor.getPlatform() === 'ios';

// Hata durumunda gösterilecek basit bileşen
const FatalErrorScreen = ({ message }: { message: string }) => (
  <div style={{ padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <h1>Uygulama Başlatılamadı</h1>
    <p style={{ maxWidth: '400px' }}>Güvenlik ayarları yüklenirken bir sorun oluştu. Lütfen uygulamayı kapatıp tekrar açmayı deneyin veya geliştiriciyle iletişime geçin.</p>
    <p style={{ color: 'grey', fontSize: '0.8em', marginTop: '20px', wordBreak: 'break-word' }}>Hata Detayı: {message}</p>
  </div>
);

// Preferences'ta şifreli Redux anahtarını saklamak için anahtar
const ENCRYPTED_REDUX_KEY_PREF = 'redux_secret_key_encrypted_v1';

// Güvenli rastgele string anahtar oluşturma fonksiyonu
function generateRandomKey(length = 32): string {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  // Standart Base64 kullanmak genellikle daha az sorun çıkarır
  return btoa(String.fromCharCode.apply(null, Array.from(array)));
}

// SecureStorage plugin'inin hazır olmasını bekle
async function waitForSecureStorage(maxRetries = 30, delayMs = 100): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Basit bir test çağrısı yap
      await SecureStorage.encryptString({ data: 'test' });
      console.log('[Key Init] SecureStorage is ready.');
      return true;
    } catch (error: any) {
      const errorMsg = error?.message || '';
      if (errorMsg.includes('not implemented') || errorMsg.includes('UNIMPLEMENTED') || error?.code === 'UNIMPLEMENTED') {
        console.log(`[Key Init] SecureStorage not ready, retry ${i + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        // Plugin hazır ama test çağrısı başka bir nedenle başarısız oldu
        // Bu durumda plugin'in kullanılabilir olduğunu varsayabiliriz
        console.warn('[Key Init] SecureStorage test call failed with non-plugin error, assuming ready:', errorMsg);
        return true;
      }
    }
  }
  return false;
}

// iOS için fallback: Basit obfuscation (tam güvenlik değil ama iOS zaten güvenli)
const IOS_FALLBACK_KEY_PREF = 'redux_key_ios_v1';

async function getIOSFallbackKey(): Promise<string> {
  console.log('[Key Init] Using iOS fallback key management...');
  const { value: existingKey } = await Preferences.get({ key: IOS_FALLBACK_KEY_PREF });

  if (existingKey) {
    console.log('[Key Init] iOS fallback key found.');
    return existingKey;
  }

  const newKey = generateRandomKey();
  await Preferences.set({ key: IOS_FALLBACK_KEY_PREF, value: newKey });
  console.log('[Key Init] New iOS fallback key generated and stored.');
  return newKey;
}

// Redux şifreleme anahtarını yöneten fonksiyon
async function getReduxEncryptionKey(): Promise<string> {
  try {
    // Plugin'in hazır olmasını bekle
    const isReady = await waitForSecureStorage();

    // iOS'ta SecureStorage hazır değilse fallback kullan
    if (!isReady) {
      if (isIOSPlatform) {
        console.log('[Key Init] SecureStorage not available on iOS, using fallback...');
        return await getIOSFallbackKey();
      }
      throw new Error('SecureStorage plugin could not be initialized');
    }

    console.log('[Key Init] Trying to retrieve encrypted Redux key from Preferences...');
    const { value: encryptedKey } = await Preferences.get({ key: ENCRYPTED_REDUX_KEY_PREF });

    if (encryptedKey) {
      console.log('[Key Init] Encrypted key found. Trying to decrypt...');
      try {
        const { decryptedData } = await SecureStorage.decryptString({ encryptedData: encryptedKey });
        console.log('[Key Init] Decryption successful.');
        return decryptedData;
      } catch (decryptError) {
        console.error('[Key Init] CRITICAL: Failed to decrypt existing key. Data might be lost!', decryptError);
        await Preferences.remove({ key: ENCRYPTED_REDUX_KEY_PREF });
        // Yeni anahtar oluşturma adımına devam et
      }
    }

    console.log('[Key Init] No valid encrypted key found or decryption failed. Generating new key...');
    const newKey = generateRandomKey();
    console.log('[Key Init] New key generated. Encrypting and storing...');
    const { encryptedData } = await SecureStorage.encryptString({ data: newKey });
    await Preferences.set({ key: ENCRYPTED_REDUX_KEY_PREF, value: encryptedData });
    console.log('[Key Init] New encrypted key stored in Preferences.');
    return newKey;

  } catch (error) {
    // Son çare: iOS'ta fallback dene
    if (isIOSPlatform) {
      console.warn('[Key Init] Error occurred, trying iOS fallback...', error);
      return await getIOSFallbackKey();
    }
    console.error('[Key Init] CRITICAL: Failed to get or generate encryption key.', error);
    throw new Error(`Failed to manage encryption key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found in the DOM.');
const root = createRoot(container);

const startApp = async (retryCount = 0): Promise<void> => {
  const MAX_RETRIES = 2;

  try {
    // Son deneme: eski verileri temizleyip sıfırdan başla
    if (retryCount === MAX_RETRIES) {
      console.log('[Main] Final retry: Clearing all persisted data...');
      await storage.removeItem('persist:root');
      await Preferences.remove({ key: ENCRYPTED_REDUX_KEY_PREF });
    }

    // Yeni anahtar yönetim fonksiyonunu çağır
    const reduxSecretKey = await getReduxEncryptionKey();
    console.log('[Main] Redux secret key obtained successfully.');

    // Store'u bu anahtarla başlat
    initializeStore(reduxSecretKey);
    const store = getStore();
    const persistor = getPersistor();

    // Uygulamayı normal şekilde render et
    root.render(
      <React.StrictMode>
        <Provider store={store}>
          <PersistGate loading={<div>Uygulama yükleniyor...</div>} persistor={persistor}>
            <App />
          </PersistGate>
        </Provider>
      </React.StrictMode>
    );

  } catch (error) {
    console.error(`[Main] Initialization attempt ${retryCount + 1} failed.`, error);

    if (retryCount < MAX_RETRIES) {
      // Önce veri silmeden tekrar dene, son denemede verileri temizle
      const delayMs = (retryCount + 1) * 500;
      console.log(`[Main] Retrying in ${delayMs}ms... (attempt ${retryCount + 2}/${MAX_RETRIES + 1})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return startApp(retryCount + 1);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    root.render(
      <React.StrictMode>
        <FatalErrorScreen message={`Uygulama başlatılamadı (${errorMessage})`} />
      </React.StrictMode>
    );
  }
};

startApp();