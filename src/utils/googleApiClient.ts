// src/utils/googleApiClient.ts
// Gmail ve Calendar servisleri tarafından paylaşılan Google API çağrı sarmalayıcısı

import { GoogleAuth } from '@plugins/google-auth';
import { getStore } from '../store';
import { setAuthCredentials, clearAuth } from '../store/slices/authSlice';

interface NativePluginError extends Error {
  code?: string;
  message: string;
}

/**
 * Native Google API çağrılarını hata yönetimi ve otomatik yeniden kimlik doğrulama ile sarmalar.
 * SIGN_IN_REQUIRED, INVALID_GRANT veya NOT_SIGNED_IN hatalarında sessiz oturum açma dener.
 */
export async function callNativeGoogleApi<T>(
  nativeApiFunction: () => Promise<T>,
  isRetry: boolean = false
): Promise<T> {
  try {
    return await nativeApiFunction();
  } catch (e) {
    const error = e as NativePluginError;
    // iOS 'NOT_SIGNED_IN', Android 'SIGN_IN_REQUIRED' döndürebilir. Her ikisini de kapsayalım.
    if (error && (error.code === "SIGN_IN_REQUIRED" || error.code === "INVALID_GRANT" || error.code === "NOT_SIGNED_IN")) {
      if (isRetry) {
        console.error(
          'callNativeGoogleApi: Silent sign-in was already attempted and failed, or the API call failed again after retry. Logging out.'
        );
        getStore().dispatch(clearAuth());
        throw new Error('Authentication failed after retry and silent sign-in attempt.');
      }
      console.warn(
        `callNativeGoogleApi: Native API call failed with code: ${error.code}. Attempting silent sign-in.`
      );
      try {
        const silentSignInResult = await GoogleAuth.trySilentSignIn();
        if (silentSignInResult && silentSignInResult.idToken) {
          getStore().dispatch(setAuthCredentials(silentSignInResult));
          console.log(
            'callNativeGoogleApi: Silent sign-in successful. Retrying original native API call.'
          );
          return await callNativeGoogleApi(nativeApiFunction, true);
        } else {
          console.error(
            'callNativeGoogleApi: Silent sign-in did not return the necessary credentials (e.g., idToken). Logging out.'
          );
          getStore().dispatch(clearAuth());
          throw new Error('Silent sign-in failed to provide necessary credentials.');
        }
      } catch (silentError) {
        const sError = silentError as NativePluginError;
        console.error('callNativeGoogleApi: Silent sign-in attempt also failed:', sError.message);
        getStore().dispatch(clearAuth());
        throw new Error(`Silent sign-in attempt failed: ${sError.message || 'Unknown error'}`);
      }
    }
    console.error(
      `callNativeGoogleApi: Native API call failed with an unhandled error or a non-auth error: ${error.message}, Code: ${error.code}`
    );
    throw error;
  }
}
