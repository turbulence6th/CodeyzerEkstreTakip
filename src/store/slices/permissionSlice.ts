import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { SmsPermissionStatus } from '@plugins/sms-reader'; // Tipi import et
import { statementProcessor } from '../../services/sms-parsing/sms-processor'; // statementProcessor'ı import et
import { startGlobalLoading, stopGlobalLoading } from './loadingSlice'; // Global loading actionlarını import et

// --- Async Thunks ---

// Mevcut SMS iznini kontrol etme Thunk'ı
export const checkSmsPermissionThunk = createAsyncThunk(
  'permissions/checkSms', // Action type prefix
  async (_, { dispatch, rejectWithValue }) => { // dispatch'i ekle
    dispatch(startGlobalLoading()); // Global loading başlat
    try {
      console.log("Checking SMS permission (Thunk)...");
      const status = await statementProcessor.checkSmsPermission(); 
      console.log("SMS Permission status (Thunk):", status);
      return status; // Başarılı olursa status dönecek
    } catch (err: any) {
      console.error('Error checking SMS permission (Thunk):', err);
      return rejectWithValue(err.message || JSON.stringify(err)); // Hata durumunda mesajı dön
    } finally {
        dispatch(stopGlobalLoading()); // Global loading durdur (her durumda)
    }
  }
);

// SMS izni isteme Thunk'ı
export const requestSmsPermissionThunk = createAsyncThunk(
  'permissions/requestSms', // Action type prefix
  async (_, { dispatch, rejectWithValue }) => { // dispatch'i ekle
    dispatch(startGlobalLoading()); // Global loading başlat
    try {
      console.log("Requesting SMS permission (Thunk)...");
      const status = await statementProcessor.requestSmsPermission(); 
      console.log("SMS Permission request result (Thunk):", status);
      return status; // Başarılı olursa status dönecek
    } catch (err: any) {
      console.error('Error requesting SMS permission (Thunk):', err);
      return rejectWithValue(err.message || JSON.stringify(err)); // Hata durumunda mesajı dön
    } finally {
        dispatch(stopGlobalLoading()); // Global loading durdur (her durumda)
    }
  }
);

// --- Slice Definition ---

interface PermissionState {
  sms: SmsPermissionStatus | null;
  error: string | null;
}

const initialState: PermissionState = {
  sms: null,
  error: null,
};

const permissionSlice = createSlice({
  name: 'permissions',
  initialState,
  reducers: {
    clearSmsPermissionError: (state) => {
        state.error = null;
    },
    clearSmsPermission: (state) => {
        state.sms = null;
        state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkSmsPermissionThunk.fulfilled, (state, action: PayloadAction<SmsPermissionStatus>) => {
        state.sms = action.payload;
        state.error = null;
      })
      .addCase(checkSmsPermissionThunk.rejected, (state, action) => {
        state.error = action.payload as string || 'SMS izin durumu kontrol edilemedi.';
        state.sms = { readSms: 'denied' }; 
      })
      .addCase(requestSmsPermissionThunk.fulfilled, (state, action: PayloadAction<SmsPermissionStatus>) => {
        state.sms = action.payload;
        state.error = null;
      })
      .addCase(requestSmsPermissionThunk.rejected, (state, action) => {
        state.error = action.payload as string || 'SMS izni istenemedi.';
        state.sms = state.sms ?? { readSms: 'denied' }; 
      });
  },
});

export const {
  clearSmsPermissionError,
  clearSmsPermission,
} = permissionSlice.actions;

export default permissionSlice.reducer; 