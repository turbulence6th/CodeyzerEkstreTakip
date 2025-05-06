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
      // signIn metoduna argüman göndermiyoruz.
      const user: GoogleUser | undefined = await GoogleAuth.signIn(); // Argüman kaldırıldı, GoogleUser tipi güncellenmiş olmalı
      
      // Dönen kullanıcı objesini loglayalım (debugging için)
      console.log("GoogleAuth.signIn() result:", JSON.stringify(user));

     
      if (user && user.idToken) { // user objesi ve idToken var mı diye kontrol edelim
        return user; // Sadece user objesini döndür
      } else {
        return rejectWithValue('Google ile giriş başarılı ancak beklenen kullanıcı bilgileri (örn. idToken) alınamadı.');
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
  idToken: string | null; // idToken'ı ayrı saklamak isteyebiliriz veya user objesinde tutulabilir.
                          // Şimdilik user objesinde olduğunu varsayalım ve idToken'ı ayrıca state'e ekleyelim.
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  idToken: null, // idToken için başlangıç değeri
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuth: (state) => {
      state.user = null;
      state.idToken = null;
      state.error = null;
    },
    clearAuthError: (state) => {
        state.error = null;
    },
    // setAuthCredentials olarak yeniden adlandıralım, hem ilk giriş hem de yenileme için kullanılabilir.
    setAuthCredentials: (state, action: PayloadAction<GoogleUser>) => {
        console.log("AuthSlice: Setting auth credentials.");
        state.user = action.payload; 
        state.idToken = action.payload.idToken ?? null;
        state.error = null; 
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(signInWithGoogleThunk.fulfilled, (state, action: PayloadAction<GoogleUser>) => {
        state.user = action.payload;
        state.idToken = action.payload.idToken ?? null;
        state.error = null;
      })
      .addCase(signInWithGoogleThunk.rejected, (state, action) => {
        state.user = null;
        state.idToken = null;
        state.error = action.payload as string || 'Google ile giriş yapılamadı.'; 
      })
      .addCase(signOutFromGoogleThunk.fulfilled, (state) => {
        state.user = null;
        state.idToken = null;
        state.error = null;
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
  setAuthCredentials // setRefreshedCredentials yerine setAuthCredentials oldu
} = authSlice.actions;

export default authSlice.reducer; 