package com.codeyzer.ekstre;

import android.util.Log;
import com.getcapacitor.PluginCall;
import java.io.IOException;

public class ErrorUtils {

    public static void handleIOException(PluginCall call, IOException e, String logPrefix, String tag) {
        Log.e(tag, logPrefix + ": " + e.getMessage(), e);
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
        } else if (e.getMessage() != null && e.getMessage().toLowerCase().contains("sign_in_required")) {
            // Bu durum, GoogleAccountCredential'ın token alamadığı bazı durumlar için özel olabilir.
            errorCode = "SIGN_IN_REQUIRED";
            errorMessage = logPrefix + ": Sign in is required. " + e.getMessage();
        }


        if (call != null) {
            call.reject(errorMessage, errorCode, e);
        } else {
            Log.e(tag, logPrefix + ": PluginCall is null, cannot reject. Error: " + errorMessage);
        }
    }

    public static void handleGenericException(PluginCall call, Exception e, String logPrefix, String tag) {
         Log.e(tag, logPrefix + ": " + e.getMessage(), e);
         if (call != null) {
            call.reject(logPrefix + ": " + e.getMessage(), e);
         } else {
            Log.e(tag, logPrefix + ": PluginCall is null, cannot reject. Error: " + e.getMessage());
         }
    }

    public static void handleGoogleSignInApiException(PluginCall call, com.google.android.gms.common.api.ApiException e, String logPrefix, String tag) {
        Log.w(tag, logPrefix + ": Google Sign In API Exception code=" + e.getStatusCode(), e);
        String errorMessage;
        String errorCode = "SIGN_IN_API_ERROR"; // Default error code

        switch (e.getStatusCode()) {
            case com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes.SIGN_IN_CANCELLED: // 12501
                errorMessage = logPrefix + ": Sign-in cancelled by user.";
                errorCode = "SIGN_IN_CANCELLED";
                break;
            case com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes.NETWORK_ERROR: // 7
                errorMessage = logPrefix + ": Network error during sign-in.";
                errorCode = "NETWORK_ERROR";
                break;
            case com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes.SIGN_IN_REQUIRED: // 4
                errorMessage = logPrefix + ": Sign-in is required.";
                errorCode = "SIGN_IN_REQUIRED";
                break;
            default:
                errorMessage = logPrefix + ": Google Sign-in failed with code " + e.getStatusCode();
                // errorCode remains SIGN_IN_API_ERROR or could be made more specific
                break;
        }
        if (call != null) {
            call.reject(errorMessage, errorCode, e);
        } else {
            Log.e(tag, logPrefix + ": PluginCall is null. Cannot reject. Error: " + errorMessage);
        }
    }

    public static void handleFirebaseAuthException(PluginCall call, Exception e, String logPrefix, String tag) {
        String exceptionMessage = (e != null && e.getMessage() != null) ? e.getMessage() : "Unknown Firebase error";
        Log.w(tag, logPrefix + ": Firebase Authentication Failed. " + exceptionMessage, e);
        String errorMessage = logPrefix + ": " + exceptionMessage;
        String errorCode = "FIREBASE_AUTH_ERROR";

        if (call != null) {
            call.reject(errorMessage, errorCode, e);
        } else {
            Log.e(tag, logPrefix + ": PluginCall is null. Cannot reject. Error: " + errorMessage);
        }
    }
} 