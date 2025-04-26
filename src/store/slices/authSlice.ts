import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { GoogleAuth } from '@plugins/google-auth'; // Google Auth pluginini import et
import type { GoogleUser } from '@plugins/google-auth'; // GoogleUser tipini import et
import { startGlobalLoading, stopGlobalLoading } from './loadingSlice'; // Global loading actionlarını import et

// --- Async Thunks ---

// Google ile Giriş Yapma Thunk'ı
export const signInWithGoogleThunk = createAsyncThunk(
  'auth/signInWithGoogle',
  async (_, { dispatch, rejectWithValue }) => { 
    dispatch(startGlobalLoading()); 
    try {
      // Calendar scope'u native plugin kodunda istendi.
      // const scopes = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/calendar.events'];
      
      // signIn metoduna argüman göndermiyoruz.
      const user = await GoogleAuth.signIn(); // Argüman kaldırıldı
      
      // Dönen kullanıcı objesini loglayalım (debugging için)
      console.log("GoogleAuth.signIn() result:", JSON.stringify(user));

     
      if (user?.accessToken) {
        return { user, accessToken: user.accessToken }; 
      } else {
        return rejectWithValue('Giriş başarılı ancak ID Token alınamadı.'); // Hata mesajı güncellendi
      }
    } catch (error: any) {
      console.error("Native Google Sign-In Error (Thunk):", error);
      let errorMessage = error.message || JSON.stringify(error);
      // Hata mesajındaki scope notu kaldırılabilir veya genel tutulabilir
      // if (errorMessage.includes('permission') || errorMessage.includes('scope')) {
      //     errorMessage += " (İstenen Takvim izni verilmemiş olabilir mi?)";
      // }
      return rejectWithValue(errorMessage);
    } finally {
        dispatch(stopGlobalLoading()); 
    }
  }
);

// Google'dan Çıkış Yapma Thunk'ı
export const signOutFromGoogleThunk = createAsyncThunk(
  'auth/signOutFromGoogle', // Action type prefix
  async (_, { dispatch, rejectWithValue }) => { // dispatch'i ekle
    dispatch(startGlobalLoading()); // Global loading başlat
    try {
      await GoogleAuth.signOut();
      // Başarılı olursa bir şey dönmeye gerek yok (state clearAuth ile temizlenecek)
      return; 
    } catch (error: any) {
      console.error("Native Google Sign-Out Error (Thunk):", error);
      return rejectWithValue(error.message || JSON.stringify(error));
    } finally {
        dispatch(stopGlobalLoading()); // Global loading durdur (her durumda)
    }
  }
);

// --- Slice Definition ---

interface AuthState {
  user: GoogleUser | null;
  accessToken: string | null; 
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuth: (state) => {
      state.user = null;
      state.accessToken = null;
      state.error = null;
    },
    clearAuthError: (state) => {
        state.error = null;
    },
    // Yeni action: Token yenileme sonrası bilgileri günceller
    setRefreshedCredentials: (state, action: PayloadAction<GoogleUser>) => {
        console.log("AuthSlice: Setting refreshed credentials.");
        state.user = action.payload; // Tüm kullanıcı bilgisi güncellenebilir
        state.accessToken = action.payload.accessToken ?? null; // Yeni access token'ı al
        state.error = null; // Varsa önceki hatayı temizle
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(signInWithGoogleThunk.fulfilled, (state, action: PayloadAction<{ user: GoogleUser; accessToken: string }>) => {
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.error = null;
      })
      .addCase(signInWithGoogleThunk.rejected, (state, action) => {
        state.user = null;
        state.accessToken = null;
        state.error = action.payload as string || 'Google ile giriş yapılamadı.'; 
      })
      .addCase(signOutFromGoogleThunk.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.error = null;
        // TODO kaldırıldı.
      })
      .addCase(signOutFromGoogleThunk.rejected, (state, action) => {
        state.error = action.payload as string || "Google'dan çıkış yapılamadı.";
      });
  },
});

// Senkron actionları export et
export const {
  clearAuth,
  clearAuthError,
  setRefreshedCredentials // Yeni action'ı export et
} = authSlice.actions;

export default authSlice.reducer; 