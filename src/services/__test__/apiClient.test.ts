// src/services/__tests__/apiClient.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithAuth } from '../apiClient'; // Test edilecek fonksiyon
import { GoogleAuth } from '@plugins/google-auth'; // Mocklanacak plugin
import type { GoogleUser } from '@plugins/google-auth';
import { store } from '../../store'; // Mocklanacak store
import { setRefreshedCredentials, signOutFromGoogleThunk } from '../../store/slices/authSlice'; // Kullanılacak action'lar
// AuthState tipini import ettiğimizi varsayalım (gerçek yolu kontrol edin)
// import type { AuthState } from '../../store/slices/authSlice'; 

// --- Mocking Dependencies ---

// GoogleAuth plugin'ini mockla
vi.mock('@plugins/google-auth', () => ({
  GoogleAuth: {
    trySilentSignIn: vi.fn(),
    // signIn ve signOut gerekirse eklenebilir
  },
}));

// Redux store'u mockla (getState ve dispatch)
vi.mock('../../store', () => ({
  store: {
    getState: vi.fn(),
    dispatch: vi.fn(),
  },
}));

// authSlice action'larını mockla (dispatch çağrılarını doğrulamak için)
vi.mock('../../store/slices/authSlice', () => ({
  setRefreshedCredentials: vi.fn((payload) => ({ type: 'auth/setRefreshedCredentials', payload })),
  signOutFromGoogleThunk: vi.fn(() => ({ type: 'auth/signOutFromGoogleThunk/pending' })), // Thunk'ın pending action'ını mockla
}));

// Global fetch API'sini mockla
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock GoogleUser verisi
const mockNewUser: GoogleUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  imageUrl: null,
  idToken: 'new-id-token',
  accessToken: 'new-access-token-123',
};

// Mock initial GoogleUser
const mockInitialUser: GoogleUser = {
  id: 'user-000',
  email: 'initial@example.com',
  name: 'Initial User',
  imageUrl: null, // Eksik alan eklendi
  idToken: 'initial-id-token', // Eksik alan eklendi (state'den alınabilir)
  accessToken: 'initial-access-token-xyz', // Token state'den alınabilir
};

describe('fetchWithAuth', () => {
  const testUrl = 'https://example.com/api/data';
  const initialToken = mockInitialUser.accessToken!; // initial user'dan alalım

  beforeEach(() => {
    // Her testten önce mockları sıfırla
    vi.clearAllMocks();

    // Varsayılan olarak geçerli bir token ile state'i mockla (AuthState tipine uygun)
    vi.mocked(store.getState).mockReturnValue({
      auth: {
        accessToken: initialToken,
        user: mockInitialUser, // Düzeltilmiş user objesini kullan
        error: null,
      },
      // Diğer slice'lar gerekirse eklenebilir
      loading: { isActive: false }, // Örnek başka bir slice
    } as ReturnType<typeof store.getState>); // Type assertion eklendi

    // Varsayılan fetch yanıtını başarılı (200 OK) olarak ayarla
    mockFetch.mockReset(); // Her test öncesi fetch mock'unu tamamen sıfırla
  });

  it('should add Authorization header with existing token', async () => {
    // Bu test için mock: Başarılı 200 OK
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) } as Response);
    await fetchWithAuth(testUrl);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(testUrl, expect.objectContaining({
        headers: expect.any(Headers)
    }));
    const headers = mockFetch.mock.calls[0][1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe(`Bearer ${initialToken}`);
  });

  it('should return successful response when request is OK', async () => {
    // Bu test için mock: Başarılı 200 OK (Hatanın olduğu test)
    const mockOkResponse = { ok: true, status: 200, json: async () => ({ success: true }) } as Response;
    mockFetch.mockResolvedValueOnce(mockOkResponse); // Eksik olan mock eklendi

    const response = await fetchWithAuth(testUrl);

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledOnce(); // Ekstra doğrulama
  });

  it('should throw error and sign out if no token exists', async () => {
     // Token olmayan (çıkış yapmış) state'i mockla (AuthState tipine uygun)
     vi.mocked(store.getState).mockReturnValue({
       auth: {
         accessToken: null,
         user: null, // Eksik alan eklendi
         error: null, // Eksik alan eklendi
       },
       loading: { isActive: false },
     } as ReturnType<typeof store.getState>); // Type assertion eklendi

     await expect(fetchWithAuth(testUrl)).rejects.toThrow('No access token available.');
     expect(vi.mocked(store.dispatch)).toHaveBeenCalledOnce();
     expect(vi.mocked(store.dispatch)).toHaveBeenCalledWith(signOutFromGoogleThunk());
     expect(mockFetch).not.toHaveBeenCalled();
  });


  // --- Token Refresh Scenarios ---

  describe('when receiving 401 Unauthorized', () => {

    const mock401Response = { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }), text: async () => '' } as Response;
    const mockSuccessResponse = { ok: true, status: 200, json: async () => ({ data: 'refreshed data' }), text: async () => '' } as Response;

    it('should call trySilentSignIn and retry with new token if refresh is successful', async () => {
      // Mock Sırası: İlk fetch 401, ikinci fetch 200
      mockFetch
        .mockResolvedValueOnce(mock401Response)
        .mockResolvedValueOnce(mockSuccessResponse);

      // trySilentSignIn başarılı dönecek
      vi.mocked(GoogleAuth.trySilentSignIn).mockResolvedValue(mockNewUser);

      const response = await fetchWithAuth(testUrl);

      // Doğrulamalar
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // 1. Çağrı (Eski token)
      expect(mockFetch.mock.calls[0][0]).toBe(testUrl);
      expect((mockFetch.mock.calls[0][1]?.headers as Headers).get('Authorization')).toBe(`Bearer ${initialToken}`); // Beklenti: Eski token
      // 2. Çağrı (Yeni token)
      expect(mockFetch.mock.calls[1][0]).toBe(testUrl);
      expect((mockFetch.mock.calls[1][1]?.headers as Headers).get('Authorization')).toBe(`Bearer ${mockNewUser.accessToken}`); // Beklenti: Yeni token

      expect(vi.mocked(GoogleAuth.trySilentSignIn)).toHaveBeenCalledOnce();
      expect(vi.mocked(store.dispatch)).toHaveBeenCalledWith(setRefreshedCredentials(mockNewUser));
      expect(response.ok).toBe(true);
      await expect(response.json()).resolves.toEqual({ data: 'refreshed data' });
    });

    it('should sign out and reject if refresh fails with SIGN_IN_REQUIRED', async () => {
       // Mock Sırası: İlk fetch 401
       mockFetch.mockResolvedValueOnce(mock401Response);

       // trySilentSignIn SIGN_IN_REQUIRED ile başarısız olacak
       const signInRequiredError = new Error("Mock SIGN_IN_REQUIRED") as any;
       signInRequiredError.code = 'SIGN_IN_REQUIRED';
       vi.mocked(GoogleAuth.trySilentSignIn).mockRejectedValue(signInRequiredError);

       // Hata beklentisi
       await expect(fetchWithAuth(testUrl)).rejects.toThrow('Session expired. Please sign in again.');

       // Doğrulamalar
       expect(mockFetch).toHaveBeenCalledOnce();
       expect(vi.mocked(GoogleAuth.trySilentSignIn)).toHaveBeenCalledOnce();
       expect(vi.mocked(store.dispatch)).toHaveBeenCalledWith(signOutFromGoogleThunk());
    });

     it('should reject without signing out if refresh fails with other error', async () => {
       // Mock Sırası: İlk fetch 401
       mockFetch.mockResolvedValueOnce(mock401Response);

       // trySilentSignIn genel hata ile başarısız olacak
       const genericError = new Error("Network Error");
       vi.mocked(GoogleAuth.trySilentSignIn).mockRejectedValue(genericError);

       // Hata beklentisi
       await expect(fetchWithAuth(testUrl)).rejects.toThrow('Failed to refresh token.');

       // Doğrulamalar
       expect(mockFetch).toHaveBeenCalledOnce();
       expect(vi.mocked(GoogleAuth.trySilentSignIn)).toHaveBeenCalledOnce();
       expect(vi.mocked(store.dispatch)).not.toHaveBeenCalledWith(signOutFromGoogleThunk());
     });

     it('should queue subsequent requests while refreshing and process them after successful refresh', async () => {
        // Mock Sırası: url1(401) -> url2(200 - kuyruk) -> url1(200 - retry)
        const mockSuccessResponse1 = { ok: true, status: 200, json: async () => ({ data: 'url1 refreshed' }) } as Response;
        const mockSuccessResponse2 = { ok: true, status: 200, json: async () => ({ data: 'url2 refreshed' }) } as Response;
        mockFetch
            .mockResolvedValueOnce(mock401Response)        // 1. fetch(url1)
            .mockResolvedValueOnce(mockSuccessResponse2)   // 2. fetch(url2) - processQueue'dan
            .mockResolvedValueOnce(mockSuccessResponse1);  // 3. fetch(url1) - .then() retry'dan

        // trySilentSignIn başarılı ama gecikmeli
        vi.mocked(GoogleAuth.trySilentSignIn).mockImplementation(async () => {
            await new Promise(res => setTimeout(res, 50));
            return mockNewUser;
        });

        const url1 = 'https://example.com/api/resource1';
        const url2 = 'https://example.com/api/resource2';

        // İstekleri başlat
        const promise1 = fetchWithAuth(url1);
        await new Promise(res => setTimeout(res, 5));
        const promise2 = fetchWithAuth(url2);

        // Sonuçları bekle
        const [response1, response2] = await Promise.all([promise1, promise2]);

        // Doğrulamalar
        expect(mockFetch).toHaveBeenCalledTimes(3);
        // 1. Çağrı: url1, eski token
        expect(mockFetch.mock.calls[0][0]).toBe(url1);
        expect((mockFetch.mock.calls[0][1]?.headers as Headers).get('Authorization')).toBe(`Bearer ${initialToken}`); // Beklenti: Eski token
        // 2. & 3. Çağrılar: url1/url2, yeni token
        const call2Args = mockFetch.mock.calls[1];
        const call3Args = mockFetch.mock.calls[2];
        expect([call2Args[0], call3Args[0]].sort()).toEqual([url1, url2].sort());
        expect((call2Args[1]?.headers as Headers)?.get('Authorization')).toBe(`Bearer ${mockNewUser.accessToken}`); // Beklenti: Yeni token
        expect((call3Args[1]?.headers as Headers)?.get('Authorization')).toBe(`Bearer ${mockNewUser.accessToken}`); // Beklenti: Yeni token

        expect(vi.mocked(GoogleAuth.trySilentSignIn)).toHaveBeenCalledOnce();
        expect(vi.mocked(store.dispatch)).toHaveBeenCalledWith(setRefreshedCredentials(mockNewUser));
        expect(response1.ok).toBe(true);
        await expect(response1.json()).resolves.toEqual({ data: 'url1 refreshed' });
        expect(response2.ok).toBe(true);
        await expect(response2.json()).resolves.toEqual({ data: 'url2 refreshed' });
     });
  });
});