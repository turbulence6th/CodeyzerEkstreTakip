import { configureStore, combineReducers, Store } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import type { Persistor } from 'redux-persist'; // Persistor tipini import et
// Storage motoru olarak Capacitor Preferences'ı kullanacağız (daha güvenli)
// Veya localforage gibi daha gelişmiş bir seçenek de düşünülebilir.
// Şimdilik basitlik adına localStorage'ı veya AsyncStorage'ı kullanalım.
// AsyncStorage React Native içindir, Capacitor için Preferences daha uygun.
// ANCAK: redux-persist doğrudan Preferences ile çalışmayabilir.
// Bu yüzden en kolayı localStorage veya manuel adaptör.
// VEYA: Capacitor için özel storage adaptörleri var mı bakalım?
// Evet, 'redux-persist-capacitor-storage' gibi paketler var ama ekstra bağımlılık.
// EN BASİT YÖNTEM: localStorage kullanalım (Web ve PWA için çalışır, Native'de de çalışmalı)
// Daha güvenli alternatif: Capacitor Preferences ile manuel entegrasyon veya özel paket.
import storage from 'redux-persist/lib/storage'; // localStorage'ı kullanır
import dateTransform from './transforms/dateTransform'; // Oluşturduğumuz transformu import et
// import encryptTransform from 'redux-persist-transform-encrypt'; // Eski import kaldırıldı
import * as RPTEncrypt from 'redux-persist-transform-encrypt';
// import { createTransform } from 'redux-persist'; // createTransform kaldırıldı

// Kendi güvenli depolama eklentimizi import edelim
import { SecureStorage } from '../plugins/secure-storage';

// Slice reducer'larını import et
import authReducer from './slices/authSlice';
import permissionReducer from './slices/permissionSlice';
import dataReducer from './slices/dataSlice';
import loadingReducer from './slices/loadingSlice'; // Yeni loading reducer'ı import et
import toastReducer from './slices/toastSlice'; // Yeni toast reducer'ı import et

// Doğru export'u bul (CJS/ESM uyumluluğu için)
// const encryptTransform = (RPTEncrypt as any).default || RPTEncrypt; // Önceki deneme
const encryptTransform = (RPTEncrypt as any).default || RPTEncrypt.encryptTransform || RPTEncrypt; // Çalışan import şekli buydu, linter'a rağmen

// --- Store ve Persistor Referansları ---
let initializedStore: Store<RootState> | null = null;
let initializedPersistor: Persistor | null = null;

// --- Getter Fonksiyonları ---
export const getStore = (): Store<RootState> => {
  if (!initializedStore) {
    throw new Error('Store has not been initialized yet. Call initializeStore first.');
  }
  return initializedStore;
};

export const getPersistor = (): Persistor => {
  if (!initializedPersistor) {
    throw new Error('Persistor has not been initialized yet. Call initializeStore first.');
  }
  return initializedPersistor;
};

// Kolaylık sağlamak için getState ve dispatch için de getter'lar
export const getStoreState = (): RootState => {
  return getStore().getState();
};

export const getDispatch = (): AppDispatch => {
  return getStore().dispatch;
};

// --- Store ve Persistor Oluşturma Fonksiyonu ---

// Bu fonksiyon anahtarı aldıktan sonra çağrılacak
export const initializeStore = (encryptionKey: string) => {
  console.log('[Store Init] Initializing store with encryption key.');

  // Create encrypt transform (sağlanan anahtarla)
  // encryptor tekrar etkinleştirildi, transform whitelist'i kaldırıldı
  const encryptor = encryptTransform({
    secretKey: encryptionKey,
    onError: (err: Error) => console.error('[Encrypt Transform] Error:', err),
    // whitelist: ['auth'] // Bu satır kaldırıldı, tüm gelen slice'lar şifrelenecek
  });

  // 1. Ana reducer'ı oluştur
  const rootReducer = combineReducers({
    auth: authReducer,
    permissions: permissionReducer,
    data: dataReducer,
    loading: loadingReducer,
    toast: toastReducer,
  });

  // 2. RootState tipini tanımla (Bu dışarıda kalabilir veya içeride olabilir, dışarıda kalsın)
  // export type RootState = ReturnType<typeof rootReducer>;

  // 3. Persist yapılandırmasını tanımla
  const persistConfig = {
    key: 'root',
    storage,
    whitelist: ['auth', 'permissions', 'data'], // Hepsini persist et
    // encryptor tekrar eklendi, dateTransform'dan sonra
    transforms: [dateTransform, encryptor]
  };

  // 4. Kalıcı reducer'ı oluştur (RootState tipini kullanarak)
  const persistedReducer = persistReducer<RootState>(persistConfig, rootReducer);

  // 5. Store'u yapılandır
  const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      }),
  });

  // 6. Persistor'ı oluştur
  const persistor = persistStore(store);

  // Oluşturulan store ve persistor'ı modül kapsamındaki değişkenlere ata
  initializedStore = store;
  initializedPersistor = persistor;

  console.log('[Store Init] Store and persistor initialized and assigned.');
  return { store, persistor };
};

// Bu tipleri dışarıda export etmeye devam et
const rootReducerPlaceholder = combineReducers({
  auth: authReducer,
  permissions: permissionReducer,
  data: dataReducer,
  loading: loadingReducer,
  toast: toastReducer,
});
export type RootState = ReturnType<typeof rootReducerPlaceholder>;
// Thunk aksiyonlarını da destekleyen doğru AppDispatch tipi
import { ThunkDispatch } from '@reduxjs/toolkit';
import { AnyAction } from 'redux';
export type AppDispatch = ThunkDispatch<RootState, unknown, AnyAction>;

// Eski direkt exportları kaldır
// export const store = ...
// export const persistor = ... 