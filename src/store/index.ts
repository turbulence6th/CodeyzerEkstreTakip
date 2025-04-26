import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
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

// Slice reducer'larını import et
import authReducer from './slices/authSlice';
import permissionReducer from './slices/permissionSlice';
import dataReducer from './slices/dataSlice';
import loadingReducer from './slices/loadingSlice'; // Yeni loading reducer'ı import et
import toastReducer from './slices/toastSlice'; // Yeni toast reducer'ı import et

// 1. Ana reducer'ı oluştur
const rootReducer = combineReducers({
  auth: authReducer,
  permissions: permissionReducer,
  data: dataReducer,
  loading: loadingReducer, // loading reducer'ı ekle
  toast: toastReducer, // toast reducer'ı ekle
});

// 2. RootState tipini tanımla
export type RootState = ReturnType<typeof rootReducer>;

// 3. Persist yapılandırmasını tanımla
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth', 'permissions', 'data'],
  transforms: [dateTransform]
};

// 4. Kalıcı reducer'ı oluştur (RootState tipini kullanarak)
const persistedReducer = persistReducer<RootState>(persistConfig, rootReducer);

// 5. Store'u yapılandır
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // redux-persist ile uyumluluk için serializableCheck ayarları
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

// 6. Persistor'ı oluştur
export const persistor = persistStore(store);

// 7. AppDispatch tipini tanımla
export type AppDispatch = typeof store.dispatch; 