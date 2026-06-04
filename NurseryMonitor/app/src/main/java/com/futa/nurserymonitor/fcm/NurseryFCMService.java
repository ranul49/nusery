package com.futa.nurserymonitor.fcm;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.futa.nurserymonitor.R;
import com.futa.nurserymonitor.ui.dashboard.DashboardActivity;
import com.futa.nurserymonitor.ui.settings.SettingsActivity;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * NurseryFCMService — handles Firebase Cloud Messaging push notifications.
 *
 * Message types (sent as data payload key "type"):
 *   BREACH         – high priority, heads-up, opens Dashboard + scrolls alert log
 *   APPROACH       – normal priority, opens Dashboard
 *   RESOLVED       – low priority, silent, opens Dashboard
 *   SMS_FAILURE    – normal priority, opens Settings → Device info
 *   SENSOR_ERROR   – normal priority, opens Dashboard → sensor card error state
 *
 * Notification channels (created on first launch):
 *   nursery_breach  – IMPORTANCE_HIGH  (heads-up alerts)
 *   nursery_normal  – IMPORTANCE_DEFAULT
 *   nursery_silent  – IMPORTANCE_LOW
 */
public class NurseryFCMService extends FirebaseMessagingService {

    private static final String TAG = "NurseryFCMService";

    // Channel IDs
    public static final String CHANNEL_BREACH = "nursery_breach";
    public static final String CHANNEL_NORMAL = "nursery_normal";
    public static final String CHANNEL_SILENT = "nursery_silent";

    // Deep-link extras read by DashboardActivity.onNewIntent
    public static final String EXTRA_SCROLL_ALERT_LOG = "scroll_alert_log";
    public static final String EXTRA_HIGHLIGHT_SENSOR  = "highlight_sensor";
    public static final String EXTRA_OPEN_DEVICE_INFO  = "open_device_info";

    // ──────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // New FCM token (re-register silently in the background)
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public void onNewToken(String token) {
        Log.i(TAG, "FCM token refreshed — re-registering silently");
        // In a production system send the new token to your own backend here.
        // The registration happens transparently; no user action required.
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Incoming message handler
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String type    = data.getOrDefault("type", "");
        String title   = data.getOrDefault("title", getString(R.string.app_name));
        String body    = data.getOrDefault("body",  "Nursery alert received.");

        Log.d(TAG, "FCM received — type: " + type + " | body: " + body);

        switch (type.toUpperCase()) {
            case "BREACH":
                showBreachNotification(title, body);
                break;
            case "APPROACH":
                showNormalNotification(title, body, buildDashboardIntent(false, false));
                break;
            case "RESOLVED":
                showSilentNotification(title, body);
                break;
            case "SMS_FAILURE":
                showNormalNotification(title, body, buildSettingsIntent());
                break;
            case "SENSOR_ERROR":
                showNormalNotification(title, body, buildDashboardIntent(false, true));
                break;
            default:
                showNormalNotification(title, body, buildDashboardIntent(false, false));
                break;
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Notification builders
    // ──────────────────────────────────────────────────────────────────────────

    /** BREACH — heads-up notification, vibrate + full-screen intent */
    private void showBreachNotification(String title, String body) {
        Intent tapIntent = buildDashboardIntent(true, false);
        PendingIntent pi = PendingIntent.getActivity(this, 0, tapIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_BREACH)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setColor(getColor(R.color.status_breach))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setFullScreenIntent(pi, true)        // heads-up on API 26+
                .setVibrate(new long[]{0, 500, 200, 500});

        notify(1001, builder);
    }

    /** APPROACH / SMS_FAILURE / SENSOR_ERROR — standard priority */
    private void showNormalNotification(String title, String body, Intent tapIntent) {
        PendingIntent pi = PendingIntent.getActivity(this, 0, tapIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_NORMAL)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setColor(getColor(R.color.brand_accent))
                .setAutoCancel(true)
                .setContentIntent(pi);

        notify(1002, builder);
    }

    /** RESOLVED — silent, no sound or vibration */
    private void showSilentNotification(String title, String body) {
        PendingIntent pi = PendingIntent.getActivity(this, 0,
                buildDashboardIntent(false, false),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_SILENT)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setAutoCancel(true)
                .setContentIntent(pi);

        notify(1003, builder);
    }

    private void notify(int id, NotificationCompat.Builder builder) {
        NotificationManager nm = (NotificationManager)
                getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(id, builder.build());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Intent builders
    // ──────────────────────────────────────────────────────────────────────────

    private Intent buildDashboardIntent(boolean scrollAlertLog, boolean highlightSensor) {
        Intent intent = new Intent(this, DashboardActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra(EXTRA_SCROLL_ALERT_LOG, scrollAlertLog);
        intent.putExtra(EXTRA_HIGHLIGHT_SENSOR, highlightSensor);
        return intent;
    }

    private Intent buildSettingsIntent() {
        Intent intent = new Intent(this, SettingsActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra(EXTRA_OPEN_DEVICE_INFO, true);
        return intent;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Channel creation (idempotent — safe to call multiple times)
    // ──────────────────────────────────────────────────────────────────────────

    public static void createNotificationChannels(Context ctx) {
        NotificationManager nm = (NotificationManager)
                ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // BREACH — importance HIGH, vibration, no bypass DND
        NotificationChannel breach = new NotificationChannel(
                CHANNEL_BREACH, "Breach Alerts", NotificationManager.IMPORTANCE_HIGH);
        breach.setDescription("High-priority tunnel breach alerts");
        breach.enableVibration(true);
        breach.setVibrationPattern(new long[]{0, 500, 200, 500});
        breach.setLightColor(0xFFEF4444);
        breach.enableLights(true);

        // NORMAL — default
        NotificationChannel normal = new NotificationChannel(
                CHANNEL_NORMAL, "Approach Warnings", NotificationManager.IMPORTANCE_DEFAULT);
        normal.setDescription("Approach warnings and system notifications");

        // SILENT — low
        NotificationChannel silent = new NotificationChannel(
                CHANNEL_SILENT, "Resolved / Info", NotificationManager.IMPORTANCE_LOW);
        silent.setDescription("Silent resolved and informational messages");

        nm.createNotificationChannel(breach);
        nm.createNotificationChannel(normal);
        nm.createNotificationChannel(silent);
    }

    private void createNotificationChannels() {
        createNotificationChannels(this);
    }
}
