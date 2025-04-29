import { GoogleAuth } from '@plugins/google-auth';
import type { GoogleUser } from '@plugins/google-auth';

// Redux store'a erişim (Doğrudan import riskli olabilir, alternatifler düşünülebilir)
// Şimdilik store'u doğrudan import ettiğimizi varsayalım.
// Daha iyi bir yöntem, bu fonksiyonu configure edip store'u dışarıdan vermek olabilir.
import { store } from '../store'; 
import { setRefreshedCredentials, signOutFromGoogleThunk } from '../store/slices/authSlice';

let isRefreshing = false; // Aynı anda birden fazla yenileme denemesini önle
let failedRequestQueue: Array<{ resolve: (value: Response) => void; reject: (reason?: any) => void; url: string; options: RequestInit }> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
    failedRequestQueue.forEach(prom => {
        if (error || !token) {
            prom.reject(error);
        } else {
            // prom.options, sıraya eklenirken klonlanan seçenekleri içerir
            // Sıradaki istek için yeni token ile yeni seçenekler oluştur
            const queuedOptions = { ...prom.options }; // Sıradaki öğenin seçeneklerini klonla
            const headers = new Headers(queuedOptions.headers); // Başlıkları al
            headers.set('Authorization', `Bearer ${token}`); // Yeni token ile güncelle
            queuedOptions.headers = headers;

            fetch(prom.url, queuedOptions).then(prom.resolve).catch(prom.reject); // Klonlanmış ve güncellenmiş seçeneklerle fetch yap
        }
    });
    failedRequestQueue = [];
};

/**
 * Google API'lerine yetkilendirme başlığı ekleyerek ve 
 * 401 hatası durumunda token yenilemeyi deneyerek fetch isteği yapar.
 * @param url İstek yapılacak URL.
 * @param options Fetch API seçenekleri.
 * @param retried Yenileme sonrası tekrar deneme olup olmadığını belirtir.
 * @returns Fetch Response nesnesi.
 */
export const fetchWithAuth = async (url: string, options: RequestInit = {}, retried = false): Promise<Response> => {
    const state = store.getState();
    const initialToken = state.auth.accessToken;

    if (!initialToken) {
        console.error('fetchWithAuth: No access token found. Forcing sign out.');
        store.dispatch(signOutFromGoogleThunk());
        throw new Error('No access token available.');
    }

    // --- İlk Deneme için Seçenekleri Klonla ---
    const firstAttemptOptions = { ...options };
    const firstAttemptHeaders = new Headers(firstAttemptOptions.headers);
    firstAttemptHeaders.set('Authorization', `Bearer ${initialToken}`);
    firstAttemptOptions.headers = firstAttemptHeaders;

    // Eğer token yenileniyorsa, isteği sıraya al (klonlanmış seçeneklerle)
    if (isRefreshing) {
        return new Promise((resolve, reject) => {
            failedRequestQueue.push({ resolve, reject, url, options: firstAttemptOptions });
        });
    }

    try {
        // --- İlk Fetch Çağrısı ---
        const response = await fetch(url, firstAttemptOptions); // Klonlanmış seçenekleri kullan

        if (response.status === 401 && !retried) {
            console.warn('fetchWithAuth: Received 401 Unauthorized. Attempting token refresh...');
            isRefreshing = true;

            const retryPromise = new Promise<Response>((resolve, reject) => {
                 GoogleAuth.trySilentSignIn()
                    .then(async (newUser: GoogleUser) => {
                        console.log('fetchWithAuth: Silent sign-in successful. Updating token.');
                        store.dispatch(setRefreshedCredentials(newUser));
                        const newToken = newUser.accessToken;
                        processQueue(null, newToken); // Sırayı yeni token ile işle

                        // --- Tekrar Deneme için Seçenekleri Tekrar Klonla ---
                        const retryOptions = { ...options }; // Orijinal seçenekleri tekrar klonla
                        const retryHeaders = new Headers(retryOptions.headers);
                        retryHeaders.set('Authorization', `Bearer ${newToken}`); // Yeni token'ı ayarla
                        retryOptions.headers = retryHeaders;

                        // --- Tekrar Deneme Fetch Çağrısı ---
                        resolve(fetch(url, retryOptions)); // Tekrar deneme için klonlanmış seçenekleri kullan
                    })
                    .catch((err) => {
                        console.error('fetchWithAuth: Silent sign-in failed.', err);
                         const requiresLogin = err?.code === 'SIGN_IN_REQUIRED' || err?.message?.includes('SIGN_IN_REQUIRED');
                         const refreshError = requiresLogin
                            ? new Error('Session expired. Please sign in again.')
                            : new Error('Failed to refresh token.');

                         processQueue(refreshError, null); // Sırayı hata ile reddet

                         if (requiresLogin) {
                            console.error('Token refresh requires manual sign in. Signing out...');
                            store.dispatch(signOutFromGoogleThunk());
                         }
                         reject(refreshError); // Mevcut promise'i reddet
                    })
                    .finally(() => {
                        isRefreshing = false;
                    });
             });
            return await retryPromise;
        } else if (!response.ok) {
            console.error(`fetchWithAuth: Request failed with status ${response.status} for URL ${url}`, await response.text().catch(() => '[Could not read response text]'));
            throw new Error(`Request failed with status ${response.status}`);
        }

        return response; // Başarılı yanıt

    } catch (error) {
        // Bizim tarafımızdan fırlatılan bilinen hataları tekrar loglama
        if (!(error instanceof Error && (error.message.startsWith('Request failed with status') || error.message === 'Session expired. Please sign in again.' || error.message === 'Failed to refresh token.' || error.message === 'No access token available.'))) {
           console.error('fetchWithAuth: Network or other error', error);
        }
        throw error; // Orijinal hatayı tekrar fırlat
    }
};