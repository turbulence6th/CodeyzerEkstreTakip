// GoogleAuthPlugin.java
package com.codeyzer.ekstre;

import android.content.Intent;
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

import java.io.IOException;

import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;

import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;
import com.google.api.services.calendar.model.EventReminder;
import com.google.api.services.calendar.model.Events;

import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.ListMessagesResponse;
import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.MessagePartBody;

import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential;

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
    private GoogleSignInAccount currentGoogleAccount; // Stored Google account

    private static final String GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
    private static final String CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";
    private static final String WEB_CLIENT_ID = "1008857567754-2s7hevrbudal3m8qju85g31souc8v4g5.apps.googleusercontent.com";

    private final ExecutorService executorService = Executors.newSingleThreadExecutor();

    @Override
    public void load() {
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(WEB_CLIENT_ID)
                .requestEmail()
                .requestScopes(new Scope(GMAIL_READONLY_SCOPE), new Scope(CALENDAR_EVENTS_SCOPE))
                .build();
        googleSignInClient = GoogleSignIn.getClient(getContext(), gso);
        firebaseAuth = FirebaseAuth.getInstance();
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
            Log.e(TAG, "PluginCall missing in handleSignInResult");
            return;
        }

        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(result.getData());
        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            Log.d(TAG, "Google Sign In successful.");
            this.currentGoogleAccount = account;
            signInToFirebaseAndResolve(call, account);

        } catch (ApiException e) {
            Log.w(TAG, "Google Sign In failed code=" + e.getStatusCode());
            if (e.getStatusCode() == 12501) { // SIGN_IN_CANCELLED
                call.reject("Sign-in cancelled by user.");
            } else if (e.getStatusCode() == 7) { // NETWORK_ERROR
                call.reject("Network error during sign-in.");
            } else {
                 call.reject("Google Sign-in failed: " + e.getStatusCode());
            }
        } catch (Exception e) {
            Log.e(TAG, "Unexpected error during sign-in process", e);
            call.reject("Unexpected error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void trySilentSignIn(PluginCall call) {
        Log.d(TAG, "Attempting silent sign in...");

        Task<GoogleSignInAccount> task = googleSignInClient.silentSignIn();

        if (task.isSuccessful()) {
            Log.d(TAG, "Silent sign in successful (cached).");
            GoogleSignInAccount account = task.getResult();
            this.currentGoogleAccount = account;
            signInToFirebaseAndResolve(call, account);
        } else {
            task.addOnCompleteListener(getActivity(), completedTask -> {
                try {
                    if (completedTask.isSuccessful()) {
                        Log.d(TAG, "Silent sign in successful (network).");
                        GoogleSignInAccount account = completedTask.getResult();
                        this.currentGoogleAccount = account;
                        signInToFirebaseAndResolve(call, account);
                    } else {
                        Log.w(TAG, "Silent sign in failed.", completedTask.getException());
                        Exception exception = completedTask.getException();
                        if (exception instanceof ApiException) {
                            ApiException apiException = (ApiException) exception;
                            if (apiException.getStatusCode() == com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes.SIGN_IN_REQUIRED) {
                                call.reject("Silent sign-in failed. User needs to sign in manually.", "SIGN_IN_REQUIRED");
                            } else {
                                call.reject("Silent sign-in failed with API error: " + apiException.getStatusCode());
                            }
                        } else {
                            call.reject("Silent sign-in failed: " + (exception != null ? exception.getMessage() : "Unknown error"));
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Unexpected error during silent sign-in completion", e);
                    call.reject("Unexpected error during silent sign-in: " + e.getMessage());
                }
            });
        }
    }

    private void signInToFirebaseAndResolve(PluginCall call, GoogleSignInAccount googleAccount) {
        if (googleAccount.getIdToken() == null) {
            call.reject("Google ID Token is null, cannot proceed with Firebase sign in.");
            return;
        }
        AuthCredential credential = GoogleAuthProvider.getCredential(googleAccount.getIdToken(), null);
        firebaseAuth.signInWithCredential(credential)
            .addOnCompleteListener(getActivity(), authTask -> {
                if (authTask.isSuccessful()) {
                    // FirebaseUser user = firebaseAuth.getCurrentUser(); // Can be used if needed
                    Log.d(TAG, "Firebase Sign In successful.");
                    JSObject userResult = new JSObject();
                    userResult.put("id", googleAccount.getId());
                    userResult.put("name", googleAccount.getDisplayName());
                    userResult.put("email", googleAccount.getEmail());
                    userResult.put("imageUrl", googleAccount.getPhotoUrl() != null ? googleAccount.getPhotoUrl().toString() : null);
                    userResult.put("idToken", googleAccount.getIdToken());
                    call.resolve(userResult);
                } else {
                    Log.w(TAG, "Firebase Sign In failed", authTask.getException());
                    call.reject("Firebase Sign In failed: " + (authTask.getException() != null ? authTask.getException().getMessage() : "Unknown error"));
                }
            });
    }


    @PluginMethod
    public void createCalendarEvent(PluginCall call) {
        String summary = call.getString("summary");
        String description = call.getString("description");
        String startTimeIso = call.getString("startTimeIso");
        String endTimeIso = call.getString("endTimeIso");
        String timeZone = call.getString("timeZone", "Europe/Istanbul");

        if (this.currentGoogleAccount == null || this.currentGoogleAccount.getAccount() == null) {
            call.reject("User not signed in or account not available.", "SIGN_IN_REQUIRED");
            return;
        }
        if (summary == null || startTimeIso == null || endTimeIso == null) {
            call.reject("Missing required parameters: summary, startTimeIso, or endTimeIso.");
            return;
        }

        executorService.execute(() -> {
            try {
                Calendar service = buildCalendarServiceWithAccount();

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
                handleIOException(call, e, "Error creating calendar event");
            } catch (Exception e) {
                handleGenericException(call, e, "Unexpected error creating calendar event");
            }
        });
    }

    @PluginMethod
    public void searchCalendarEvents(PluginCall call) {
        String appId = call.getString("appId");

        if (this.currentGoogleAccount == null || this.currentGoogleAccount.getAccount() == null) {
            call.reject("User not signed in or account not available.", "SIGN_IN_REQUIRED");
            return;
        }
        if (appId == null || appId.isEmpty()) {
            call.reject("appId is required for searching events.");
            return;
        }

        executorService.execute(() -> {
            try {
                Calendar service = buildCalendarServiceWithAccount();

                String targetDate = null;
                java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(\\d{4}-\\d{2}-\\d{2})").matcher(appId);
                if (matcher.find()) {
                    targetDate = matcher.group(1);
                }

                if (targetDate == null) {
                    Log.w(TAG, "Could not extract date from AppID for calendar search: " + appId);
                    call.reject("Could not extract date from AppID: " + appId);
                    return;
                }

                String startOfDayUtc = targetDate + "T00:00:00Z";
                java.util.Calendar calendar = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"));
                java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd");
                sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                java.util.Date dateObj = sdf.parse(targetDate);
                calendar.setTime(dateObj);
                calendar.add(java.util.Calendar.DATE, 1);
                String endOfDayUtc = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'").format(calendar.getTime());


                Events events = service.events().list("primary")
                        .setQ(appId)
                        .setTimeMin(new com.google.api.client.util.DateTime(startOfDayUtc))
                        .setTimeMax(new com.google.api.client.util.DateTime(endOfDayUtc))
                        .setSingleEvents(true)
                        .setMaxResults(5)
                        .execute();

                boolean eventFound = false;
                if (events.getItems() != null) {
                    for (Event event : events.getItems()) {
                        if (event.getDescription() != null && event.getDescription().contains(appId)) {
                            eventFound = true;
                            break;
                        }
                    }
                }
                JSObject result = new JSObject();
                result.put("eventFound", eventFound);
                call.resolve(result);

            } catch (IOException e) {
                handleIOException(call, e, "Error searching calendar events");
            } catch (Exception e) {
                handleGenericException(call, e, "Unexpected error searching calendar events");
            }
        });
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        firebaseAuth.signOut();
        googleSignInClient.signOut().addOnCompleteListener(task -> {
            this.currentGoogleAccount = null;
            if (task.isSuccessful()) {
                Log.d(TAG, "Google Sign Out successful");
                call.resolve();
            } else {
                Log.w(TAG, "Google Sign Out failed but proceeding anyway.", task.getException());
                call.resolve();
            }
        });
    }

    // --- GMAIL API METHODS ---

    @PluginMethod
    public void searchGmailMessages(PluginCall call) {
        String query = call.getString("query");

        if (this.currentGoogleAccount == null || this.currentGoogleAccount.getAccount() == null) {
            call.reject("User not signed in or account not available.", "SIGN_IN_REQUIRED");
            return;
        }
        if (query == null || query.isEmpty()) {
            call.reject("Search query is required.");
            return;
        }

        executorService.execute(() -> {
            try {
                Gmail service = buildGmailServiceWithAccount();

                ListMessagesResponse response = service.users().messages().list("me")
                        .setQ(query)
                        .execute();

                String jsonResponse = GsonFactory.getDefaultInstance().toString(response);
                JSObject result = new JSObject(jsonResponse);
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
        String messageId = call.getString("messageId");

        if (this.currentGoogleAccount == null || this.currentGoogleAccount.getAccount() == null) {
            call.reject("User not signed in or account not available.", "SIGN_IN_REQUIRED");
            return;
        }
        if (messageId == null || messageId.isEmpty()) {
            call.reject("Message ID is required.");
            return;
        }

        executorService.execute(() -> {
            try {
                Gmail service = buildGmailServiceWithAccount();

                Message message = service.users().messages().get("me", messageId).setFormat("FULL").execute();

                String jsonResponse = GsonFactory.getDefaultInstance().toString(message);
                JSObject result = new JSObject(jsonResponse);
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
        String messageId = call.getString("messageId");
        String attachmentId = call.getString("attachmentId");

        if (this.currentGoogleAccount == null || this.currentGoogleAccount.getAccount() == null) {
            call.reject("User not signed in or account not available.", "SIGN_IN_REQUIRED");
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
                Gmail service = buildGmailServiceWithAccount();

                MessagePartBody attachmentBody = service.users().messages().attachments()
                                                    .get("me", messageId, attachmentId).execute();

                String jsonResponse = GsonFactory.getDefaultInstance().toString(attachmentBody);
                JSObject result = new JSObject(jsonResponse);
                call.resolve(result);

            } catch (IOException e) {
                handleIOException(call, e, "Error getting Gmail attachment");
            } catch (Exception e) {
                handleGenericException(call, e, "Unexpected error getting Gmail attachment");
            }
        });
    }

    // --- Helper Methods ---

    private Gmail buildGmailServiceWithAccount() throws IOException {
        if (this.currentGoogleAccount == null || this.currentGoogleAccount.getAccount() == null) {
            throw new IOException("User not signed in or account not available for Gmail service.");
        }
        GoogleAccountCredential credential = GoogleAccountCredential.usingOAuth2(
                getContext(), Collections.singletonList(GMAIL_READONLY_SCOPE));
        credential.setSelectedAccount(this.currentGoogleAccount.getAccount());

        return new Gmail.Builder(
                new NetHttpTransport(),
                GsonFactory.getDefaultInstance(),
                credential)
                .setApplicationName(getContext().getPackageName())
                .build();
    }

    private Calendar buildCalendarServiceWithAccount() throws IOException {
        if (this.currentGoogleAccount == null || this.currentGoogleAccount.getAccount() == null) {
            throw new IOException("User not signed in or account not available for Calendar service.");
        }
        GoogleAccountCredential credential = GoogleAccountCredential.usingOAuth2(
                getContext(), Collections.singletonList(CALENDAR_EVENTS_SCOPE));
        credential.setSelectedAccount(this.currentGoogleAccount.getAccount());

        return new Calendar.Builder(
                new NetHttpTransport(),
                GsonFactory.getDefaultInstance(),
                credential)
                .setApplicationName(getContext().getPackageName())
                .build();
    }
    
    private void handleIOException(PluginCall call, IOException e, String logPrefix) {
        Log.e(TAG, logPrefix + ": " + e.getMessage(), e);
        String errorCode = "IO_ERROR";
        String errorMessage = logPrefix + ": " + e.getMessage();

        if (e instanceof com.google.api.client.http.HttpResponseException) {
            com.google.api.client.http.HttpResponseException httpError = (com.google.api.client.http.HttpResponseException) e;
            int statusCode = httpError.getStatusCode();

            if (statusCode == 401 || statusCode == 403) {
                 if (e.getMessage() != null && e.getMessage().toLowerCase().contains("invalid_grant")) {
                    errorCode = "INVALID_GRANT";
                    errorMessage = "Access token is invalid or expired. Please sign in again.";
                 } else {
                     errorCode = "AUTH_ERROR";
                     errorMessage = "Authentication error accessing API (Code: " + statusCode + ")";
                 }
            } else {
                 errorCode = "NETWORK_ERROR";
                 errorMessage = "API request failed (Code: " + statusCode + "): " + httpError.getStatusMessage();
            }
        }

        call.reject(errorMessage, errorCode, e);
    }

    private void handleGenericException(PluginCall call, Exception e, String logPrefix) {
         Log.e(TAG, logPrefix + ": " + e.getMessage(), e);
         call.reject(logPrefix + ": " + e.getMessage(), e);
    }
} 