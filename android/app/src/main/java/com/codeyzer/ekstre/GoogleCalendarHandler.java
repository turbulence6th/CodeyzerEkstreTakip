package com.codeyzer.ekstre;

// Android & Capacitor Imports
import android.content.Context;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

// Google Sign-In Imports
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;

// Google API Client Library Imports (Core, HTTP, JSON, Auth)
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.util.DateTime;

// Google Calendar API Imports
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;
import com.google.api.services.calendar.model.EventReminder;
import com.google.api.services.calendar.model.Events;

// Java Util Imports
import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.concurrent.ExecutorService;

/**
 * Handles Google Calendar API interactions.
 */
public class GoogleCalendarHandler {

    private static final String TAG = "GoogleCalendarHandler";
    private final Context context;
    private final ExecutorService executorService;

    // Scope Calendar işlemleri için gerekli
    private static final String CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";

    public GoogleCalendarHandler(Context context, ExecutorService executorService) {
        this.context = context;
        this.executorService = executorService;
    }

    public void createCalendarEvent(PluginCall call, GoogleSignInAccount account) {
        String summary = call.getString("summary");
        String description = call.getString("description");
        String startTimeIso = call.getString("startTimeIso");
        String endTimeIso = call.getString("endTimeIso");
        String timeZone = call.getString("timeZone", "Europe/Istanbul");

        if (account == null) {
            ErrorUtils.handleGenericException(call, new IllegalArgumentException("GoogleSignInAccount is null."), "Account is null for createCalendarEvent", TAG);
            return;
        }

        if (summary == null || startTimeIso == null || endTimeIso == null) {
            ErrorUtils.handleGenericException(call, new IllegalArgumentException("Missing required parameters: summary, startTimeIso, or endTimeIso."), "Missing params for createCalendarEvent", TAG);
            return;
        }

        executorService.execute(() -> {
            try {
                Calendar service = buildCalendarServiceWithAccount(account);

                Event event = new Event()
                        .setSummary(summary)
                        .setDescription(description);

                DateTime startDateTime = new DateTime(startTimeIso);
                EventDateTime start = new EventDateTime()
                        .setDateTime(startDateTime)
                        .setTimeZone(timeZone);
                event.setStart(start);

                DateTime endDateTime = new DateTime(endTimeIso);
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
                ErrorUtils.handleIOException(call, e, "Error creating calendar event", TAG);
            } catch (Exception e) {
                ErrorUtils.handleGenericException(call, e, "Unexpected error creating calendar event", TAG);
            }
        });
    }

    public void searchCalendarEvents(PluginCall call, GoogleSignInAccount account) {
        String appId = call.getString("appId");

        if (account == null) {
            ErrorUtils.handleGenericException(call, new IllegalArgumentException("GoogleSignInAccount is null."), "Account is null for searchCalendarEvents", TAG);
            return;
        }

        if (appId == null || appId.isEmpty()) {
            ErrorUtils.handleGenericException(call, new IllegalArgumentException("appId is required for searching events."), "appId missing for searchCalendarEvents", TAG);
            return;
        }

        executorService.execute(() -> {
            try {
                Calendar service = buildCalendarServiceWithAccount(account);

                String targetDate = null;
                java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(\\d{4}-\\d{2}-\\d{2})").matcher(appId);
                if (matcher.find()) {
                    targetDate = matcher.group(1);
                }

                if (targetDate == null) {
                    Log.w(TAG, "Could not extract date from AppID for calendar search: " + appId);
                    ErrorUtils.handleGenericException(call, new IllegalArgumentException("Could not extract date from AppID: " + appId), "Date extraction failed", TAG);
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
                        .setTimeMin(new DateTime(startOfDayUtc))
                        .setTimeMax(new DateTime(endOfDayUtc))
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
                ErrorUtils.handleIOException(call, e, "Error searching calendar events", TAG);
            } catch (Exception e) {
                ErrorUtils.handleGenericException(call, e, "Unexpected error searching calendar events", TAG);
            }
        });
    }

    private Calendar buildCalendarServiceWithAccount(GoogleSignInAccount account) throws IOException {
        if (account == null || account.getAccount() == null) {
             throw new IOException("Google account is null or account details missing, cannot build Calendar service.");
        }
        GoogleAccountCredential credential = GoogleAccountCredential.usingOAuth2(
                context, Collections.singletonList(CALENDAR_EVENTS_SCOPE));
        credential.setSelectedAccount(account.getAccount());

        return new Calendar.Builder(
                new NetHttpTransport(),
                GsonFactory.getDefaultInstance(),
                credential)
                .setApplicationName(context.getPackageName())
                .build();
    }
} 