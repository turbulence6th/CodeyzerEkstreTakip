// GoogleAuthPlugin.java
package com.codeyzer.ekstre;

import android.content.Intent;
import android.os.AsyncTask;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.common.api.Scope;

// Access Token almak için gerekli importlar (GoogleAuthUtil eski ama deneyelim)
// DEPRECATED WARNING: GoogleAuthUtil is deprecated and may be removed in future SDKs.
// Consider using server-side auth code exchange or Google Identity Services (Credential Manager).
import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.GoogleAuthException;
import java.io.IOException;
import android.accounts.Account; // Account nesnesi için

// Firebase importları
import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;

@CapacitorPlugin(name = "GoogleAuth")
public class GoogleAuthPlugin extends Plugin {

    private static final String TAG = "GoogleAuthPlugin";
    private GoogleSignInClient googleSignInClient;
    private FirebaseAuth firebaseAuth;
    // Scope sabitlerini tanımla
    private static final String GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
    private static final String CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";
    // Access token için kullanılacak birleşik scope string'i (oauth2: prefixi ile ve boşlukla ayrılmış)
    private static final String REQUIRED_SCOPES_FOR_TOKEN = "oauth2:" + GMAIL_READONLY_SCOPE + " " + CALENDAR_EVENTS_SCOPE;

    // Sağlanan Web İstemci Kimliği (Firebase ile ilişkili GCP projesindeki Web ID olmalı)
    private static final String WEB_CLIENT_ID = "1008857567754-2s7hevrbudal3m8qju85g31souc8v4g5.apps.googleusercontent.com";

    @Override
    public void load() {
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(WEB_CLIENT_ID) // ID Token istemek için Web Client ID gerekli
                .requestEmail()
                // İstenen scope'ları ekle (Gmail ve Calendar)
                .requestScopes(new Scope(GMAIL_READONLY_SCOPE), new Scope(CALENDAR_EVENTS_SCOPE))
                // İsteğe bağlı: Server Auth Code istemek için (backend ile kullanılacaksa)
                // .requestServerAuthCode(WEB_CLIENT_ID)
                .build();
        googleSignInClient = GoogleSignIn.getClient(getContext(), gso);
        firebaseAuth = FirebaseAuth.getInstance(); // Firebase Auth örneğini al
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        Intent signInIntent = googleSignInClient.getSignInIntent();
        saveCall(call);
        startActivityForResult(call, signInIntent, "handleSignInResult");
    }

    @ActivityCallback
    private void handleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            Log.e(TAG, "PluginCall missing");
            return;
        }
        // Google Sign In sonucunu işle
        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(result.getData());
        try {
            // Google Sign In başarılı
            GoogleSignInAccount account = task.getResult(ApiException.class);
            Log.d(TAG, "Google Sign In successful.");

            // --- Access Token Alma Denemesi (AsyncTask ile arka planda) ---
            // Bu, UI thread'ini bloke etmemek için önemlidir.
            new GetAccessTokenTask(call, account).execute();

            // Firebase ile giriş kısmı AsyncTask içinde yapılacak

        } catch (ApiException e) {
            Log.w(TAG, "Google Sign In failed code=" + e.getStatusCode());
            if (e.getStatusCode() == 12501) {
                // Kullanıcı iptal etti (SIGN_IN_CANCELLED)
                call.reject("Sign-in cancelled by user.");
            } else if (e.getStatusCode() == 7) {
                 // Ağ hatası (NETWORK_ERROR)
                call.reject("Network error during sign-in.");
            } else {
                 call.reject("Google Sign-in failed: " + e.getStatusCode());
            }
        } catch (Exception e) {
             // Diğer beklenmedik hatalar
            Log.e(TAG, "Unexpected error during sign-in process", e);
            call.reject("Unexpected error: " + e.getMessage());
        }
    }

    // --- YENİ METOT: trySilentSignIn ---
    @PluginMethod
    public void trySilentSignIn(PluginCall call) {
        Log.d(TAG, "Attempting silent sign in...");
        // saveCall(call); // Sessiz giriş için sonucu ActivityCallback beklemiyoruz, doğrudan Task kullanacağız

        // Önce mevcut giriş yapmış kullanıcıyı kontrol et (hızlandırma için)
        // GoogleSignInAccount lastAccount = GoogleSignIn.getLastSignedInAccount(getContext());
        // if (lastAccount != null && GoogleSignIn.hasPermissions(lastAccount, new Scope(GMAIL_READONLY_SCOPE), new Scope(CALENDAR_EVENTS_SCOPE))) {
        //     Log.d(TAG, "Found last signed in account with required permissions.");
        //     // İzinler varsa doğrudan token almayı dene
        //     new GetAccessTokenTask(call, lastAccount).execute();
        //     return;
        // }
        // Not: getLastSignedInAccount bazen güncel token vermeyebilir, silentSignIn daha güvenilir.

        Task<GoogleSignInAccount> task = googleSignInClient.silentSignIn();

        if (task.isSuccessful()) {
            // Eğer görev hemen başarılıysa (cachelenmiş geçerli oturum varsa)
            Log.d(TAG, "Silent sign in successful (immediately)");
            GoogleSignInAccount account = task.getResult();
            // Access token al ve sonucu döndür
            new GetAccessTokenTask(call, account).execute();
        } else {
            // Görev hemen başarılı değilse, tamamlanmasını bekle
            task.addOnCompleteListener(getActivity(), completedTask -> {
                try {
                    if (completedTask.isSuccessful()) {
                        Log.d(TAG, "Silent sign in successful (on complete)");
                        GoogleSignInAccount account = completedTask.getResult();
                        // Access token al ve sonucu döndür
                        new GetAccessTokenTask(call, account).execute();
                    } else {
                        // Sessiz giriş başarısız
                        Log.w(TAG, "Silent sign in failed.", completedTask.getException());
                        // Hata sebebini kontrol et
                        Exception exception = completedTask.getException();
                        if (exception instanceof ApiException) {
                            ApiException apiException = (ApiException) exception;
                            if (apiException.getStatusCode() == com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes.SIGN_IN_REQUIRED) {
                                // Kullanıcının manuel giriş yapması gerekiyor
                                call.reject("Silent sign-in failed. User needs to sign in manually.", "SIGN_IN_REQUIRED");
                            } else {
                                // Diğer API hataları
                                call.reject("Silent sign-in failed with API error: " + apiException.getStatusCode());
                            }
                        } else {
                            // Diğer beklenmedik hatalar
                            call.reject("Silent sign-in failed: " + (exception != null ? exception.getMessage() : "Unknown error"));
                        }
                    }
                } catch (Exception e) {
                    // Beklenmedik bir hata oluştu
                    Log.e(TAG, "Unexpected error during silent sign-in completion", e);
                    call.reject("Unexpected error during silent sign-in: " + e.getMessage());
                }
            });
        }
    }
    // --- trySilentSignIn SONU ---

    // AsyncTask Access Token almak için (güncellenmiş scope ile)
    // DEPRECATED WARNING: AsyncTask is deprecated in API level 30 (Android 11).
    // Consider using standard Java concurrent utilities (e.g., ExecutorService) or Kotlin Coroutines.
    private class GetAccessTokenTask extends AsyncTask<Void, Void, String> {
        private PluginCall call;
        private GoogleSignInAccount googleAccount;
        private Exception exception = null;

        GetAccessTokenTask(PluginCall call, GoogleSignInAccount account) {
            this.call = call;
            this.googleAccount = account;
        }

        @Override
        protected String doInBackground(Void... params) {
            try {
                Account androidAccount = googleAccount.getAccount();
                if (androidAccount == null) {
                   throw new IOException("Google Account not found on device.");
                }
                 // Güncellenmiş birleşik scope'u kullan
                 Log.d(TAG, "Attempting to get Access Token for scopes: " + REQUIRED_SCOPES_FOR_TOKEN);
                // DEPRECATED WARNING: GoogleAuthUtil.getToken is deprecated.
                // This client-side token retrieval is less secure and may stop working.
                // The recommended approach is server-side auth code exchange.
                String accessToken = GoogleAuthUtil.getToken(getContext(), androidAccount, REQUIRED_SCOPES_FOR_TOKEN);
                Log.d(TAG, "Access Token obtained successfully.");
                return accessToken;
            } catch (IOException | GoogleAuthException e) {
                Log.e(TAG, "Error getting Access Token", e);
                this.exception = e;
                return null;
            }
        }

        @Override
        protected void onPostExecute(String accessToken) {
            // Ana thread'e geri döndük. Firebase ile devam et ve sonucu döndür.

            if (accessToken == null || exception != null) {
                 String errorMsg = "Failed to get Access Token";
                 if (exception != null) {
                     errorMsg += ": " + exception.getMessage();
                 }
                 // Erişim token'ı alınamasa bile Firebase ile devam etmeyi deneyebiliriz (sadece kimlik doğrulama için)
                 // Veya burada doğrudan reject edebiliriz. Şimdilik devam edelim.
                 Log.w(TAG, errorMsg);
                 // call.reject(errorMsg);
                 // return;
            }

            // ID Token ile Firebase Credential oluştur (googleAccount hala geçerli)
             if (googleAccount.getIdToken() == null) {
                 call.reject("Google ID Token is null, cannot proceed with Firebase sign in.");
                 return;
             }
            AuthCredential credential = GoogleAuthProvider.getCredential(googleAccount.getIdToken(), null);

            // Firebase'e giriş yap
            firebaseAuth.signInWithCredential(credential)
                .addOnCompleteListener(getActivity(), authTask -> {
                    if (authTask.isSuccessful()) {
                        FirebaseUser user = firebaseAuth.getCurrentUser();
                        Log.d(TAG, "Firebase Sign In successful: " + user.getEmail());
                        JSObject userResult = new JSObject();
                        userResult.put("id", googleAccount.getId());
                        userResult.put("name", googleAccount.getDisplayName());
                        userResult.put("email", googleAccount.getEmail());
                        userResult.put("imageUrl", googleAccount.getPhotoUrl() != null ? googleAccount.getPhotoUrl().toString() : null);
                        userResult.put("idToken", googleAccount.getIdToken()); // Google ID Token
                        userResult.put("accessToken", accessToken); // <<< Alınan Access Token eklendi (null olabilir)
                        call.resolve(userResult);
                    } else {
                        Log.w(TAG, "Firebase Sign In failed", authTask.getException());
                        call.reject("Firebase Sign In failed: " + authTask.getException().getMessage());
                    }
                });
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        // Önce Firebase'den çıkış yap
        firebaseAuth.signOut();
        // Sonra Google'dan çıkış yap
        googleSignInClient.signOut().addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                Log.d(TAG, "Google Sign Out successful");
                call.resolve();
            } else {
                // Google çıkışı başarısız olsa bile devam edebiliriz, Firebase çıkışı önemli.
                Log.w(TAG, "Google Sign Out failed", task.getException());
                call.resolve(); // Yine de resolve edebiliriz
            }
        });
    }
} 