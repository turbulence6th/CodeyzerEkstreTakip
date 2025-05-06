import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { initializeStore, getStore, getPersistor } from './store';
import { SecureStorage } from './plugins/secure-storage';
import App from './App';
import { Preferences } from '@capacitor/preferences';

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

// Redux şifreleme anahtarını yöneten fonksiyon
async function getReduxEncryptionKey(): Promise<string> {
  try {
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
    console.error('[Key Init] CRITICAL: Failed to get or generate encryption key.', error);
    throw new Error(`Failed to manage encryption key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found in the DOM.');
const root = createRoot(container);

const startApp = async () => {
  try {
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
    console.error('[Main] CRITICAL: Failed to initialize app.', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    root.render(
      <React.StrictMode>
        <FatalErrorScreen message={`Uygulama başlatılamadı (${errorMessage})`} />
      </React.StrictMode>
    );
  }
};

startApp();