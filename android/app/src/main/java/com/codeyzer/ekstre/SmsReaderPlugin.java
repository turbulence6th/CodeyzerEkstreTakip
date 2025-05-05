package com.codeyzer.ekstre;

import android.Manifest;
import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(
    name = "SmsReader",
    permissions = {
        @Permission(alias = "readSms", strings = { Manifest.permission.READ_SMS })
    }
)
public class SmsReaderPlugin extends Plugin {

    private static final String TAG = "SmsReaderPlugin";

    // Global filtre listeleri kaldırıldı
    // private List<String> allowedSenders = new ArrayList<>();
    // private List<String> requiredKeywords = new ArrayList<>();

    // configureFilters metodu kaldırıldı
    // @PluginMethod
    // public void configureFilters(PluginCall call) { ... }

    @PluginMethod
    public void getMessages(PluginCall call) {
        if (getPermissionState("readSms") != PermissionState.GRANTED) {
             call.reject("READ_SMS permission is required to read messages.");
            return;
        }

        JSArray sendersArray = call.getArray("senders");
        JSArray keywordsArray = call.getArray("keywords");
        Integer maxCount = call.getInt("maxCount", 5);

        List<String> currentAllowedSenders = new ArrayList<>();
        List<String> currentRequiredKeywords = new ArrayList<>();
        List<String> finalSelectionArgs = new ArrayList<>(); // Tüm argümanları toplayacak liste

        // Sender listesini oluştur (Büyük harf)
        if (sendersArray != null) {
            try {
                for (int i = 0; i < sendersArray.length(); i++) {
                    String sender = sendersArray.getString(i);
                    if (sender != null && !sender.isEmpty()) {
                        currentAllowedSenders.add(sender);
                    }
                }
            } catch (JSONException e) {
                call.reject("Invalid senders array format in call."); return;
            }
        }
        // Keyword listesini oluştur (Küçük harf)
        if (keywordsArray != null) {
             try {
                for (int i = 0; i < keywordsArray.length(); i++) {
                    String keyword = keywordsArray.getString(i);
                    if (keyword != null && !keyword.isEmpty()) {
                        currentRequiredKeywords.add(keyword);
                    }
                }
            } catch (JSONException e) {
                call.reject("Invalid keywords array format in call."); return;
            }
        }

        StringBuilder selectionBuilder = new StringBuilder();

        // 1. Sender filtresini oluştur (Case-sensitive)
        if (!currentAllowedSenders.isEmpty()) {
            String placeholders = String.join(", ", Collections.nCopies(currentAllowedSenders.size(), "?"));
            selectionBuilder.append(Telephony.Sms.ADDRESS).append(" IN (").append(placeholders).append(")");
            finalSelectionArgs.addAll(currentAllowedSenders);
        }

        // 2. Keyword filtresini oluştur (Case-sensitive using GLOB)
        if (!currentRequiredKeywords.isEmpty()) {
            // Eğer sender filtresi de varsa, araya " AND " ekle
            if (selectionBuilder.length() > 0) {
                selectionBuilder.append(" AND ");
            }
            // Keyword koşullarını parantez içine al: (body GLOB ? OR ...)
            selectionBuilder.append("(");
            for (int i = 0; i < currentRequiredKeywords.size(); i++) {
                if (i > 0) {
                    selectionBuilder.append(" OR ");
                }
                selectionBuilder.append(Telephony.Sms.BODY).append(" GLOB ?");
                // GLOB için argümanları * ile sarmala
                finalSelectionArgs.add("*" + currentRequiredKeywords.get(i) + "*");
            }
            selectionBuilder.append(")");
        }

        String selection = selectionBuilder.length() > 0 ? selectionBuilder.toString() : null;
        String[] selectionArgs = finalSelectionArgs.isEmpty() ? null : finalSelectionArgs.toArray(new String[0]);

        JSObject result = new JSObject();
        JSArray messages = new JSArray();
        ContentResolver contentResolver = getContext().getContentResolver();
        Cursor cursor = null;
        int messagesAdded = 0;

        try {
            Uri inboxUri = Telephony.Sms.Inbox.CONTENT_URI;
            String[] projection = { Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE };
            String sortOrder = Telephony.Sms.DATE + " DESC LIMIT " + maxCount; // LIMIT'i direkt query'ye ekleyelim

            // Filtreleme yaparak sorgula
            cursor = contentResolver.query(inboxUri, projection, selection, selectionArgs, sortOrder);

            if (cursor != null) {
                // Cursor zaten filtrelenmiş ve limitlenmiş geldiği için sadece okuyup ekleyeceğiz
                while (cursor.moveToNext()) { // maxCount kontrolü artık sortOrder'da
                    String address = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS));
                    String body = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.BODY));
                    long date = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.DATE));

                    // Döngü içinde ekstra filtreleme yok
                    JSObject msg = new JSObject();
                    msg.put("address", address);
                    msg.put("body", body);
                    msg.put("date", date);
                    messages.put(msg);
                    messagesAdded++; // Gerçekte eklenen mesaj sayısını tutalım
                }
            } else {
                Log.w(TAG, "Cursor is null, query failed or returned no results.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error querying SMS messages", e);
            call.reject("Failed to query SMS messages.", e);
            return;
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }

        result.put("messages", messages);
        call.resolve(result);
    }
} 