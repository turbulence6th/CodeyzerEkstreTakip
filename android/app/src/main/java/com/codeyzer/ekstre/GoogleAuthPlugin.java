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

// Google API Client Library ve Calendar API için importlar
// import com.google.api.client.extensions.android.http.AndroidHttp; // KULLANIMDAN KALDIRILDI
import com.google.api.client.http.javanet.NetHttpTransport; // YENİ IMPORT
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;
import com.google.api.services.calendar.model.EventReminder;
import com.google.api.services.calendar.model.Events;

// GMAIL API için importlar
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.ListMessagesResponse;
import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.MessagePartBody;

// Yeni Google Auth Library importları
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

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
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();

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
    public void createCalendarEvent(PluginCall call) {
        String accessTokenString = call.getString("accessToken");
        String summary = call.getString("summary");
        String description = call.getString("description");
        String startTimeIso = call.getString("startTimeIso");
        String endTimeIso = call.getString("endTimeIso");
        String timeZone = call.getString("timeZone", "Europe/Istanbul");

        if (accessTokenString == null || accessTokenString.isEmpty()) {
            call.reject("Access token is required.");
            return;
        }
        if (summary == null || startTimeIso == null || endTimeIso == null) {
            call.reject("Missing required parameters: summary, startTimeIso, or endTimeIso.");
            return;
        }

        executorService.execute(() -> {
            try {
                // Yeni Google Auth Library kullanarak Credentials oluştur
                AccessToken accessToken = new AccessToken(accessTokenString, null); // Expiration time bilinmiyorsa null
                GoogleCredentials credentials = GoogleCredentials.create(accessToken);
                HttpCredentialsAdapter adapter = new HttpCredentialsAdapter(credentials);

                Calendar service = new Calendar.Builder(
                        new NetHttpTransport(), // AndroidHttp.newCompatibleTransport() yerine
                        GsonFactory.getDefaultInstance(),
                        adapter) // GoogleCredential yerine adapter kullan
                        .setApplicationName(getContext().getPackageName())
                        .build();

                Event event = new Event()
                        .setSummary(summary)
                        .setDescription(description);

                com.google.api.client.util.DateTime startDateTime = new com.google.api.client.util.DateTime(startTimeIso);
                EventDateTime start = new EventDateTime()
                        .setDateTime(startDateTime)
                        .setTimeZone(timeZone);
                event.setStart(start);

                com.google.api.client.util.DateTime endDateTime = new com.google.api.client.util.DateTime(endTimeIso);
                EventDateTime end = new EventDateTime()
                        .setDateTime(endDateTime)
                        .setTimeZone(timeZone);
                event.setEnd(end);

                EventReminder[] reminderOverrides = new EventReminder[]{
                        new EventReminder().setMethod("popup").setMinutes(0)
                };
                Event.Reminders reminders = new Event.Reminders()
                        .setUseDefault(false)
                        .setOverrides(Arrays.asList(reminderOverrides));
                event.setReminders(reminders);

                String calendarId = "primary";
                Event createdEvent = service.events().insert(calendarId, event).execute();

                JSObject result = new JSObject();
                result.put("id", createdEvent.getId());
                result.put("htmlLink", createdEvent.getHtmlLink());
                result.put("summary", createdEvent.getSummary());
                call.resolve(result);

            } catch (IOException e) {
                Log.e(TAG, "IOException in createCalendarEvent: " + e.getMessage(), e);
                // Check if the error is due to invalid_grant (token expired/revoked)
                if (e.getMessage() != null && e.getMessage().toLowerCase().contains("invalid_grant")) {
                     call.reject("Access token is invalid or expired. Please sign in again.", "INVALID_GRANT", e);
                } else {
                     call.reject("Error creating calendar event: " + e.getMessage(), e);
                }
            } catch (Exception e) {
                Log.e(TAG, "Exception in createCalendarEvent: " + e.getMessage(), e);
                call.reject("Unexpected error creating calendar event: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void searchCalendarEvents(PluginCall call) {
        String accessTokenString = call.getString("accessToken");
        String appId = call.getString("appId");

        if (accessTokenString == null || accessTokenString.isEmpty()) {
            call.reject("Access token is required.");
            return;
        }
        if (appId == null || appId.isEmpty()) {
            call.reject("appId is required for searching events.");
            return;
        }

        executorService.execute(() -> {
            try {
                // Yeni Google Auth Library kullanarak Credentials oluştur
                AccessToken accessToken = new AccessToken(accessTokenString, null); // Expiration time bilinmiyorsa null
                GoogleCredentials credentials = GoogleCredentials.create(accessToken);
                HttpCredentialsAdapter adapter = new HttpCredentialsAdapter(credentials);

                Calendar service = new Calendar.Builder(
                        new NetHttpTransport(), // AndroidHttp.newCompatibleTransport() yerine
                        GsonFactory.getDefaultInstance(),
                        adapter) // GoogleCredential yerine adapter kullan
                        .setApplicationName(getContext().getPackageName())
                        .build();

                // AppID'den tarihi çıkar (YYYY-MM-DD kısmını bul)
                // Bu mantık JS tarafındaydı, burada da benzerini yapalım
                // Örnek AppID: "[AppID: ekstre_yapikredi_2024-07-15]"
                String targetDate = null;
                java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(\\d{4}-\\d{2}-\\d{2})").matcher(appId);
                if (matcher.find()) {
                    targetDate = matcher.group(1);
                }

                if (targetDate == null) {
                    Log.w(TAG, "Could not extract date from AppID for search: " + appId);
                    // Tarih yoksa, tüm takvimde AppID ile arama yapmayı deneyebiliriz,
                    // ama bu çok geniş olabilir. Şimdilik daraltılmış arama olmadan devam edelim.
                    // Veya belirli bir zaman aralığı zorunlu kılınabilir.
                    // JS'deki gibi timeMin ve timeMax belirlemek daha iyi.
                    // Şimdilik son 1 yılı arayalım eğer tarih yoksa, ya da hata verelim.
                    // JS tarafı spesifik bir gün aradığı için, burada da benzer bir mantık olmalı.
                    // Eğer tarih çıkarılamazsa, JS tarafı hata veriyordu, burada da benzerini yapalım.
                    call.reject("Could not extract date from AppID: " + appId);
                    return;
                }

                // timeMin ve timeMax için RFC3339 formatını kullan
                String startOfDayUtc = targetDate + "T00:00:00Z";

                java.util.Calendar calendar = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"));
                java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd");
                sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                java.util.Date dateObj = sdf.parse(targetDate);
                calendar.setTime(dateObj);
                calendar.add(java.util.Calendar.DATE, 1);
                String endOfDayUtc = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'").format(calendar.getTime());


                Events events = service.events().list("primary")
                        .setQ(appId) // AppID'yi doğrudan q parametresi olarak kullan
                        .setTimeMin(new com.google.api.client.util.DateTime(startOfDayUtc))
                        .setTimeMax(new com.google.api.client.util.DateTime(endOfDayUtc))
                        .setSingleEvents(true)
                        .setMaxResults(5) // En fazla 5 sonuç (genelde 1 tane bekliyoruz)
                        .execute();

                boolean eventFound = false;
                if (events.getItems() != null) {
                    for (Event event : events.getItems()) {
                        // Google q araması geniş olabileceğinden, açıklama içinde tam eşleşme arayalım.
                        if (event.getDescription() != null && event.getDescription().contains(appId)) {
                             Log.d(TAG, "Exact match found for AppID in event description: " + appId + ", Event ID: " + event.getId());
                            eventFound = true;
                            break;
                        }
                    }
                }
                 Log.d(TAG, "Search for AppID '" + appId + "' completed. Found: " + eventFound);
                JSObject result = new JSObject();
                result.put("eventFound", eventFound);
                call.resolve(result);

            } catch (IOException e) {
                Log.e(TAG, "IOException in searchCalendarEvents: " + e.getMessage(), e);
                 if (e.getMessage() != null && e.getMessage().toLowerCase().contains("invalid_grant")) {
                     call.reject("Access token is invalid or expired. Please sign in again.", "INVALID_GRANT", e);
                } else {
                    call.reject("Error searching calendar events: " + e.getMessage(), e);
                }
            } catch (Exception e) {
                Log.e(TAG, "Exception in searchCalendarEvents: " + e.getMessage(), e);
                call.reject("Unexpected error searching calendar events: " + e.getMessage(), e);
            }
        });
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

    // --- GMAIL API METODLARI ---

    @PluginMethod
    public void searchGmailMessages(PluginCall call) {
        String accessTokenString = call.getString("accessToken");
        String query = call.getString("query");
        // Opsiyonel: Sayfalama için nextPageToken ve maxResults eklenebilir
        // String pageToken = call.getString("pageToken");
        // Integer maxResults = call.getInteger("maxResults", 100); // Default 100?

        if (accessTokenString == null || accessTokenString.isEmpty()) {
            call.reject("Access token is required.");
            return;
        }
        if (query == null || query.isEmpty()) {
            call.reject("Search query is required.");
            return;
        }

        executorService.execute(() -> {
            try {
                Gmail service = buildGmailService(accessTokenString);

                ListMessagesResponse response = service.users().messages().list("me")
                        .setQ(query)
                        // .setPageToken(pageToken) 
                        // .setMaxResults(maxResults.longValue())
                        .execute();

                JSObject result = new JSObject();
                // Gmail API'den dönen mesaj listesini (sadece ID'ler) JSObject'e çevir
                // com.google.api.client.json.gson.GsonFactory kullanarak doğrudan JSON'a çevirme
                String jsonResponse = GsonFactory.getDefaultInstance().toString(response);
                result = new JSObject(jsonResponse); // JSObject'i JSON string'inden oluştur

                // Alternatif: Manuel olarak JSObject oluşturma
                /*
                JSArray messagesArray = new JSArray();
                if (response.getMessages() != null) {
                    for (Message message : response.getMessages()) {
                        JSObject msgObj = new JSObject();
                        msgObj.put("id", message.getId());
                        msgObj.put("threadId", message.getThreadId());
                        messagesArray.put(msgObj);
                    }
                }
                result.put("messages", messagesArray);
                if (response.getNextPageToken() != null) {
                    result.put("nextPageToken", response.getNextPageToken());
                }
                result.put("resultSizeEstimate", response.getResultSizeEstimate());
                 */
                call.resolve(result);

            } catch (IOException e) {
                handleIOException(call, e, "Error searching Gmail messages");
            } catch (Exception e) {
                handleGenericException(call, e, "Unexpected error searching Gmail messages");
            }
        });
    }

    @PluginMethod
    public void getGmailMessageDetails(PluginCall call) {
        String accessTokenString = call.getString("accessToken");
        String messageId = call.getString("messageId");

        if (accessTokenString == null || accessTokenString.isEmpty()) {
            call.reject("Access token is required.");
            return;
        }
        if (messageId == null || messageId.isEmpty()) {
            call.reject("Message ID is required.");
            return;
        }

        executorService.execute(() -> {
            try {
                Gmail service = buildGmailService(accessTokenString);

                // format=FULL ile tüm detayları al (payload, headers etc.)
                Message message = service.users().messages().get("me", messageId).setFormat("FULL").execute();

                JSObject result = new JSObject();
                // Dönen Message objesini JSObject'e çevir (Gson kullanarak)
                 String jsonResponse = GsonFactory.getDefaultInstance().toString(message);
                 result = new JSObject(jsonResponse);

                call.resolve(result);

            } catch (IOException e) {
                handleIOException(call, e, "Error getting Gmail message details");
            } catch (Exception e) {
                handleGenericException(call, e, "Unexpected error getting Gmail message details");
            }
        });
    }

    @PluginMethod
    public void getGmailAttachment(PluginCall call) {
        String accessTokenString = call.getString("accessToken");
        String messageId = call.getString("messageId");
        String attachmentId = call.getString("attachmentId");

        if (accessTokenString == null || accessTokenString.isEmpty()) {
            call.reject("Access token is required.");
            return;
        }
        if (messageId == null || messageId.isEmpty()) {
            call.reject("Message ID is required.");
            return;
        }
         if (attachmentId == null || attachmentId.isEmpty()) {
            call.reject("Attachment ID is required.");
            return;
        }

        executorService.execute(() -> {
            try {
                Gmail service = buildGmailService(accessTokenString);

                MessagePartBody attachmentBody = service.users().messages().attachments()
                                                    .get("me", messageId, attachmentId).execute();

                JSObject result = new JSObject();
                // Dönen MessagePartBody objesini JSObject'e çevir (Gson kullanarak)
                String jsonResponse = GsonFactory.getDefaultInstance().toString(attachmentBody);
                result = new JSObject(jsonResponse);
                
                // Alternatif: Sadece data alanını koymak
                // result.put("data", attachmentBody.getData()); // Base64 encoded data
                // result.put("size", attachmentBody.getSize()); 

                call.resolve(result);

            } catch (IOException e) {
                handleIOException(call, e, "Error getting Gmail attachment");
            } catch (Exception e) {
                handleGenericException(call, e, "Unexpected error getting Gmail attachment");
            }
        });
    }

    // Yardımcı metod: Gmail servisini oluşturur
    private Gmail buildGmailService(String accessTokenString) throws IOException {
        AccessToken accessToken = new AccessToken(accessTokenString, null);
        GoogleCredentials credentials = GoogleCredentials.create(accessToken);
        HttpCredentialsAdapter adapter = new HttpCredentialsAdapter(credentials);

        return new Gmail.Builder(
                new NetHttpTransport(),
                GsonFactory.getDefaultInstance(),
                adapter)
                .setApplicationName(getContext().getPackageName())
                .build();
    }
    
    // Yardımcı metod: IOException yönetimi
    private void handleIOException(PluginCall call, IOException e, String logPrefix) {
        Log.e(TAG, logPrefix + ": " + e.getMessage(), e);
        String errorCode = null;
        String errorMessage = logPrefix + ": " + e.getMessage();
        if (e instanceof com.google.api.client.http.HttpResponseException) {
            com.google.api.client.http.HttpResponseException httpError = (com.google.api.client.http.HttpResponseException) e;
            // GoogleJsonResponseException yerine HttpResponseException kullanıldığı için hata detayını manuel parse etmek gerekebilir
             // String content = httpError.getContent(); // Hata içeriği (JSON olabilir)
             // Örneğin: { "error": { "code": 401, "message": "Invalid Credentials", "errors": [...] } }
            if (httpError.getStatusCode() == 401 || httpError.getStatusCode() == 403) {
                 if (e.getMessage() != null && e.getMessage().toLowerCase().contains("invalid_grant")) {
                    errorCode = "INVALID_GRANT";
                    errorMessage = "Access token is invalid or expired. Please sign in again.";
                 } else {
                     errorCode = "AUTH_ERROR";
                     errorMessage = "Authentication error accessing Gmail: " + httpError.getStatusMessage();
                 }
            } else {
                 errorCode = "NETWORK_ERROR";
                 errorMessage = "Network error accessing Gmail: " + httpError.getStatusMessage();
            }
        } else {
            errorCode = "IO_ERROR";
        }
        call.reject(errorMessage, errorCode, e);
    }

    // Yardımcı metod: Genel Exception yönetimi
    private void handleGenericException(PluginCall call, Exception e, String logPrefix) {
         Log.e(TAG, logPrefix + ": " + e.getMessage(), e);
         call.reject(logPrefix + ": " + e.getMessage(), e);
    }

    // --- GMAIL API METODLARI SONU ---
} 