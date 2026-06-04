package com.futa.nurserymonitor.ui.dashboard;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.util.Log;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;
import androidx.core.widget.NestedScrollView;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.futa.nurserymonitor.R;
import com.futa.nurserymonitor.api.ThingerAPI;
import com.futa.nurserymonitor.ble.BLEManager;
import com.futa.nurserymonitor.fcm.NurseryFCMService;
import com.futa.nurserymonitor.models.EventLogEntry;
import com.futa.nurserymonitor.models.SensorSnapshot;
import com.futa.nurserymonitor.ui.certlog.CertLogActivity;
import com.futa.nurserymonitor.ui.history.HistoryActivity;
import com.futa.nurserymonitor.ui.settings.SettingsActivity;
import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.switchmaterial.SwitchMaterial;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * DashboardActivity — primary demo screen (Screen 2).
 *
 * Polls Thinger.io every 5 s via OkHttp3 async call, updates the
 * traffic-light status pill, sensor cards, actuator toggles, and
 * alert log.  Falls back to BLE when offline.
 */
public class DashboardActivity extends AppCompatActivity
        implements BLEManager.BLEDataCallback, TextToSpeech.OnInitListener {

    private static final String TAG = "DashboardActivity";
    private static final int POLL_INTERVAL_MS = 5000;

    // Colour constants
    private static final int CLR_NOMINAL  = Color.parseColor("#22C55E");
    private static final int CLR_APPROACH = Color.parseColor("#F59E0B");
    private static final int CLR_BREACH   = Color.parseColor("#EF4444");
    private static final int CLR_ERROR    = Color.parseColor("#9E9E9E");

    // Thresholds (loaded from prefs / defaults)
    private float threshHumidity = 85f;
    private float threshTemp     = 30f;
    private float approachMargin = 5f;

    // ── Views ────────────────────────────────────────────────────────────────
    private TextView tvStatusPill, tvLastUpdated, tvActuationMsg;
    private View bannerActuation, bannerBleOffline, layoutSensorCards;
    private TextView tvBleBars, tvBleCachedTime;
    private View layoutBleSignal;
    private ProgressBar progressPoll;
    private NestedScrollView scrollView;

    // Sensor card views
    private ProgressBar progHumIn, progTempIn, progHumOut, progTempOut;
    private ProgressBar progSoil5, progSoil10;
    private TextView tvHumIn, tvTempIn, tvHumOut, tvTempOut;
    private TextView tvSoil5, tvSoil10;
    private TextView tvInletStatus, tvOutletStatus, tvSoil5Status, tvSoil10Status;
    private CardView cardInlet, cardOutlet, cardSoil5, cardSoil10;

    // Actuator toggles
    private SwitchMaterial switchPump, switchFan;
    private boolean ignoreToggleEvents = false;

    // Alert log
    private RecyclerView rvAlertLog;
    private AlertLogAdapter alertAdapter;
    private final List<EventLogEntry> alertItems = new ArrayList<>();

    // Bottom nav
    private BottomNavigationView bottomNav;

    // ── State ────────────────────────────────────────────────────────────────
    private ThingerAPI api;
    private BLEManager bleManager;
    private TextToSpeech tts;
    private Handler pollHandler;
    private boolean polling = false;
    private boolean sensorCardsExpanded = false;
    private SensorSnapshot.Status previousStatus = null;
    private String pumpOnSince = null;
    private String fanOnSince  = null;
    private boolean isOffline  = false;

    // ═══════════════════════════════════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_dashboard);

        // Create notification channels
        NurseryFCMService.createNotificationChannels(this);

        // Load thresholds from SharedPreferences
        SharedPreferences prefs = getSharedPreferences(ThingerAPI.PREF_FILE, MODE_PRIVATE);
        threshHumidity = prefs.getFloat("threshold_humidity", 85f);
        threshTemp     = prefs.getFloat("threshold_temp",     30f);
        approachMargin = prefs.getFloat("approach_margin",     5f);

        // Init services
        api = ThingerAPI.getInstance(this);
        bleManager = new BLEManager(this);
        bleManager.setDataCallback(this);
        tts = new TextToSpeech(this, this);
        pollHandler = new Handler(Looper.getMainLooper());

        bindViews();
        setupBottomNav();
        setupStatusPill();
        setupActuatorToggles();
        setupAlertLog();

        handleFCMDeepLink(getIntent());
    }

    @Override
    protected void onStart() {
        super.onStart();
        startPolling();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshNow();
        if (isOffline) bleManager.startScan();
    }

    @Override
    protected void onPause() {
        super.onPause();
        stopPolling();
    }

    @Override
    protected void onStop() {
        super.onStop();
        bleManager.stopScan();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (tts != null) { tts.stop(); tts.shutdown(); }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleFCMDeepLink(intent);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  VIEW BINDING
    // ═══════════════════════════════════════════════════════════════════════

    private void bindViews() {
        tvStatusPill    = findViewById(R.id.tv_status_pill);
        tvLastUpdated   = findViewById(R.id.tv_last_updated);
        tvActuationMsg  = findViewById(R.id.tv_actuation_message);
        bannerActuation = findViewById(R.id.banner_actuation);
        bannerBleOffline= findViewById(R.id.banner_ble_offline);
        layoutSensorCards = findViewById(R.id.layout_sensor_cards);
        layoutBleSignal = findViewById(R.id.layout_ble_signal);
        tvBleBars       = findViewById(R.id.tv_ble_bars);
        tvBleCachedTime = findViewById(R.id.tv_ble_cached_time);
        progressPoll    = findViewById(R.id.progress_poll);
        scrollView      = findViewById(R.id.scroll_dashboard);

        // Sensor cards
        progHumIn   = findViewById(R.id.progress_hum_inlet);
        progTempIn  = findViewById(R.id.progress_temp_inlet);
        progHumOut  = findViewById(R.id.progress_hum_outlet);
        progTempOut = findViewById(R.id.progress_temp_outlet);
        progSoil5   = findViewById(R.id.progress_soil_5cm);
        progSoil10  = findViewById(R.id.progress_soil_10cm);

        tvHumIn     = findViewById(R.id.tv_hum_inlet_value);
        tvTempIn    = findViewById(R.id.tv_temp_inlet_value);
        tvHumOut    = findViewById(R.id.tv_hum_outlet_value);
        tvTempOut   = findViewById(R.id.tv_temp_outlet_value);
        tvSoil5     = findViewById(R.id.tv_soil5_value);
        tvSoil10    = findViewById(R.id.tv_soil10_value);

        tvInletStatus  = findViewById(R.id.tv_dht_inlet_status);
        tvOutletStatus = findViewById(R.id.tv_dht_outlet_status);
        tvSoil5Status  = findViewById(R.id.tv_soil5_status);
        tvSoil10Status = findViewById(R.id.tv_soil10_status);

        cardInlet  = findViewById(R.id.card_dht_inlet);
        cardOutlet = findViewById(R.id.card_dht_outlet);
        cardSoil5  = findViewById(R.id.card_soil_5cm);
        cardSoil10 = findViewById(R.id.card_soil_10cm);

        // Actuator toggles
        switchPump = findViewById(R.id.switch_pump);
        switchFan  = findViewById(R.id.switch_fan);

        // Alert log
        rvAlertLog = findViewById(R.id.rv_alert_log);

        // Bottom nav
        bottomNav = findViewById(R.id.bottom_nav);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STATUS PILL — tap to expand/collapse sensor cards
    // ═══════════════════════════════════════════════════════════════════════

    private void setupStatusPill() {
        tvStatusPill.setOnClickListener(v -> {
            sensorCardsExpanded = !sensorCardsExpanded;
            layoutSensorCards.setVisibility(sensorCardsExpanded ? View.VISIBLE : View.GONE);
        });
    }

    private void updateStatusPill(SensorSnapshot.Status status) {
        int color; String label;
        switch (status) {
            case BREACH:   color = CLR_BREACH;   label = getString(R.string.status_breach);   break;
            case APPROACH: color = CLR_APPROACH;  label = getString(R.string.status_approach); break;
            default:       color = CLR_NOMINAL;   label = getString(R.string.status_nominal);  break;
        }
        // 200ms cross-fade
        tvStatusPill.animate().alpha(0f).setDuration(100).withEndAction(() -> {
            tvStatusPill.setBackgroundTintList(ColorStateList.valueOf(color));
            tvStatusPill.setText(label);
            tvStatusPill.animate().alpha(1f).setDuration(100).start();
        }).start();

        // Voice alert on state transitions
        if (previousStatus != null && previousStatus != status) {
            speakTransition(previousStatus, status);
        }
        previousStatus = status;

        // Badge on bottom nav Home tab
        if (status == SensorSnapshot.Status.BREACH) {
            bottomNav.getOrCreateBadge(R.id.nav_home).setBackgroundColor(CLR_BREACH);
        } else {
            bottomNav.removeBadge(R.id.nav_home);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  SENSOR CARD UPDATES
    // ═══════════════════════════════════════════════════════════════════════

    private void updateSensorCards(SensorSnapshot snap) {
        // DHT22 Inlet
        updateSensorValue(progHumIn, tvHumIn, tvInletStatus, cardInlet,
                snap.getHumidityInlet(), threshHumidity, true, "%RH");
        updateSensorValue(progTempIn, null, null, null,
                snap.getTempInlet(), threshTemp, false, "°C");
        tvTempIn.setText(String.format(Locale.US, "%.1f °C", snap.getTempInlet()));
        progTempIn.setProgress((int) snap.getTempInlet());

        // DHT22 Outlet
        updateSensorValue(progHumOut, tvHumOut, tvOutletStatus, cardOutlet,
                snap.getHumidityOutlet(), threshHumidity, true, "%RH");
        tvTempOut.setText(String.format(Locale.US, "%.1f °C", snap.getTempOutlet()));
        progTempOut.setProgress((int) snap.getTempOutlet());

        // Soil probes
        updateSensorValue(progSoil5, tvSoil5, tvSoil5Status, cardSoil5,
                snap.getMoisture5cm(), 50f, true, "%VWC");
        updateSensorValue(progSoil10, tvSoil10, tvSoil10Status, cardSoil10,
                snap.getMoisture10cm(), 50f, true, "%VWC");
    }

    /**
     * Updates a single sensor row: progress bar tint, value text, status label,
     * and card border based on threshold proximity.
     *
     * @param isLower true = value must stay ABOVE threshold (humidity/moisture);
     *                false = value must stay BELOW threshold (temperature)
     */
    private void updateSensorValue(ProgressBar bar, TextView valueTv,
                                    TextView statusTv, CardView card,
                                    float value, float threshold,
                                    boolean isLower, String unit) {
        if (Float.isNaN(value)) {
            // Sensor error state
            if (bar != null)      bar.setProgressTintList(ColorStateList.valueOf(CLR_ERROR));
            if (valueTv != null)  valueTv.setText("—");
            if (statusTv != null) { statusTv.setText(R.string.label_sensor_error); statusTv.setTextColor(CLR_ERROR); }
            if (card != null)     card.setForeground(getDrawable(R.drawable.bg_sensor_card_error));
            return;
        }

        bar.setProgress((int) value);
        if (valueTv != null) valueTv.setText(String.format(Locale.US, "%.1f %s", value, unit));

        float diff = isLower ? (value - threshold) : (threshold - value);

        int color; String label;
        if (diff < 0) {
            // BREACH
            color = CLR_BREACH; label = getString(R.string.label_breach);
        } else if (diff < approachMargin) {
            // APPROACH
            color = CLR_APPROACH; label = getString(R.string.label_warning);
        } else {
            // OK
            color = CLR_NOMINAL; label = getString(R.string.label_ok);
        }

        bar.setProgressTintList(ColorStateList.valueOf(color));
        if (statusTv != null) { statusTv.setText(label); statusTv.setTextColor(color); }
        if (card != null) card.setForeground(null); // clear error border
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ACTUATION BANNER
    // ═══════════════════════════════════════════════════════════════════════

    private void updateActuationBanner(SensorSnapshot snap) {
        SensorSnapshot.Status st = snap.getParsedStatus();
        if (st != SensorSnapshot.Status.BREACH) {
            bannerActuation.setVisibility(View.GONE);
            pumpOnSince = null; fanOnSince = null;
            return;
        }
        bannerActuation.setVisibility(View.VISIBLE);
        String now = new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date());
        boolean pump = snap.isPumpState();
        boolean fan  = snap.isFanState();

        if (pump && pumpOnSince == null) pumpOnSince = now;
        if (fan  && fanOnSince  == null) fanOnSince  = now;

        String msg;
        if (pump && fan)    msg = getString(R.string.banner_both_on);
        else if (pump)      msg = String.format(getString(R.string.banner_pump_on), pumpOnSince);
        else if (fan)       msg = String.format(getString(R.string.banner_fan_on), fanOnSince);
        else                { bannerActuation.setVisibility(View.GONE); return; }
        tvActuationMsg.setText(msg);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ACTUATOR TOGGLES — confirmed state (not optimistic)
    // ═══════════════════════════════════════════════════════════════════════

    private void setupActuatorToggles() {
        switchPump.setOnCheckedChangeListener((btn, isChecked) -> {
            if (ignoreToggleEvents) return;
            switchPump.setEnabled(false);
            api.setPumpOverride(isChecked, new ThingerAPI.ApiCallback<Boolean>() {
                @Override public void onSuccess(Boolean ok) {
                    runOnUiThread(() -> {
                        switchPump.setEnabled(true);
                        if (!ok) switchPump.setChecked(!isChecked);
                        else addManualLogEntry(isChecked ? getString(R.string.log_pump_manual)
                                : getString(R.string.log_pump_off_manual));
                    });
                }
                @Override public void onFailure(String err) {
                    runOnUiThread(() -> {
                        switchPump.setEnabled(true);
                        switchPump.setChecked(!isChecked);
                        Toast.makeText(DashboardActivity.this, err, Toast.LENGTH_SHORT).show();
                    });
                }
            });
        });

        switchFan.setOnCheckedChangeListener((btn, isChecked) -> {
            if (ignoreToggleEvents) return;
            switchFan.setEnabled(false);
            api.setFanOverride(isChecked, new ThingerAPI.ApiCallback<Boolean>() {
                @Override public void onSuccess(Boolean ok) {
                    runOnUiThread(() -> {
                        switchFan.setEnabled(true);
                        if (!ok) switchFan.setChecked(!isChecked);
                        else addManualLogEntry(isChecked ? getString(R.string.log_fan_manual)
                                : getString(R.string.log_fan_off_manual));
                    });
                }
                @Override public void onFailure(String err) {
                    runOnUiThread(() -> {
                        switchFan.setEnabled(true);
                        switchFan.setChecked(!isChecked);
                        Toast.makeText(DashboardActivity.this, err, Toast.LENGTH_SHORT).show();
                    });
                }
            });
        });
    }

    private void syncToggles(SensorSnapshot snap) {
        ignoreToggleEvents = true;
        switchPump.setChecked(snap.isPumpState());
        switchFan.setChecked(snap.isFanState());
        ignoreToggleEvents = false;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ALERT LOG
    // ═══════════════════════════════════════════════════════════════════════

    private void setupAlertLog() {
        alertAdapter = new AlertLogAdapter(alertItems);
        rvAlertLog.setLayoutManager(new LinearLayoutManager(this));
        rvAlertLog.setAdapter(alertAdapter);
    }

    private void addManualLogEntry(String desc) {
        String nowIso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'",
                Locale.US).format(new Date());
        EventLogEntry e = new EventLogEntry();
        e.setEventId(java.util.UUID.randomUUID().toString());
        e.setEventType("ACTUATOR_ON");
        e.setTimestampHw(nowIso);
        e.setTimestampServer(nowIso);
        e.setNodeId(getSharedPreferences(ThingerAPI.PREF_FILE, MODE_PRIVATE)
                .getString(ThingerAPI.PREF_DEVICE, "unknown"));
        alertAdapter.prependEntry(e);
        rvAlertLog.scrollToPosition(0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  POLLING — 5 s interval via Handler
    // ═══════════════════════════════════════════════════════════════════════

    private final Runnable pollRunnable = new Runnable() {
        @Override public void run() {
            if (!polling) return;
            fetchSensorData();
            pollHandler.postDelayed(this, POLL_INTERVAL_MS);
        }
    };

    private void startPolling() {
        if (polling) return;
        polling = true;
        pollHandler.post(pollRunnable);
    }

    private void stopPolling() {
        polling = false;
        pollHandler.removeCallbacks(pollRunnable);
    }

    private void refreshNow() {
        fetchSensorData();
    }

    private void fetchSensorData() {
        if (!hasNetwork()) {
            goOffline();
            return;
        }
        goOnline();
        progressPoll.setVisibility(View.VISIBLE);

        api.getSensorSnapshot(new ThingerAPI.ApiCallback<SensorSnapshot>() {
            @Override
            public void onSuccess(SensorSnapshot snap) {
                runOnUiThread(() -> applySnapshot(snap));
            }
            @Override
            public void onFailure(String err) {
                runOnUiThread(() -> {
                    progressPoll.setVisibility(View.INVISIBLE);
                    Toast.makeText(DashboardActivity.this,
                            getString(R.string.error_slow_connection), Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    /** Apply a snapshot (from API or BLE) to all UI elements. */
    private void applySnapshot(SensorSnapshot snap) {
        progressPoll.setVisibility(View.INVISIBLE);

        // Status pill
        updateStatusPill(snap.getParsedStatus());

        // Actuation banner
        updateActuationBanner(snap);

        // Sensor cards
        updateSensorCards(snap);

        // Toggle switches (confirmed state)
        syncToggles(snap);

        // Last updated timestamp
        String ts = snap.getLastUpdated();
        tvLastUpdated.setText(ts != null && !ts.equals("BLE")
                ? "Updated: " + ts : "BLE data");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  BLE OFFLINE FALLBACK
    // ═══════════════════════════════════════════════════════════════════════

    private void goOffline() {
        if (isOffline) return;
        isOffline = true;
        bannerBleOffline.setVisibility(View.VISIBLE);
        layoutBleSignal.setVisibility(View.VISIBLE);
        bleManager.startScan();
    }

    private void goOnline() {
        if (!isOffline) return;
        isOffline = false;
        bannerBleOffline.setVisibility(View.GONE);
        layoutBleSignal.setVisibility(View.GONE);
        bleManager.stopScan();
    }

    @Override
    public void onSnapshotReceived(SensorSnapshot snapshot, int rssi) {
        runOnUiThread(() -> {
            applySnapshot(snapshot);
            int bars = bleManager.getSignalBars();
            String barsStr = bars >= 3 ? "▂▄▆" : bars >= 2 ? "▂▄" : "▂";
            tvBleBars.setText(barsStr);
        });
    }

    @Override
    public void onBLEError(String message) {
        runOnUiThread(() ->
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show());
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  VOICE ALERTS (TextToSpeech)
    // ═══════════════════════════════════════════════════════════════════════

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            tts.setLanguage(Locale.US);
        }
    }

    private void speakTransition(SensorSnapshot.Status from, SensorSnapshot.Status to) {
        if (tts == null) return;
        String msg;
        if (to == SensorSnapshot.Status.APPROACH)
            msg = getString(R.string.voice_approach);
        else if (to == SensorSnapshot.Status.BREACH)
            msg = getString(R.string.voice_breach);
        else if (from == SensorSnapshot.Status.BREACH && to == SensorSnapshot.Status.NOMINAL)
            msg = getString(R.string.voice_nominal);
        else return;

        tts.speak(msg, TextToSpeech.QUEUE_FLUSH, null, "status_change");
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  BOTTOM NAVIGATION
    // ═══════════════════════════════════════════════════════════════════════

    private void setupBottomNav() {
        bottomNav.setSelectedItemId(R.id.nav_home);
        bottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_home) return true;
            if (id == R.id.nav_history) {
                startActivity(new Intent(this, HistoryActivity.class));
                overridePendingTransition(0, 0);
                return true;
            }
            if (id == R.id.nav_cert_log) {
                startActivity(new Intent(this, CertLogActivity.class));
                overridePendingTransition(0, 0);
                return true;
            }
            if (id == R.id.nav_settings) {
                startActivity(new Intent(this, SettingsActivity.class));
                overridePendingTransition(0, 0);
                return true;
            }
            return false;
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  FCM DEEP LINK HANDLING
    // ═══════════════════════════════════════════════════════════════════════

    private void handleFCMDeepLink(Intent intent) {
        if (intent == null) return;
        if (intent.getBooleanExtra(NurseryFCMService.EXTRA_SCROLL_ALERT_LOG, false)) {
            scrollView.post(() -> scrollView.fullScroll(View.FOCUS_DOWN));
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  NETWORK CHECK
    // ═══════════════════════════════════════════════════════════════════════

    private boolean hasNetwork() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        Network net = cm.getActiveNetwork();
        if (net == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(net);
        return caps != null && (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                || caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR));
    }
}
