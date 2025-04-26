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
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

@CapacitorPlugin(
    name = "SmsReader",
    permissions = {
        // SMS okuma iznini burada belirtelim
        @Permission(alias = "readSms", strings = { Manifest.permission.READ_SMS })
    }
)
public class SmsReaderPlugin extends Plugin {

    private static final String TAG = "SmsReaderPlugin";

    // Echo metodu kaldırıldı

    // checkPermissions ve requestPermissions metodları Capacitor tarafından sağlanır,
    // biz sadece @Permission annotation'ı ile izni belirtiyoruz.

    @PluginMethod
    public void getMessages(PluginCall call) {
        if (getPermissionState("readSms") != PermissionState.GRANTED) {
            call.reject("READ_SMS permission is required to read messages.");
            return;
        }

        // Opsiyonel filtreleri alalım
        Integer maxCount = call.getInt("maxCount", 50); 
        JSArray sendersArray = call.getArray("senders"); 
        String query = call.getString("query"); // İçerik sorgusunu al

        List<String> selectionParts = new ArrayList<>();
        List<String> selectionArgsList = new ArrayList<>();

        // 1. Gönderen filtresini oluştur (varsa)
        if (sendersArray != null) {
            List<String> sendersList = new ArrayList<>();
            try {
                 for (int i = 0; i < sendersArray.length(); i++) {
                     sendersList.add(sendersArray.getString(i));
        }
                 if (!sendersList.isEmpty()) {
                     String placeholders = String.join(",", Collections.nCopies(sendersList.size(), "?"));
                     selectionParts.add(Telephony.Sms.ADDRESS + " IN (" + placeholders + ")");
                     selectionArgsList.addAll(sendersList);
                     Log.d(TAG, "Adding sender filter: " + sendersList.toString());
                 } else {
                     Log.d(TAG, "Senders array provided but empty.");
                 }
            } catch (JSONException e) {
                 Log.e(TAG, "Error parsing senders array", e);
                 call.reject("Invalid senders array format.");
                 return;
            }
    }

        // 2. İçerik filtresini oluştur (varsa)
        if (query != null && !query.trim().isEmpty()) {
            selectionParts.add(Telephony.Sms.BODY + " LIKE ?");
            selectionArgsList.add("%" + query + "%"); // LIKE için %query%
            Log.d(TAG, "Adding body filter: %" + query + "%");
        }

        // 3. Selection string ve argümanlarını birleştir
        String selection = null;
        String[] selectionArgs = null;
        if (!selectionParts.isEmpty()) {
            selection = String.join(" AND ", selectionParts);
            selectionArgs = selectionArgsList.toArray(new String[0]);
        }

        Log.d(TAG, "Final selection: " + selection);
        Log.d(TAG, "Final selection args: " + selectionArgsList.toString());
        Log.d(TAG, "Fetching SMS messages with maxCount: " + maxCount);

        JSObject result = new JSObject();
        JSArray messages = new JSArray();
        ContentResolver contentResolver = getContext().getContentResolver();
        Cursor cursor = null;

        try {
            Uri inboxUri = Telephony.Sms.Inbox.CONTENT_URI;
            String[] projection = { Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE };
            String sortOrder = Telephony.Sms.DATE + " DESC";

            // Sorguyu oluşturulan selection ve selectionArgs ile yap
            cursor = contentResolver.query(inboxUri, projection, selection, selectionArgs, sortOrder);

            if (cursor != null) {
                int count = 0;
                while (cursor.moveToNext() && count < maxCount) {
                    JSObject msg = new JSObject();
                    String address = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS));
                    String body = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.BODY));
                    long date = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.DATE));

                    msg.put("address", address);
                    msg.put("body", body);
                    msg.put("date", date);
                    // msg.put("id", cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms._ID))); // Gerekirse ID
                    messages.put(msg);
                    count++;
                }
                 Log.d(TAG, "Fetched " + count + " messages.");
            } else {
                Log.w(TAG, "Cursor is null, could not query SMS inbox.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error reading SMS messages", e);
            call.reject("Failed to read SMS messages.", e);
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