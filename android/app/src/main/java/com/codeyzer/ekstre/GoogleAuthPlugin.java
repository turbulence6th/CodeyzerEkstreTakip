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
    private GoogleCalendarHandler googleCalendarHandler; // Handler for Calendar operations
    private GoogleGmailHandler googleGmailHandler; // Handler for Gmail operations

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
        this.googleCalendarHandler = new GoogleCalendarHandler(getContext(), this.executorService);
        this.googleGmailHandler = new GoogleGmailHandler(getContext(), this.executorService); // Initialize GmailHandler
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
            // Use ErrorUtils for Google Sign-In API exceptions
            ErrorUtils.handleGoogleSignInApiException(call, e, "Google Sign In failed", TAG);
        } catch (Exception e) {
            // Use ErrorUtils for generic exceptions
            ErrorUtils.handleGenericException(call, e, "Unexpected error during sign-in process", TAG);
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
                            // Use ErrorUtils for Google Sign-In API exceptions
                            ErrorUtils.handleGoogleSignInApiException(call, (ApiException) exception, "Silent sign in failed", TAG);
                        } else {
                            // Use ErrorUtils for other exceptions during silent sign-in
                            ErrorUtils.handleGenericException(call, exception, "Silent sign-in failed", TAG);
                        }
                    }
                } catch (Exception e) {
                    // Use ErrorUtils for unexpected errors during silent sign-in completion
                    ErrorUtils.handleGenericException(call, e, "Unexpected error during silent sign-in completion", TAG);
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
                    // Use ErrorUtils for Firebase Auth exceptions
                    ErrorUtils.handleFirebaseAuthException(call, authTask.getException(), "Firebase Sign In failed", TAG);
                }
            });
    }


    @PluginMethod
    public void createCalendarEvent(PluginCall call) {
        if (this.currentGoogleAccount == null) {
            // ErrorUtils.handleGenericException(call, new IllegalStateException("User not signed in or account not available."), "User not signed in for createCalendarEvent", TAG);
            call.reject("User not signed in or account not available for createCalendarEvent.", "SIGN_IN_REQUIRED");
            return;
        }
        // Delegate to GoogleCalendarHandler
        this.googleCalendarHandler.createCalendarEvent(call, this.currentGoogleAccount);
    }

    @PluginMethod
    public void searchCalendarEvents(PluginCall call) {
         if (this.currentGoogleAccount == null) {
            // ErrorUtils.handleGenericException(call, new IllegalStateException("User not signed in or account not available."), "User not signed in for searchCalendarEvents", TAG);
            call.reject("User not signed in or account not available for searchCalendarEvents.", "SIGN_IN_REQUIRED");
            return;
        }
        // Delegate to GoogleCalendarHandler
        this.googleCalendarHandler.searchCalendarEvents(call, this.currentGoogleAccount);
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
        if (this.currentGoogleAccount == null) {
            // ErrorUtils.handleGenericException(call, new IllegalStateException("User not signed in or account not available."), "User not signed in for searchGmailMessages", TAG);
            call.reject("User not signed in or account not available for searchGmailMessages.", "SIGN_IN_REQUIRED");
            return;
        }
        this.googleGmailHandler.searchGmailMessages(call, this.currentGoogleAccount);
    }

    @PluginMethod
    public void getGmailMessageDetails(PluginCall call) {
        if (this.currentGoogleAccount == null) {
            // ErrorUtils.handleGenericException(call, new IllegalStateException("User not signed in or account not available."), "User not signed in for getGmailMessageDetails", TAG);
            call.reject("User not signed in or account not available for getGmailMessageDetails.", "SIGN_IN_REQUIRED");
            return;
        }
        this.googleGmailHandler.getGmailMessageDetails(call, this.currentGoogleAccount);
    }

    @PluginMethod
    public void getGmailAttachment(PluginCall call) {
        if (this.currentGoogleAccount == null) {
            // ErrorUtils.handleGenericException(call, new IllegalStateException("User not signed in or account not available."), "User not signed in for getGmailAttachment", TAG);
            call.reject("User not signed in or account not available for getGmailAttachment.", "SIGN_IN_REQUIRED");
            return;
        }
        this.googleGmailHandler.getGmailAttachment(call, this.currentGoogleAccount);
    }
} 