import type { RootState, AppDispatch } from '../store'; // Sadece tipleri import et
import { GoogleAuth } from '@plugins/google-auth';
import type { GoogleUser } from '@plugins/google-auth';
// Aksiyonlar hala gerekli
import { setRefreshedCredentials, signOutFromGoogleThunk } from '../store/slices/authSlice';

// Getter importlarını kaldır
// import { getStoreState, getDispatch } from '../store';

// Bağımlılıkları saklamak için iç değişkenler
let internalGetState: (() => RootState) | null = null;
let internalDispatch: AppDispatch | null = null;

// Bağımlılıkları enjekte etmek için konfigürasyon fonksiyonu
export const configureApiClient = (getStateFunc: () => RootState, dispatchFunc: AppDispatch) => {
  if (!getStateFunc || !dispatchFunc) {
    throw new Error ('Invalid arguments provided to configureApiClient');
  }
  internalGetState = getStateFunc;
  internalDispatch = dispatchFunc;
  console.log('[API Client] Dependencies injected successfully.');
};


let isRefreshing = false;
let failedRequestQueue: Array<{ resolve: (value: Response) => void; reject: (reason?: any) => void; url: string; options: RequestInit }> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  // Dispatch fonksiyonuna erişim kontrolü
  if (!internalDispatch) {
    console.error('[API Client ProcessQueue] Dispatch is not available. Cannot process queue.');
    // Hata durumunda sırayı temizleyip reddetmek mantıklı olabilir
     failedRequestQueue.forEach(prom => prom.reject(new Error('API Client not configured during queue processing')));
     failedRequestQueue = [];
    return;
  }

  failedRequestQueue.forEach(prom => {
      // ... (processQueue içeriği aynı kalıyor, sadece internalDispatch kullanacak)
      // Örneğin signout dispatch edilecekse:
      // if (error && error.message === 'Session expired. Please sign in again.'){
      //    internalDispatch(signOutFromGoogleThunk());
      // }
      // Not: processQueue şu anki halinde dispatch çağırmıyor, bu sadece örnek.
      
      // Önceki kodda olduğu gibi fetch işlemini yap
      if (error || !token) {
            prom.reject(error);
        } else {
            const queuedOptions = { ...prom.options };
            const headers = new Headers(queuedOptions.headers);
            headers.set('Authorization', `Bearer ${token}`);
            queuedOptions.headers = headers;
            fetch(prom.url, queuedOptions).then(prom.resolve).catch(prom.reject);
        }
    });
    failedRequestQueue = [];
};


export const fetchWithAuth = async (url: string, options: RequestInit = {}, retried = false): Promise<Response> => {
    // Konfigürasyon kontrolü
    if (!internalGetState || !internalDispatch) {
      console.error('[API Client fetchWithAuth] API Client not configured.');
      // Belki daha bilgilendirici bir hata fırlatılabilir
      throw new Error('API Client has not been configured. Call configureApiClient first.');
    }
    
    // Enjekte edilen fonksiyonları kullan
    const state = internalGetState();
    const initialToken = state.auth.accessToken;

    if (!initialToken) {
        console.error('fetchWithAuth: No access token found. Forcing sign out.');
        internalDispatch!(signOutFromGoogleThunk());
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
                 // Yenileme işlemi sırasında dispatch ve state erişimi kontrolü yine gerekli!
                 if (!internalGetState || !internalDispatch) {
                     console.error('[API Client Refresh] API Client lost configuration during refresh.');
                     const configError = new Error('API Client lost configuration during token refresh.');
                     processQueue(configError, null);
                     reject(configError);
                     isRefreshing = false;
                     return;
                 }

                 GoogleAuth.trySilentSignIn()
                    .then(async (newUser: GoogleUser) => {
                        console.log('fetchWithAuth: Silent sign-in successful. Updating token.');
                        internalDispatch!(setRefreshedCredentials(newUser));
                        const newToken = newUser.accessToken;
                        processQueue(null, newToken);

                        // --- Tekrar Deneme için Seçenekleri Tekrar Klonla ---
                        const retryOptions = { ...options }; // Orijinal seçenekleri tekrar klonla
                        const retryHeaders = new Headers(retryOptions.headers);
                        retryHeaders.set('Authorization', `Bearer ${newToken}`); // Yeni token'ı ayarla
                        retryOptions.headers = retryHeaders;

                        // --- Tekrar Deneme Fetch Çağrısı ---
                        resolve(fetch(url, retryOptions)); // Tekrar deneme için klonlanmış seçenekleri kullan
                    })
                    .catch((err) => {
                         // Hata durumunda da dispatch kontrolü
                         if (!internalGetState || !internalDispatch) {
                              console.error('[API Client Refresh Catch] API Client lost configuration.');
                              const configError = new Error('API Client lost configuration during token refresh error handling.');
                              processQueue(configError, null);
                              reject(configError);
                              isRefreshing = false;
                              return;
                          }

                         console.error('fetchWithAuth: Silent sign-in failed.', err);
                         const requiresLogin = err?.code === 'SIGN_IN_REQUIRED' || err?.message?.includes('SIGN_IN_REQUIRED');
                         const refreshError = requiresLogin
                            ? new Error('Session expired. Please sign in again.')
                            : new Error('Failed to refresh token.');

                         processQueue(refreshError, null); // Sırayı hata ile reddet

                         if (requiresLogin) {
                            console.error('Token refresh requires manual sign in. Signing out...');
                            internalDispatch!(signOutFromGoogleThunk());
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