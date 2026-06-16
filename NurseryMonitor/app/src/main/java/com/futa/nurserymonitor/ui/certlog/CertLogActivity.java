package com.futa.nurserymonitor.ui.certlog;

import android.content.ContentValues;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.media.MediaScannerConnection;
import android.provider.MediaStore;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.futa.nurserymonitor.R;
import com.futa.nurserymonitor.api.ThingerAPI;
import com.futa.nurserymonitor.models.EventLogEntry;
import com.futa.nurserymonitor.ui.dashboard.DashboardActivity;
import com.futa.nurserymonitor.ui.history.HistoryActivity;
import com.futa.nurserymonitor.ui.settings.SettingsActivity;
import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.chip.ChipGroup;
import com.google.gson.Gson;
import com.futa.nurserymonitor.util.DownloadExportUtil;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * CertLogActivity — tamper-evident certification log (Screen 4).
 * Paginated list of actuation events with filter, export, and summary.
 */
public class CertLogActivity extends AppCompatActivity {

    private static final int PAGE_SIZE = 20;
    private int currentPage = 0;
    private String activeFilter = "ALL";
    private final List<EventLogEntry> allEntries = new ArrayList<>();
    private final List<EventLogEntry> filtered   = new ArrayList<>();
    private CertLogAdapter adapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_cert_log);

        RecyclerView rv = findViewById(R.id.rv_cert_log);
        adapter = new CertLogAdapter(filtered);
        rv.setLayoutManager(new LinearLayoutManager(this));
        rv.setAdapter(adapter);

        setupFilters();
        setupExportButtons();
        setupBottomNav();

        findViewById(R.id.btn_load_more).setOnClickListener(v -> loadPage(++currentPage));
        loadPage(0);
    }

    private void loadPage(int page) {
        ThingerAPI.getInstance(this).getActuationEvents(page, PAGE_SIZE,
                new ThingerAPI.ApiCallback<List<EventLogEntry>>() {
                    @Override public void onSuccess(List<EventLogEntry> entries) {
                        runOnUiThread(() -> {
                            if (page == 0) allEntries.clear();
                            if (entries != null) allEntries.addAll(entries);
                            applyFilter();
                            updateSummary();
                        });
                    }
                    @Override public void onFailure(String err) {
                        runOnUiThread(() -> Toast.makeText(CertLogActivity.this,
                                getString(R.string.error_slow_connection), Toast.LENGTH_SHORT).show());
                    }
                });
    }

    private void setupFilters() {
        ChipGroup cg = findViewById(R.id.chip_group_filter);
        cg.setOnCheckedStateChangeListener((group, checkedIds) -> {
            if (checkedIds.isEmpty()) return;
            int id = checkedIds.get(0);
            if (id == R.id.chip_all)           activeFilter = "ALL";
            else if (id == R.id.chip_breach)   activeFilter = "BREACH";
            else if (id == R.id.chip_resolved) activeFilter = "RESOLVED";
            else if (id == R.id.chip_manual)   activeFilter = "MANUAL";
            applyFilter();
        });
    }

    private void applyFilter() {
        filtered.clear();
        for (EventLogEntry e : allEntries) {
            if ("ALL".equals(activeFilter)) { filtered.add(e); continue; }
            if ("BREACH".equals(activeFilter) && "BREACH".equals(e.getEventType())) filtered.add(e);
            if ("RESOLVED".equals(activeFilter) && "RESOLVED".equals(e.getEventType())) filtered.add(e);
            if ("MANUAL".equals(activeFilter) &&
                    ("ACTUATOR_ON".equals(e.getEventType()) || "ACTUATOR_OFF".equals(e.getEventType())))
                filtered.add(e);
        }
        adapter.notifyDataSetChanged();
    }

    private void updateSummary() {
        int breaches = 0, actuations = 0, total = allEntries.size();
        for (EventLogEntry e : allEntries) {
            if ("BREACH".equals(e.getEventType())) breaches++;
            if ("ACTUATOR_ON".equals(e.getEventType())) actuations++;
        }
        float compliance = total > 0 ? ((total - breaches) * 100f / total) : 100f;

        ((TextView) findViewById(R.id.tv_cert_compliance)).setText(
                String.format(Locale.US, "Compliance: %.1f%%", compliance));
        ((TextView) findViewById(R.id.tv_cert_breaches)).setText(
                String.format(Locale.US, "Breach Events: %d", breaches));
        ((TextView) findViewById(R.id.tv_cert_actuations)).setText(
                String.format(Locale.US, "Actuator Activations: %d", actuations));
        ((TextView) findViewById(R.id.tv_cert_period)).setText("Batch period: current cycle");
    }

    // ── Export ───────────────────────────────────────────────────────────

    private void setupExportButtons() {
        findViewById(R.id.btn_export_csv).setOnClickListener(v -> exportFile("csv"));
        findViewById(R.id.btn_export_json).setOnClickListener(v -> exportFile("json"));
    }

    private void exportFile(String format) {
        try {
            String content;
            String mime;
            if ("json".equals(format)) {
                content = new Gson().toJson(allEntries);
                mime = "application/json";
            } else {
                StringBuilder sb = new StringBuilder();
                sb.append("event_id,event_type,timestamp_hw,timestamp_server,humidity_inlet,humidity_outlet,temp_inlet,temp_outlet,moisture_5cm,moisture_10cm,pump,fan,sms,tamper\n");
                for (EventLogEntry e : allEntries) {
                    sb.append(String.format(Locale.US, "%s,%s,%s,%s,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%b,%b,%b,%b\n",
                            e.getEventId(), e.getEventType(), e.getTimestampHw(), e.getTimestampServer(),
                            e.getHumidityInlet(), e.getHumidityOutlet(), e.getTempInlet(), e.getTempOutlet(),
                            e.getMoisture5cm(), e.getMoisture10cm(), e.isPumpState(), e.isFanState(),
                            e.isSmsSent(), e.isTamperFlag()));
                }
                content = sb.toString();
                mime = "text/csv";
            }

            String filename = "certification_log." + format;
            Uri uri = DownloadExportUtil.writeTextToDownloads(this, filename, content, mime);

            if (uri != null) {
                Intent share = new Intent(Intent.ACTION_SEND);
                share.setType(mime);
                share.putExtra(Intent.EXTRA_STREAM, uri);
                share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(Intent.createChooser(share, "Share certification log"));
            }
            Toast.makeText(this, String.format(getString(R.string.toast_export_success),
                    allEntries.size(), "current cycle"), Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, getString(R.string.error_export_failed), Toast.LENGTH_SHORT).show();
        }
    }

    // ── Adapter ──────────────────────────────────────────────────────────

    static class CertLogAdapter extends RecyclerView.Adapter<CertLogAdapter.VH> {
        private static final int CLR_BREACH   = Color.parseColor("#EF4444");
        private static final int CLR_APPROACH = Color.parseColor("#F59E0B");
        private static final int CLR_NOMINAL  = Color.parseColor("#22C55E");
        private static final int CLR_INFO     = Color.parseColor("#2E75B6");

        private final List<EventLogEntry> items;
        CertLogAdapter(List<EventLogEntry> items) { this.items = items; }

        static class VH extends RecyclerView.ViewHolder {
            TextView tvBadge, tvTimestamp, tvValues, tvActuators, tvTamper;
            boolean showServer = false;
            VH(View v) {
                super(v);
                tvBadge     = v.findViewById(R.id.tv_event_badge);
                tvTimestamp  = v.findViewById(R.id.tv_event_ts);
                tvValues    = v.findViewById(R.id.tv_event_values);
                tvActuators = v.findViewById(R.id.tv_event_actuators);
                tvTamper    = v.findViewById(R.id.tv_tamper);
            }
        }

        @NonNull @Override
        public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View v = LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.item_cert_log, parent, false);
            return new VH(v);
        }

        @Override public void onBindViewHolder(@NonNull VH h, int pos) {
            EventLogEntry e = items.get(pos);
            h.tvBadge.setText(e.getEventType());
            int badgeColor;
            switch (e.getParsedEventType()) {
                case BREACH:      badgeColor = CLR_BREACH;   break;
                case APPROACH:    badgeColor = CLR_APPROACH; break;
                case RESOLVED:    badgeColor = CLR_NOMINAL;  break;
                default:          badgeColor = CLR_INFO;     break;
            }
            h.tvBadge.setBackgroundTintList(ColorStateList.valueOf(badgeColor));

            h.showServer = false;
            h.tvTimestamp.setText(e.getTimestampHw() != null ? e.getTimestampHw() : "—");
            h.tvTimestamp.setOnClickListener(v -> {
                h.showServer = !h.showServer;
                h.tvTimestamp.setText(h.showServer
                        ? (e.getTimestampServer() != null ? e.getTimestampServer() : "—")
                        : (e.getTimestampHw() != null ? e.getTimestampHw() : "—"));
            });

            h.tvValues.setText(String.format(Locale.US,
                    "H: %.0f/%.0f%%  T: %.0f/%.0f°C  M: %.0f/%.0f%%",
                    e.getHumidityInlet(), e.getHumidityOutlet(),
                    e.getTempInlet(), e.getTempOutlet(),
                    e.getMoisture5cm(), e.getMoisture10cm()));

            h.tvActuators.setText(String.format("Pump: %s | Fan: %s%s",
                    e.isPumpState() ? "ON" : "OFF",
                    e.isFanState()  ? "ON" : "OFF",
                    e.isSmsSent()   ? " | SMS ✓" : ""));

            h.tvTamper.setVisibility(e.isTamperFlag() ? View.VISIBLE : View.GONE);
        }

        @Override public int getItemCount() { return items.size(); }
    }

    // ── Bottom nav ──────────────────────────────────────────────────────

    private void setupBottomNav() {
        BottomNavigationView nav = findViewById(R.id.bottom_nav);
        nav.setSelectedItemId(R.id.nav_cert_log);
        nav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_cert_log) return true;
            if (id == R.id.nav_home) {
                startActivity(new Intent(this, DashboardActivity.class));
                overridePendingTransition(0, 0); finish(); return true;
            }
            if (id == R.id.nav_history) {
                startActivity(new Intent(this, HistoryActivity.class));
                overridePendingTransition(0, 0); finish(); return true;
            }
            if (id == R.id.nav_settings) {
                startActivity(new Intent(this, SettingsActivity.class));
                overridePendingTransition(0, 0); finish(); return true;
            }
            return false;
        });
    }
}
