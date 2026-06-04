package com.futa.nurserymonitor.api;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.futa.nurserymonitor.models.EventLogEntry;
import com.futa.nurserymonitor.models.SensorSnapshot;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import org.json.JSONObject;

import java.io.IOException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.logging.HttpLoggingInterceptor;

/**
 * ThingerAPI — centralised HTTP client for all Thinger.io REST calls.
 *
 * Uses OkHttp3 4.x with:
 *   • 10 s connect / 15 s read timeouts
 *   • 3 automatic retries with 10 s back-off (implemented via interceptor)
 *   • Bearer token from SharedPreferences (set during auth)
 *
 * All methods are async (OkHttp enqueue) and invoke the supplied
 * ApiCallback on the OkHttp dispatch thread.  Callers must marshal
 * back to the main thread themselves (e.g. runOnUiThread).
 */
public class ThingerAPI {

    private static final String TAG = "ThingerAPI";

    // Base URL for Thinger.io community server
    public static final String BASE_URL = "https://backend.thinger.io";

    // SharedPreferences keys (same keys used in SplashActivity)
    public static final String PREF_FILE   = "nursery_prefs";
    public static final String PREF_USER   = "thinger_user";
    public static final String PREF_DEVICE = "thinger_device";
    public static final String PREF_TOKEN  = "thinger_token";

    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");

    private static ThingerAPI instance;

    private final OkHttpClient client;
    private final Gson gson;
    private final SharedPreferences prefs;

    // ──────────────────────────────────────────────────────────────────────────
    // Singleton
    // ──────────────────────────────────────────────────────────────────────────

    public static synchronized ThingerAPI getInstance(Context ctx) {
        if (instance == null) {
            instance = new ThingerAPI(ctx.getApplicationContext());
        }
        return instance;
    }

    private ThingerAPI(Context ctx) {
        prefs = ctx.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE);

        // Logging interceptor (debug builds only — remove for release)
        HttpLoggingInterceptor logging = new HttpLoggingInterceptor(
                message -> Log.d(TAG, message));
        logging.setLevel(HttpLoggingInterceptor.Level.BODY);

        client = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .writeTimeout(10, TimeUnit.SECONDS)
                .addInterceptor(logging)
                // Retry interceptor: 3 attempts, 10 s back-off
                .addInterceptor(chain -> {
                    int maxTries = 3;
                    IOException lastException = null;
                    for (int attempt = 1; attempt <= maxTries; attempt++) {
                        try {
                            Response response = chain.proceed(chain.request());
                            if (response.isSuccessful() || attempt == maxTries) {
                                return response;
                            }
                            response.close();
                        } catch (IOException e) {
                            lastException = e;
                            if (attempt == maxTries) throw e;
                        }
                        try { Thread.sleep(10_000L); } catch (InterruptedException ignored) {}
                    }
                    throw (lastException != null ? lastException
                            : new IOException("Request failed after " + maxTries + " attempts"));
                })
                .build();

        gson = new GsonBuilder()
                .setDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'")
                .create();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Credentials helpers
    // ──────────────────────────────────────────────────────────────────────────

    private String user()   { return prefs.getString(PREF_USER,   ""); }
    private String device() { return prefs.getString(PREF_DEVICE, ""); }
    private String token()  { return prefs.getString(PREF_TOKEN,  ""); }

    private Request.Builder authedGet(String url) {
        return new Request.Builder()
                .url(url)
                .addHeader("Authorization", "Bearer " + token())
                .get();
    }

    private Request.Builder authedPatch(String url, String jsonBody) {
        return new Request.Builder()
                .url(url)
                .addHeader("Authorization", "Bearer " + token())
                .patch(RequestBody.create(jsonBody, JSON));
    }

    private Request.Builder authedPost(String url, String jsonBody) {
        return new Request.Builder()
                .url(url)
                .addHeader("Authorization", "Bearer " + token())
                .post(RequestBody.create(jsonBody, JSON));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Callback interface
    // ──────────────────────────────────────────────────────────────────────────

    public interface ApiCallback<T> {
        void onSuccess(T result);
        void onFailure(String errorMessage);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Dashboard poll — GET current sensor snapshot
    //    GET /v1/users/{user}/devices/{device}/
    // ──────────────────────────────────────────────────────────────────────────

    public void getSensorSnapshot(ApiCallback<SensorSnapshot> callback) {
        String url = BASE_URL + "/v1/users/" + user() + "/devices/" + device() + "/";
        Request request = authedGet(url).build();

        client.newCall(request).enqueue(new Callback() {
            @Override public void onFailure(Call call, IOException e) {
                callback.onFailure(e.getMessage());
            }

            @Override public void onResponse(Call call, Response response) throws IOException {
                try (response) {
                    if (!response.isSuccessful()) {
                        callback.onFailure("HTTP " + response.code());
                        return;
                    }
                    String body = response.body() != null ? response.body().string() : "{}";
                    SensorSnapshot snap = gson.fromJson(body, SensorSnapshot.class);
                    callback.onSuccess(snap);
                }
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Manual pump override
    //    PATCH /v1/users/{user}/devices/{device}/pump_override
    // ──────────────────────────────────────────────────────────────────────────

    public void setPumpOverride(boolean on, ApiCallback<Boolean> callback) {
        String url = BASE_URL + "/v1/users/" + user()
                + "/devices/" + device() + "/pump_override";
        String body = "{\"in\":" + on + "}";
        Request req = authedPatch(url, body).build();
        enqueueBooleanCall(req, callback);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Manual fan override
    //    PATCH /v1/users/{user}/devices/{device}/fan_override
    // ──────────────────────────────────────────────────────────────────────────

    public void setFanOverride(boolean on, ApiCallback<Boolean> callback) {
        String url = BASE_URL + "/v1/users/" + user()
                + "/devices/" + device() + "/fan_override";
        String body = "{\"in\":" + on + "}";
        Request req = authedPatch(url, body).build();
        enqueueBooleanCall(req, callback);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Update threshold configuration
    //    PATCH /v1/users/{user}/devices/{device}/threshold_config
    // ──────────────────────────────────────────────────────────────────────────

    public void updateThresholds(float humidityLower, float tempUpper,
                                  float approachMargin, ApiCallback<Boolean> callback) {
        String url = BASE_URL + "/v1/users/" + user()
                + "/devices/" + device() + "/threshold_config";
        String body = String.format(Locale.US,
                "{\"in\":{\"humidity_lower\":%.1f,\"temp_upper\":%.1f,\"approach_margin\":%.1f}}",
                humidityLower, tempUpper, approachMargin);
        Request req = authedPatch(url, body).build();
        enqueueBooleanCall(req, callback);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. History chart data
    //    GET /v1/users/{user}/buckets/sensor_readings/data?last=24h
    //    range: "24h" | "7d" | "full"
    // ──────────────────────────────────────────────────────────────────────────

    public void getSensorHistory(String range, ApiCallback<String> callback) {
        String param = "24h";
        if ("7d".equals(range))   param = "7d";
        if ("full".equals(range)) param = "7d"; // use large window; UI averages per hour
        String url = BASE_URL + "/v1/users/" + user()
                + "/buckets/sensor_readings/data?last=" + param;
        Request req = authedGet(url).build();
        enqueueRawJson(req, callback);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Certification log events (paginated)
    //    GET /v1/users/{user}/buckets/actuation_events/data
    // ──────────────────────────────────────────────────────────────────────────

    public void getActuationEvents(int page, int pageSize,
                                    ApiCallback<List<EventLogEntry>> callback) {
        int skip = page * pageSize;
        String url = BASE_URL + "/v1/users/" + user()
                + "/buckets/actuation_events/data?count=" + pageSize
                + "&skip=" + skip + "&sort=-timestamp_server";
        Request req = authedGet(url).build();

        client.newCall(req).enqueue(new Callback() {
            @Override public void onFailure(Call call, IOException e) {
                callback.onFailure(e.getMessage());
            }

            @Override public void onResponse(Call call, Response response) throws IOException {
                try (response) {
                    if (!response.isSuccessful()) {
                        callback.onFailure("HTTP " + response.code());
                        return;
                    }
                    String body = response.body() != null ? response.body().string() : "[]";
                    List<EventLogEntry> entries = gson.fromJson(
                            body, new TypeToken<List<EventLogEntry>>() {}.getType());
                    // Compute tamper flag client-side for each entry
                    if (entries != null) {
                        for (EventLogEntry e : entries) {
                            e.setTamperFlag(computeTamper(
                                    e.getTimestampHw(), e.getTimestampServer()));
                        }
                    }
                    callback.onSuccess(entries);
                }
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 7. Trigger Twilio SMS webhook
    //    POST /v1/users/{user}/endpoints/breach_alert
    // ──────────────────────────────────────────────────────────────────────────

    public void triggerBreachAlert(String phone, ApiCallback<Boolean> callback) {
        String url = BASE_URL + "/v1/users/" + user() + "/endpoints/breach_alert";
        String body = "{\"phone\":\"" + phone + "\"}";
        Request req = authedPost(url, body).build();
        enqueueBooleanCall(req, callback);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 8. Validate credentials (auth check during login)
    //    GET /v1/users/{user}/devices/{device}/
    // ──────────────────────────────────────────────────────────────────────────

    public void validateCredentials(String user, String device, String token,
                                     ApiCallback<Boolean> callback) {
        String url = BASE_URL + "/v1/users/" + user + "/devices/" + device + "/";
        Request req = new Request.Builder()
                .url(url)
                .addHeader("Authorization", "Bearer " + token)
                .get()
                .build();

        client.newCall(req).enqueue(new Callback() {
            @Override public void onFailure(Call call, IOException e) {
                callback.onFailure(e.getMessage());
            }

            @Override public void onResponse(Call call, Response response) throws IOException {
                try (response) {
                    callback.onSuccess(response.isSuccessful());
                }
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ──────────────────────────────────────────────────────────────────────────

    /** Enqueue a call that just needs success/failure boolean result. */
    private void enqueueBooleanCall(Request req, ApiCallback<Boolean> callback) {
        client.newCall(req).enqueue(new Callback() {
            @Override public void onFailure(Call call, IOException e) {
                callback.onFailure(e.getMessage());
            }

            @Override public void onResponse(Call call, Response response) throws IOException {
                try (response) {
                    callback.onSuccess(response.isSuccessful());
                }
            }
        });
    }

    /** Enqueue a call that returns raw JSON string to the callback. */
    private void enqueueRawJson(Request req, ApiCallback<String> callback) {
        client.newCall(req).enqueue(new Callback() {
            @Override public void onFailure(Call call, IOException e) {
                callback.onFailure(e.getMessage());
            }

            @Override public void onResponse(Call call, Response response) throws IOException {
                try (response) {
                    if (!response.isSuccessful()) {
                        callback.onFailure("HTTP " + response.code());
                        return;
                    }
                    String body = response.body() != null ? response.body().string() : "[]";
                    callback.onSuccess(body);
                }
            }
        });
    }

    /**
     * Compute tamper flag: returns true if the two ISO 8601 timestamps differ
     * by more than 60 seconds.
     */
    private boolean computeTamper(String hw, String server) {
        if (hw == null || server == null) return false;
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        try {
            Date d1 = sdf.parse(hw);
            Date d2 = sdf.parse(server);
            if (d1 == null || d2 == null) return false;
            return Math.abs(d1.getTime() - d2.getTime()) > 60_000L;
        } catch (ParseException e) {
            return false;
        }
    }

    /** Release the OkHttp dispatcher when the app is destroyed. */
    public void shutdown() {
        client.dispatcher().executorService().shutdown();
        client.connectionPool().evictAll();
    }
}
