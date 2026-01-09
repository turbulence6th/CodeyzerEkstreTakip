import { configureStore, combineReducers, Store } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import type { Persistor } from 'redux-persist';
import { Capacitor } from '@capacitor/core';
import storage from 'redux-persist/lib/storage';
import dateTransform from './transforms/dateTransform';
import * as RPTEncrypt from 'redux-persist-transform-encrypt';

// Platform kontrolü - iOS'ta şifreleme devre dışı (iOS zaten güvenli - App Sandbox)
const isIOSPlatform = Capacitor.getPlatform() === 'ios';

// Slice reducer'larını import et
import authReducer from './slices/authSlice';
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
  console.log('[Store Init] Initializing store. Platform:', Capacitor.getPlatform());

  // 1. Ana reducer'ı oluştur
  const rootReducer = combineReducers({
    auth: authReducer,
    data: dataReducer,
    loading: loadingReducer,
    toast: toastReducer,
  });

  // 2. Transform listesini oluştur
  // iOS'ta şifreleme devre dışı - iOS App Sandbox zaten güvenli
  let transforms: any[] = [dateTransform];

  if (!isIOSPlatform) {
    console.log('[Store Init] Enabling encryption for non-iOS platform.');
    const encryptor = encryptTransform({
      secretKey: encryptionKey,
      onError: (err: Error) => {
        console.error('[Encrypt Transform] Error:', err);
        console.warn('[Encrypt Transform] Clearing corrupted persisted state...');
        storage.removeItem('persist:root').catch(() => {});
      },
    });
    transforms.push(encryptor);
  } else {
    console.log('[Store Init] iOS detected - skipping encryption (App Sandbox is secure).');
  }

  // 3. Persist yapılandırmasını tanımla
  const persistConfig = {
    key: 'root',
    storage,
    whitelist: ['auth', 'data'],
    transforms
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