package com.futa.nurserymonitor.ui.settings;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.futa.nurserymonitor.R;
import com.futa.nurserymonitor.api.ThingerAPI;
import com.futa.nurserymonitor.ui.certlog.CertLogActivity;
import com.futa.nurserymonitor.ui.dashboard.DashboardActivity;
import com.futa.nurserymonitor.ui.history.HistoryActivity;
import com.futa.nurserymonitor.ui.splash.SplashActivity;
import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.switchmaterial.SwitchMaterial;
import com.google.android.material.textfield.TextInputEditText;

import java.util.Locale;

/**
 * SettingsActivity — configuration screen (Screen 5).
 *
 * Sections: Alert thresholds, Farmer contact, Language,
 * Device info, Display, Logout.
 */
public class SettingsActivity extends AppCompatActivity {

    private TextInputEditText etHumidity, etTemp, etMargin, etPhone;
    private Spinner spinnerLanguage;
    private SwitchMaterial switchDarkMode;
    private TextView tvNodeId, tvFirmware, tvOta, tvWifi, tvGsm;

    private ThingerAPI api;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        api   = ThingerAPI.getInstance(this);
        prefs = getSharedPreferences(ThingerAPI.PREF_FILE, MODE_PRIVATE);

        bindViews();
        loadSavedSettings();
        setupListeners();
        setupBottomNav();
        fetchDeviceInfo();
    }

    private void bindViews() {
        etHumidity      = findViewById(R.id.et_threshold_humidity);
        etTemp          = findViewById(R.id.et_threshold_temp);
        etMargin        = findViewById(R.id.et_approach_margin);
        etPhone         = findViewById(R.id.et_phone);
        spinnerLanguage = findViewById(R.id.spinner_language);
        switchDarkMode  = findViewById(R.id.switch_dark_mode);
        tvNodeId        = findViewById(R.id.tv_node_id);
        tvFirmware      = findViewById(R.id.tv_firmware);
        tvOta           = findViewById(R.id.tv_ota);
        tvWifi          = findViewById(R.id.tv_wifi_signal);
        tvGsm           = findViewById(R.id.tv_gsm_signal);
    }

    private void loadSavedSettings() {
        etHumidity.setText(String.valueOf(prefs.getFloat("threshold_humidity", 85f)));
        etTemp.setText(String.valueOf(prefs.getFloat("threshold_temp", 30f)));
        etMargin.setText(String.valueOf(prefs.getFloat("approach_margin", 5f)));
        etPhone.setText(prefs.getString("farmer_phone", ""));

        int langIdx = prefs.getInt("alert_language_idx", 0);
        spinnerLanguage.setSelection(langIdx);

        switchDarkMode.setChecked(prefs.getBoolean("dark_mode", true));
    }

    private void setupListeners() {
        // ── Save thresholds ─────────────────────────────────────────────
        MaterialButton btnSave = findViewById(R.id.btn_save_thresholds);
        btnSave.setOnClickListener(v -> saveThresholds());

        // ── Test SMS ────────────────────────────────────────────────────
        MaterialButton btnSms = findViewById(R.id.btn_test_sms);
        btnSms.setOnClickListener(v -> testSms());

        // ── Logout ──────────────────────────────────────────────────────
        MaterialButton btnLogout = findViewById(R.id.btn_logout);
        btnLogout.setOnClickListener(v -> confirmLogout());
    }

    // ═══════════════════════════════════════════════════════════════════
    //  THRESHOLD SAVE — PATCH to ESP32 with 10 s acknowledgement check
    // ═══════════════════════════════════════════════════════════════════

    private void saveThresholds() {
        float hum, temp, margin;
        try {
            hum    = Float.parseFloat(getEditText(etHumidity));
            temp   = Float.parseFloat(getEditText(etTemp));
            margin = Float.parseFloat(getEditText(etMargin));
        } catch (NumberFormatException e) {
            Toast.makeText(this, "Please enter valid numbers", Toast.LENGTH_SHORT).show();
            return;
        }

        // Save locally first
        prefs.edit()
                .putFloat("threshold_humidity", hum)
                .putFloat("threshold_temp", temp)
                .putFloat("approach_margin", margin)
                .putString("farmer_phone", getEditText(etPhone))
                .putInt("alert_language_idx", spinnerLanguage.getSelectedItemPosition())
                .putBoolean("dark_mode", switchDarkMode.isChecked())
                .apply();

        // PATCH to ESP32 via Thinger.io
        final boolean[] acknowledged = {false};

        api.updateThresholds(hum, temp, margin, new ThingerAPI.ApiCallback<Boolean>() {
            @Override
            public void onSuccess(Boolean ok) {
                acknowledged[0] = true;
                runOnUiThread(() -> Toast.makeText(SettingsActivity.this,
                        getString(R.string.toast_settings_saved), Toast.LENGTH_SHORT).show());
            }
            @Override
            public void onFailure(String err) {
                // Will be caught by the 10 s timeout below
            }
        });

        // 10 s acknowledgement timeout
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (!acknowledged[0]) {
                Toast.makeText(this, getString(R.string.toast_settings_local),
                        Toast.LENGTH_LONG).show();
            }
        }, 10_000);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TEST SMS — triggers Twilio webhook immediately
    // ═══════════════════════════════════════════════════════════════════

    private void testSms() {
        String phone = getEditText(etPhone);
        if (phone.isEmpty()) {
            Toast.makeText(this, "Enter a phone number first", Toast.LENGTH_SHORT).show();
            return;
        }

        api.triggerBreachAlert(phone, new ThingerAPI.ApiCallback<Boolean>() {
            @Override
            public void onSuccess(Boolean ok) {
                runOnUiThread(() -> Toast.makeText(SettingsActivity.this,
                        getString(R.string.toast_sms_sent), Toast.LENGTH_SHORT).show());
            }
            @Override
            public void onFailure(String err) {
                runOnUiThread(() -> Toast.makeText(SettingsActivity.this,
                        "SMS failed: " + err, Toast.LENGTH_SHORT).show());
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    //  DEVICE INFO — fetched from ESP32 device resource
    // ═══════════════════════════════════════════════════════════════════

    private void fetchDeviceInfo() {
        String device = prefs.getString(ThingerAPI.PREF_DEVICE, "—");
        tvNodeId.setText("Node ID: " + device);

        // The remaining fields would come from a dedicated Thinger.io device resource.
        // For now show the device ID; firmware/OTA/signal will populate when ESP32 is online.
        api.getSensorSnapshot(new ThingerAPI.ApiCallback<com.futa.nurserymonitor.models.SensorSnapshot>() {
            @Override
            public void onSuccess(com.futa.nurserymonitor.models.SensorSnapshot snap) {
                runOnUiThread(() -> {
                    tvFirmware.setText("Firmware: v1.0.0");
                    tvOta.setText("Last OTA: —");
                    tvWifi.setText("Wi-Fi Signal: Connected");
                    tvGsm.setText("GSM Signal: —");
                });
            }
            @Override
            public void onFailure(String err) {
                runOnUiThread(() -> {
                    tvFirmware.setText("Firmware: unavailable");
                    tvWifi.setText("Wi-Fi Signal: offline");
                });
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    //  LOGOUT — confirmation dialog → clear prefs → return to Splash
    // ═══════════════════════════════════════════════════════════════════

    private void confirmLogout() {
        new AlertDialog.Builder(this, com.google.android.material.R.style.ThemeOverlay_MaterialComponents_Dialog_Alert)
                .setTitle(getString(R.string.dialog_logout_title))
                .setMessage(getString(R.string.dialog_logout_message))
                .setPositiveButton(getString(R.string.dialog_confirm), (dlg, which) -> {
                    prefs.edit().clear().apply();
                    Intent intent = new Intent(this, SplashActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    startActivity(intent);
                    finish();
                })
                .setNegativeButton(getString(R.string.dialog_cancel), null)
                .show();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  BOTTOM NAV
    // ═══════════════════════════════════════════════════════════════════

    private void setupBottomNav() {
        BottomNavigationView nav = findViewById(R.id.bottom_nav);
        nav.setSelectedItemId(R.id.nav_settings);
        nav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_settings) return true;
            if (id == R.id.nav_home) {
                startActivity(new Intent(this, DashboardActivity.class));
                overridePendingTransition(0, 0); finish(); return true;
            }
            if (id == R.id.nav_history) {
                startActivity(new Intent(this, HistoryActivity.class));
                overridePendingTransition(0, 0); finish(); return true;
            }
            if (id == R.id.nav_cert_log) {
                startActivity(new Intent(this, CertLogActivity.class));
                overridePendingTransition(0, 0); finish(); return true;
            }
            return false;
        });
    }

    private String getEditText(TextInputEditText et) {
        return et.getText() != null ? et.getText().toString().trim() : "";
    }
}
