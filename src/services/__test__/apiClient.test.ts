// src/services/__tests__/apiClient.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithAuth, configureApiClient } from '../apiClient'; // Test edilecek fonksiyon ve configureApiClient'ı da import et
import { GoogleAuth } from '@plugins/google-auth'; // Mocklanacak plugin
import type { GoogleUser } from '@plugins/google-auth';
// import { store } from '../../store'; // KALDIRILDI
import * as storeModule from '../../store'; // Store modülünü import et
import { setRefreshedCredentials, signOutFromGoogleThunk } from '../../store/slices/authSlice'; // Kullanılacak action'lar
import type { RootState } from '../../store'; // RootState tipini import et

// --- Mocking Dependencies ---

// GoogleAuth plugin'ini mockla
vi.mock('@plugins/google-auth', () => ({
  GoogleAuth: {
    trySilentSignIn: vi.fn(),
  },
}));

// Redux store modülünü mockla (getStoreState ve getDispatch'i mockla)
const mockDispatch = vi.fn();
const mockGetState = vi.fn();
vi.mock('../../store', async (importOriginal) => {
  const actual = await importOriginal<typeof storeModule>();
  return {
    ...actual,
    getStoreState: mockGetState, // getStore().getState() yerine bunu mockla
    getDispatch: vi.fn(() => mockDispatch), // getStore().dispatch yerine bunu mockla
  };
});

// authSlice action'larını mockla
vi.mock('../../store/slices/authSlice', () => ({
  setRefreshedCredentials: vi.fn((payload) => ({ type: 'auth/setRefreshedCredentials', payload })),
  signOutFromGoogleThunk: vi.fn(() => ({ type: 'auth/signOutFromGoogleThunk/pending' })),
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
  imageUrl: null,
  idToken: 'initial-id-token',
  accessToken: 'initial-access-token-xyz',
};

describe('fetchWithAuth', () => {
  const testUrl = 'https://example.com/api/data';
  const initialToken = mockInitialUser.accessToken!;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetState.mockClear();
    mockDispatch.mockClear();

    // API İstemcisini her testten önce yapılandır
    // configureApiClient, mock fonksiyonları argüman olarak alır.
    // getDispatch mock'u doğrudan dispatch fonksiyonunu döndürmeli.
    configureApiClient(mockGetState, mockDispatch);

    // Varsayılan state'i mockla
    mockGetState.mockReturnValue({
      auth: {
        accessToken: initialToken,
        user: mockInitialUser,
        error: null,
      },
      loading: { isActive: false },
    } as RootState);

    mockFetch.mockReset();
  });

  it('should add Authorization header with existing token', async () => {
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
    const mockOkResponse = { ok: true, status: 200, json: async () => ({ success: true }) } as Response;
    mockFetch.mockResolvedValueOnce(mockOkResponse);
    const response = await fetchWithAuth(testUrl);
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should throw error and sign out if no token exists', async () => {
    // Token olmayan state'i mockla
    mockGetState.mockReturnValue({
      auth: {
        accessToken: null,
        user: null,
        error: null,
      },
      loading: { isActive: false },
    } as RootState);

    await expect(fetchWithAuth(testUrl)).rejects.toThrow('No access token available.');
    expect(mockDispatch).toHaveBeenCalledOnce(); // mockDispatch kontrolü
    expect(mockDispatch).toHaveBeenCalledWith(signOutFromGoogleThunk()); // mockDispatch kontrolü
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // --- Token Refresh Scenarios ---

  describe('when receiving 401 Unauthorized', () => {
    const mock401Response = { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }), text: async () => '' } as Response;
    const mockSuccessResponse = { ok: true, status: 200, json: async () => ({ data: 'refreshed data' }), text: async () => '' } as Response;

    it('should call trySilentSignIn and retry with new token if refresh is successful', async () => {
      mockFetch
        .mockResolvedValueOnce(mock401Response)
        .mockResolvedValueOnce(mockSuccessResponse);
      vi.mocked(GoogleAuth.trySilentSignIn).mockResolvedValue(mockNewUser);

      const response = await fetchWithAuth(testUrl);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toBe(testUrl);
      expect((mockFetch.mock.calls[0][1]?.headers as Headers).get('Authorization')).toBe(`Bearer ${initialToken}`);
      expect(mockFetch.mock.calls[1][0]).toBe(testUrl);
      expect((mockFetch.mock.calls[1][1]?.headers as Headers).get('Authorization')).toBe(`Bearer ${mockNewUser.accessToken}`);
      expect(vi.mocked(GoogleAuth.trySilentSignIn)).toHaveBeenCalledOnce();
      expect(mockDispatch).toHaveBeenCalledWith(setRefreshedCredentials(mockNewUser)); // mockDispatch kontrolü
      expect(response.ok).toBe(true);
      await expect(response.json()).resolves.toEqual({ data: 'refreshed data' });
    });

    it('should sign out and reject if refresh fails with SIGN_IN_REQUIRED', async () => {
      mockFetch.mockResolvedValueOnce(mock401Response);
      const signInRequiredError = new Error("Mock SIGN_IN_REQUIRED") as any;
      signInRequiredError.code = 'SIGN_IN_REQUIRED';
      vi.mocked(GoogleAuth.trySilentSignIn).mockRejectedValue(signInRequiredError);

      await expect(fetchWithAuth(testUrl)).rejects.toThrow('Session expired. Please sign in again.');
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(vi.mocked(GoogleAuth.trySilentSignIn)).toHaveBeenCalledOnce();
      expect(mockDispatch).toHaveBeenCalledWith(signOutFromGoogleThunk()); // mockDispatch kontrolü
    });

    it('should reject without signing out if refresh fails with other error', async () => {
      mockFetch.mockResolvedValueOnce(mock401Response);
      const genericError = new Error("Network Error");
      vi.mocked(GoogleAuth.trySilentSignIn).mockRejectedValue(genericError);

      await expect(fetchWithAuth(testUrl)).rejects.toThrow('Failed to refresh token.');
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(vi.mocked(GoogleAuth.trySilentSignIn)).toHaveBeenCalledOnce();
      expect(mockDispatch).not.toHaveBeenCalledWith(signOutFromGoogleThunk()); // mockDispatch kontrolü
    });

    it('should queue subsequent requests while refreshing and process them after successful refresh', async () => {
      const mockSuccessResponse1 = { ok: true, status: 200, json: async () => ({ data: 'url1 refreshed' }) } as Response;
      const mockSuccessResponse2 = { ok: true, status: 200, json: async () => ({ data: 'url2 refreshed' }) } as Response;
      mockFetch
        .mockResolvedValueOnce(mock401Response)
        .mockResolvedValueOnce(mockSuccessResponse2)
        .mockResolvedValueOnce(mockSuccessResponse1);

      vi.mocked(GoogleAuth.trySilentSignIn).mockImplementation(async () => {
        await new Promise(res => setTimeout(res, 50));
        return mockNewUser;
      });

      const url1 = 'https://example.com/api/resource1';
      const url2 = 'https://example.com/api/resource2';

      const promise1 = fetchWithAuth(url1);
      await new Promise(res => setTimeout(res, 5));
      const promise2 = fetchWithAuth(url2);

      const [response1, response2] = await Promise.all([promise1, promise2]);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch.mock.calls[0][0]).toBe(url1);
      expect((mockFetch.mock.calls[0][1]?.headers as Headers).get('Authorization')).toBe(`Bearer ${initialToken}`);
      const call2Args = mockFetch.mock.calls[1];
      const call3Args = mockFetch.mock.calls[2];
      expect([call2Args[0], call3Args[0]].sort()).toEqual([url1, url2].sort());
      expect((call2Args[1]?.headers as Headers)?.get('Authorization')).toBe(`Bearer ${mockNewUser.accessToken}`);
      expect((call3Args[1]?.headers as Headers)?.get('Authorization')).toBe(`Bearer ${mockNewUser.accessToken}`);
      expect(vi.mocked(GoogleAuth.trySilentSignIn)).toHaveBeenCalledOnce();
      expect(mockDispatch).toHaveBeenCalledWith(setRefreshedCredentials(mockNewUser)); // mockDispatch kontrolü
      expect(response1.ok).toBe(true);
      await expect(response1.json()).resolves.toEqual({ data: 'url1 refreshed' });
      expect(response2.ok).toBe(true);
      await expect(response2.json()).resolves.toEqual({ data: 'url2 refreshed' });
    });
  });
});