import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { initializeStore } from './store';
import { SecureStorage } from './plugins/secure-storage';
import { configureApiClient } from './services/apiClient';
import App from './App';

// Hata durumunda gösterilecek basit bileşen
const FatalErrorScreen = ({ message }: { message: string }) => (
  <div style={{ padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <h1>Uygulama Başlatılamadı</h1>
    <p style={{ maxWidth: '400px' }}>Güvenlik ayarları yüklenirken bir sorun oluştu. Lütfen uygulamayı kapatıp tekrar açmayı deneyin veya geliştiriciyle iletişime geçin.</p>
    <p style={{ color: 'grey', fontSize: '0.8em', marginTop: '20px', wordBreak: 'break-word' }}>Hata Detayı: {message}</p>
  </div>
);

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found in the DOM.');
const root = createRoot(container);

const startApp = async () => {
  try {
    // Anahtarı almayı dene
    const result = await SecureStorage.getEncryptionKey();
    const encryptionKey = result.key;
    console.log('[Main] Encryption key retrieved successfully.'); // Anahtarı loglamayalım

    // Anahtar başarıyla alındıysa, store'u ve uygulamayı başlat
    const { store, persistor } = initializeStore(encryptionKey);
    configureApiClient(store.getState, store.dispatch);

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
    // Anahtar alınamazsa!
    console.error('[Main] CRITICAL: Failed to get encryption key. Cannot start app securely.', error);

    // Fallback anahtar kullanmak yerine HATA EKRANI göster
    const errorMessage = error instanceof Error ? error.message : String(error);
    root.render(
      <React.StrictMode>
        <FatalErrorScreen message={`Güvenli anahtar alınamadı (${errorMessage})`} />
      </React.StrictMode>
    );
  }
};

startApp();