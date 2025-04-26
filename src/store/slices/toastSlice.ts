import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid'; // Benzersiz ID için
import type { Color } from '@ionic/core'; // Ionic renk tiplerini kullanabiliriz

// Toast mesajının yapısı
export interface ToastMessage {
  id: string; // Benzersiz ID (kaldırmak için)
  message: string;
  color?: Color; // success, warning, danger vb.
  duration?: number;
  position?: 'top' | 'bottom' | 'middle';
}

// State'in yapısı (gösterilecek toast'ların listesi)
interface ToastState {
  messages: ToastMessage[];
}

const initialState: ToastState = {
  messages: [],
};

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    // Yeni bir toast ekle (ID otomatik atanır)
    addToast: (state, action: PayloadAction<Omit<ToastMessage, 'id'>>) => {
      const newToast: ToastMessage = {
        id: uuidv4(), // Benzersiz ID oluştur
        ...action.payload,
        // Varsayılan değerler atanabilir
        duration: action.payload.duration ?? 3000, // Varsayılan süre 3sn
        position: action.payload.position ?? 'top', // Varsayılan pozisyon üst
      };
      state.messages.push(newToast);
    },
    // Belirli bir ID'ye sahip toast'ı kaldır
    removeToast: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.filter(msg => msg.id !== action.payload);
    },
    // İsteğe bağlı: Tüm toastları temizle
    clearAllToasts: (state) => {
        state.messages = [];
    }
  },
});

// Action'ları export et
export const { addToast, removeToast, clearAllToasts } = toastSlice.actions;

// Reducer'ı export et
export default toastSlice.reducer; 