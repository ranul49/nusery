package com.futa.nurserymonitor.ui.splash;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.futa.nurserymonitor.R;
import com.futa.nurserymonitor.api.ThingerAPI;
import com.futa.nurserymonitor.fcm.NurseryFCMService;
import com.futa.nurserymonitor.ui.dashboard.DashboardActivity;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * SplashActivity — entry point (Screen 1).
 *
 * Shows logo for 1.5 s, checks SharedPreferences for a saved token.
 * If found → auto-navigate to Dashboard.
 * If not → shows login form (username, device ID, access token).
 * Validates via GET to Thinger.io before saving credentials.
 */
public class SplashActivity extends AppCompatActivity {

    private ProgressBar progressSplash;
    private View layoutLogin;
    private TextInputEditText etUsername, etDeviceId, etToken;
    private TextView tvError;
    private MaterialButton btnLogin, btnScanQr;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        // Create notification channels early
        NurseryFCMService.createNotificationChannels(this);

        progressSplash = findViewById(R.id.progress_splash);
        layoutLogin    = findViewById(R.id.layout_login);
        etUsername      = findViewById(R.id.et_username);
        etDeviceId     = findViewById(R.id.et_device_id);
        etToken        = findViewById(R.id.et_token);
        tvError        = findViewById(R.id.tv_login_error);
        btnLogin       = findViewById(R.id.btn_login);
        btnScanQr      = findViewById(R.id.btn_scan_qr);

        // Register FCM token in background
        registerFCM();

        // Check saved credentials after 1.5 s splash delay
        new Handler(Looper.getMainLooper()).postDelayed(this::checkSavedCredentials, 1500);

        btnLogin.setOnClickListener(v -> attemptLogin());
        btnScanQr.setOnClickListener(v -> {
            // QR scanning — launch ZXing embedded scanner
            // For simplicity, toast placeholder; full implementation uses IntentIntegrator
            Toast.makeText(this, "QR scanner launching…", Toast.LENGTH_SHORT).show();
        });
    }

    private void checkSavedCredentials() {
        SharedPreferences prefs = getSharedPreferences(ThingerAPI.PREF_FILE, MODE_PRIVATE);
        String token = prefs.getString(ThingerAPI.PREF_TOKEN, "");
        if (!token.isEmpty()) {
            navigateToDashboard();
        } else {
            // Show login form
            progressSplash.setVisibility(View.GONE);
            layoutLogin.setVisibility(View.VISIBLE);
        }
    }

    private void attemptLogin() {
        String user   = getText(etUsername);
        String device = getText(etDeviceId);
        String token  = getText(etToken);

        if (user.isEmpty() || device.isEmpty() || token.isEmpty()) {
            showError("Please fill in all fields");
            return;
        }

        btnLogin.setEnabled(false);
        progressSplash.setVisibility(View.VISIBLE);
        tvError.setVisibility(View.GONE);

        ThingerAPI.getInstance(this).validateCredentials(user, device, token,
                new ThingerAPI.ApiCallback<Boolean>() {
                    @Override
                    public void onSuccess(Boolean valid) {
                        runOnUiThread(() -> {
                            if (valid) {
                                saveCredentials(user, device, token);
                                navigateToDashboard();
                            } else {
                                btnLogin.setEnabled(true);
                                progressSplash.setVisibility(View.GONE);
                                showError(getString(R.string.error_auth_failed));
                            }
                        });
                    }

                    @Override
                    public void onFailure(String err) {
                        runOnUiThread(() -> {
                            btnLogin.setEnabled(true);
                            progressSplash.setVisibility(View.GONE);
                            showError("Connection error: " + err);
                        });
                    }
                });
    }

    private void saveCredentials(String user, String device, String token) {
        getSharedPreferences(ThingerAPI.PREF_FILE, MODE_PRIVATE).edit()
                .putString(ThingerAPI.PREF_USER, user)
                .putString(ThingerAPI.PREF_DEVICE, device)
                .putString(ThingerAPI.PREF_TOKEN, token)
                .apply();
    }

    private void navigateToDashboard() {
        startActivity(new Intent(this, DashboardActivity.class));
        finish();
    }

    private void showError(String msg) {
        tvError.setText(msg);
        tvError.setVisibility(View.VISIBLE);
    }

    private String getText(TextInputEditText et) {
        return et.getText() != null ? et.getText().toString().trim() : "";
    }

    private void registerFCM() {
        FirebaseMessaging.getInstance().getToken()
                .addOnSuccessListener(token -> {
                    // In production, send this token to your backend
                    android.util.Log.i("SplashActivity", "FCM token: " + token);
                });
    }
}
