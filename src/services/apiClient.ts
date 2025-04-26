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
            // Yeni token ile isteği tekrar dene (resolve/reject bu noktada devrediliyor)
             if(prom.options.headers) {
                 (prom.options.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
             }
             fetch(prom.url, prom.options).then(prom.resolve).catch(prom.reject);
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
    const token = state.auth.accessToken;

    if (!token) {
        console.error('fetchWithAuth: No access token found. Forcing sign out.');
        // Token yoksa doğrudan çıkış yap (veya login'e yönlendir)
        store.dispatch(signOutFromGoogleThunk()); 
        throw new Error('No access token available.');
    }

    // Authorization başlığını ekle
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    options.headers = headers;

    // Eğer şu anda token yenileniyorsa, isteği sıraya al
    if (isRefreshing) {
        return new Promise((resolve, reject) => {
            failedRequestQueue.push({ resolve, reject, url, options });
        });
    }

    try {
        const response = await fetch(url, options);

        if (response.status === 401 && !retried) {
            console.warn('fetchWithAuth: Received 401 Unauthorized. Attempting token refresh...');
            isRefreshing = true; // Yenileme başladı

            // Diğer istekleri bekletmek için Promise sarmalayıcısı
             const retryPromise = new Promise<Response>((resolve, reject) => {
                 GoogleAuth.trySilentSignIn()
                    .then(async (newUser: GoogleUser) => {
                        console.log('fetchWithAuth: Silent sign-in successful. Updating token.');
                        // Store'u yeni token ile güncelle (yeni action ile)
                        store.dispatch(setRefreshedCredentials(newUser));
                        // Sıradaki istekleri işle (yeni token ile)
                        processQueue(null, newUser.accessToken);
                        // Bu isteği de yeni token ile tekrar dene
                        if (options.headers) {
                             (options.headers as Record<string, string>)['Authorization'] = `Bearer ${newUser.accessToken}`;
                        }
                         resolve(fetch(url, options)); // Tekrar denenen isteğin sonucunu döndür
                    })
                    .catch((err) => {
                        console.error('fetchWithAuth: Silent sign-in failed.', err);
                         const requiresLogin = err?.code === 'SIGN_IN_REQUIRED' || err?.message?.includes('SIGN_IN_REQUIRED');
                         // Sıradaki istekleri hatayla reddet
                         processQueue(new Error('Token refresh failed'), null);
                         if (requiresLogin) {
                            console.error('Token refresh requires manual sign in. Signing out...');
                            store.dispatch(signOutFromGoogleThunk());
                            reject(new Error('Session expired. Please sign in again.'));
                         } else {
                            reject(new Error('Failed to refresh token.'));
                         }
                    })
                    .finally(() => {
                        isRefreshing = false; // Yenileme bitti
                    });
             });
            return await retryPromise; // Yenileme ve tekrar deneme sonucunu bekle

        } else if (!response.ok) {
            // 401 dışında bir hata durumu
            console.error(`fetchWithAuth: Request failed with status ${response.status}`, await response.text().catch(() => ''));
            throw new Error(`Request failed with status ${response.status}`);
        }

        // Başarılı yanıt
        return response;

    } catch (error) {
        console.error('fetchWithAuth: Network or other error', error);
        throw error; // Hata tekrar fırlatılıyor
    }
}; 