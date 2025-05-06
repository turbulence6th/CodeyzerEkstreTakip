package com.codeyzer.ekstre;

import android.content.Context;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.ListMessagesResponse;
import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.MessagePartBody;

import java.io.IOException;
import java.util.Collections;
import java.util.concurrent.ExecutorService;

public class GoogleGmailHandler {

    private static final String TAG = "GoogleGmailHandler";
    private final Context context;
    private final ExecutorService executorService;
    private static final String GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

    public GoogleGmailHandler(Context context, ExecutorService executorService) {
        this.context = context;
        this.executorService = executorService;
    }

    public void searchGmailMessages(PluginCall call, GoogleSignInAccount account) {
        String query = call.getString("query");

        if (account == null || account.getAccount() == null) {
            ErrorUtils.handleGenericException(call, new IllegalStateException("User not signed in or account not available."), "User not signed in for searchGmailMessages", TAG);
            return;
        }
        if (query == null || query.isEmpty()) {
            ErrorUtils.handleGenericException(call, new IllegalArgumentException("Search query is required."), "Query missing for searchGmailMessages", TAG);
            return;
        }

        executorService.execute(() -> {
            try {
                Gmail service = buildGmailServiceWithAccount(account);
                ListMessagesResponse response = service.users().messages().list("me")
                        .setQ(query)
                        .execute();
                // TODO: Consider limiting the number of results or handling pagination if necessary.

                String jsonResponse = GsonFactory.getDefaultInstance().toString(response);
                JSObject result = new JSObject(jsonResponse);
                call.resolve(result);

            } catch (IOException e) {
                ErrorUtils.handleIOException(call, e, "Error searching Gmail messages", TAG);
            } catch (Exception e) {
                ErrorUtils.handleGenericException(call, e, "Unexpected error searching Gmail messages", TAG);
            }
        });
    }

    public void getGmailMessageDetails(PluginCall call, GoogleSignInAccount account) {
        String messageId = call.getString("messageId");

        if (account == null || account.getAccount() == null) {
            ErrorUtils.handleGenericException(call, new IllegalStateException("User not signed in or account not available."), "User not signed in for getGmailMessageDetails", TAG);
            return;
        }
        if (messageId == null || messageId.isEmpty()) {
            ErrorUtils.handleGenericException(call, new IllegalArgumentException("Message ID is required."), "Message ID missing for getGmailMessageDetails", TAG);
            return;
        }

        executorService.execute(() -> {
            try {
                Gmail service = buildGmailServiceWithAccount(account);
                Message message = service.users().messages().get("me", messageId).setFormat("FULL").execute();

                String jsonResponse = GsonFactory.getDefaultInstance().toString(message);
                JSObject result = new JSObject(jsonResponse);
                call.resolve(result);

            } catch (IOException e) {
                ErrorUtils.handleIOException(call, e, "Error getting Gmail message details", TAG);
            } catch (Exception e) {
                ErrorUtils.handleGenericException(call, e, "Unexpected error getting Gmail message details", TAG);
            }
        });
    }

    public void getGmailAttachment(PluginCall call, GoogleSignInAccount account) {
        String messageId = call.getString("messageId");
        String attachmentId = call.getString("attachmentId");

        if (account == null || account.getAccount() == null) {
            ErrorUtils.handleGenericException(call, new IllegalStateException("User not signed in or account not available."), "User not signed in for getGmailAttachment", TAG);
            return;
        }
        if (messageId == null || messageId.isEmpty()) {
            ErrorUtils.handleGenericException(call, new IllegalArgumentException("Message ID is required."), "Message ID missing for getGmailAttachment", TAG);
            return;
        }
        if (attachmentId == null || attachmentId.isEmpty()) {
            ErrorUtils.handleGenericException(call, new IllegalArgumentException("Attachment ID is required."), "Attachment ID missing for getGmailAttachment", TAG);
            return;
        }

        executorService.execute(() -> {
            try {
                Gmail service = buildGmailServiceWithAccount(account);
                MessagePartBody attachmentBody = service.users().messages().attachments()
                        .get("me", messageId, attachmentId).execute();

                String jsonResponse = GsonFactory.getDefaultInstance().toString(attachmentBody);
                JSObject result = new JSObject(jsonResponse);
                call.resolve(result);

            } catch (IOException e) {
                ErrorUtils.handleIOException(call, e, "Error getting Gmail attachment", TAG);
            } catch (Exception e) {
                ErrorUtils.handleGenericException(call, e, "Unexpected error getting Gmail attachment", TAG);
            }
        });
    }

    private Gmail buildGmailServiceWithAccount(GoogleSignInAccount account) throws IOException {
        if (account == null || account.getAccount() == null) {
            throw new IOException("GoogleSignInAccount is null or account details missing, cannot build Gmail service.");
        }
        GoogleAccountCredential credential = GoogleAccountCredential.usingOAuth2(
                context, Collections.singletonList(GMAIL_READONLY_SCOPE));
        credential.setSelectedAccount(account.getAccount());

        return new Gmail.Builder(
                new NetHttpTransport(),
                GsonFactory.getDefaultInstance(),
                credential)
                .setApplicationName(context.getPackageName()) // Consider using a more specific app name if available
                .build();
    }
} 