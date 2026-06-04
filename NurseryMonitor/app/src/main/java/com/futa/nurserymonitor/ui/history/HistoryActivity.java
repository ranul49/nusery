package com.futa.nurserymonitor.ui.history;

import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.futa.nurserymonitor.R;
import com.futa.nurserymonitor.api.ThingerAPI;
import com.futa.nurserymonitor.ui.certlog.CertLogActivity;
import com.futa.nurserymonitor.ui.dashboard.DashboardActivity;
import com.futa.nurserymonitor.ui.settings.SettingsActivity;
import com.github.mikephil.charting.charts.LineChart;
import com.github.mikephil.charting.components.LimitLine;
import com.github.mikephil.charting.components.XAxis;
import com.github.mikephil.charting.components.YAxis;
import com.github.mikephil.charting.data.Entry;
import com.github.mikephil.charting.data.LineData;
import com.github.mikephil.charting.data.LineDataSet;
import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.button.MaterialButtonToggleGroup;
import com.google.android.material.tabs.TabLayout;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * HistoryActivity — sensor trend charts (Screen 3).
 *
 * Uses MPAndroidChart line charts with three metric tabs
 * (Humidity, Temperature, Moisture) and three time ranges
 * (24h, 7d, Full cycle).
 */
public class HistoryActivity extends AppCompatActivity {

    private static final int CLR_INLET  = Color.parseColor("#2E75B6");
    private static final int CLR_OUTLET = Color.parseColor("#22C55E");
    private static final int CLR_THRESH = Color.parseColor("#EF4444");

    private LineChart chart;
    private TabLayout tabsMetric;
    private MaterialButtonToggleGroup toggleRange;
    private TextView tvAvg, tvCompliance, tvBreach, tvRange;

    private String currentRange = "24h";
    private int currentMetric = 0; // 0=Humidity, 1=Temp, 2=Moisture
    private String cachedJson = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_history);

        chart         = findViewById(R.id.chart_history);
        tabsMetric    = findViewById(R.id.tabs_metric);
        toggleRange   = findViewById(R.id.toggle_range);
        tvAvg         = findViewById(R.id.tv_stat_avg);
        tvCompliance  = findViewById(R.id.tv_stat_compliance);
        tvBreach      = findViewById(R.id.tv_stat_breach);
        tvRange       = findViewById(R.id.tv_stat_range);

        setupChart();
        setupTabs();
        setupRangeToggle();
        setupBottomNav();
        setupExportButton();

        // Default: 24h selected
        toggleRange.check(R.id.btn_24h);
        loadData();
    }

    // ── Chart configuration ─────────────────────────────────────────────

    private void setupChart() {
        chart.setBackgroundColor(Color.TRANSPARENT);
        chart.setDrawGridBackground(false);
        chart.getDescription().setEnabled(false);
        chart.setTouchEnabled(true);
        chart.setDragEnabled(true);
        chart.setScaleEnabled(true);
        chart.setPinchZoom(true);
        chart.getLegend().setTextColor(Color.WHITE);
        chart.setNoDataTextColor(Color.WHITE);
        chart.setNoDataText("Loading sensor history…");

        XAxis xAxis = chart.getXAxis();
        xAxis.setPosition(XAxis.XAxisPosition.BOTTOM);
        xAxis.setTextColor(Color.parseColor("#B3FFFFFF"));
        xAxis.setDrawGridLines(false);

        YAxis leftAxis = chart.getAxisLeft();
        leftAxis.setTextColor(Color.parseColor("#B3FFFFFF"));
        leftAxis.setDrawGridLines(true);
        leftAxis.setGridColor(Color.parseColor("#1FFFFFFF"));

        chart.getAxisRight().setEnabled(false);
    }

    private void setupTabs() {
        tabsMetric.addTab(tabsMetric.newTab().setText(R.string.tab_humidity));
        tabsMetric.addTab(tabsMetric.newTab().setText(R.string.tab_temperature));
        tabsMetric.addTab(tabsMetric.newTab().setText(R.string.tab_moisture));

        tabsMetric.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override public void onTabSelected(TabLayout.Tab tab) {
                currentMetric = tab.getPosition();
                if (cachedJson != null) renderChart(cachedJson);
            }
            @Override public void onTabUnselected(TabLayout.Tab tab) {}
            @Override public void onTabReselected(TabLayout.Tab tab) {}
        });
    }

    private void setupRangeToggle() {
        toggleRange.addOnButtonCheckedListener((group, checkedId, isChecked) -> {
            if (!isChecked) return;
            if (checkedId == R.id.btn_24h)      currentRange = "24h";
            else if (checkedId == R.id.btn_7d)   currentRange = "7d";
            else if (checkedId == R.id.btn_full)  currentRange = "full";
            loadData();
        });
    }

    // ── Data loading ────────────────────────────────────────────────────

    private void loadData() {
        ThingerAPI.getInstance(this).getSensorHistory(currentRange,
                new ThingerAPI.ApiCallback<String>() {
                    @Override public void onSuccess(String json) {
                        cachedJson = json;
                        runOnUiThread(() -> renderChart(json));
                    }
                    @Override public void onFailure(String err) {
                        runOnUiThread(() -> Toast.makeText(HistoryActivity.this,
                                getString(R.string.error_slow_connection), Toast.LENGTH_SHORT).show());
                    }
                });
    }

    private void renderChart(String json) {
        try {
            JsonArray arr = JsonParser.parseString(json).getAsJsonArray();

            List<Entry> series1 = new ArrayList<>();
            List<Entry> series2 = new ArrayList<>();
            float sum1 = 0, min1 = Float.MAX_VALUE, max1 = Float.MIN_VALUE;
            int compliant = 0, breachCount = 0;

            for (int i = 0; i < arr.size(); i++) {
                JsonObject obj = arr.get(i).getAsJsonObject();
                float v1, v2;
                float threshold;

                switch (currentMetric) {
                    case 1: // Temperature
                        v1 = getFloat(obj, "temp_inlet");
                        v2 = getFloat(obj, "temp_outlet");
                        threshold = 30f;
                        break;
                    case 2: // Moisture
                        v1 = getFloat(obj, "moisture_5cm");
                        v2 = getFloat(obj, "moisture_10cm");
                        threshold = 50f;
                        break;
                    default: // Humidity
                        v1 = getFloat(obj, "humidity_inlet");
                        v2 = getFloat(obj, "humidity_outlet");
                        threshold = 85f;
                        break;
                }

                series1.add(new Entry(i, v1));
                series2.add(new Entry(i, v2));
                sum1 += v1;
                min1 = Math.min(min1, Math.min(v1, v2));
                max1 = Math.max(max1, Math.max(v1, v2));

                boolean ok = currentMetric == 1 ? v1 <= threshold : v1 >= threshold;
                if (ok) compliant++; else breachCount++;
            }

            int n = arr.size();
            float avg = n > 0 ? sum1 / n : 0;
            float compPct = n > 0 ? (compliant * 100f / n) : 0;

            // Update stat cards
            tvAvg.setText(String.format(Locale.US, "%.1f", avg));
            tvCompliance.setText(String.format(Locale.US, "%.0f%%", compPct));
            tvBreach.setText(String.valueOf(breachCount));
            tvRange.setText(n > 0 ? String.format(Locale.US, "%.1f – %.1f", min1, max1) : "—");

            // Build chart datasets
            String[] labels = {"Humidity", "Temperature", "Moisture"};
            String label = labels[currentMetric];

            LineDataSet ds1 = createDataSet(series1, label + " (Inlet)", CLR_INLET);
            LineDataSet ds2 = createDataSet(series2, label + " (Outlet)", CLR_OUTLET);

            chart.setData(new LineData(ds1, ds2));

            // Y-axis range and threshold line
            YAxis left = chart.getAxisLeft();
            left.removeAllLimitLines();
            float thresh;
            switch (currentMetric) {
                case 1:  left.setAxisMinimum(20); left.setAxisMaximum(40); thresh = 30f; break;
                case 2:  left.setAxisMinimum(0);  left.setAxisMaximum(100); thresh = 50f; break;
                default: left.setAxisMinimum(70); left.setAxisMaximum(100); thresh = 85f; break;
            }
            LimitLine ll = new LimitLine(thresh, "Threshold");
            ll.setLineColor(CLR_THRESH);
            ll.setLineWidth(1.5f);
            ll.enableDashedLine(10f, 8f, 0f);
            ll.setTextColor(CLR_THRESH);
            ll.setTextSize(10f);
            left.addLimitLine(ll);

            chart.invalidate();

        } catch (Exception e) {
            Toast.makeText(this, "Error parsing chart data", Toast.LENGTH_SHORT).show();
        }
    }

    private LineDataSet createDataSet(List<Entry> entries, String label, int color) {
        LineDataSet ds = new LineDataSet(entries, label);
        ds.setColor(color);
        ds.setCircleColor(color);
        ds.setCircleRadius(2f);
        ds.setLineWidth(2f);
        ds.setDrawValues(false);
        ds.setMode(LineDataSet.Mode.CUBIC_BEZIER);
        ds.setDrawFilled(true);
        ds.setFillColor(color);
        ds.setFillAlpha(30);
        return ds;
    }

    private float getFloat(JsonObject obj, String key) {
        JsonElement el = obj.get(key);
        return (el != null && !el.isJsonNull()) ? el.getAsFloat() : Float.NaN;
    }

    // ── CSV Export ───────────────────────────────────────────────────────

    private void setupExportButton() {
        MaterialButton btn = findViewById(R.id.btn_export_csv);
        btn.setOnClickListener(v -> exportCSV());
    }

    private void exportCSV() {
        if (cachedJson == null) {
            Toast.makeText(this, getString(R.string.error_export_failed), Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            JsonArray arr = JsonParser.parseString(cachedJson).getAsJsonArray();
            StringBuilder sb = new StringBuilder();
            sb.append("timestamp,humidity_inlet,humidity_outlet,temp_inlet,temp_outlet,moisture_5cm,moisture_10cm\n");
            for (JsonElement el : arr) {
                JsonObject o = el.getAsJsonObject();
                sb.append(String.format(Locale.US, "%s,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f\n",
                        o.has("ts") ? o.get("ts").getAsString() : "",
                        getFloat(o, "humidity_inlet"), getFloat(o, "humidity_outlet"),
                        getFloat(o, "temp_inlet"), getFloat(o, "temp_outlet"),
                        getFloat(o, "moisture_5cm"), getFloat(o, "moisture_10cm")));
            }

            String filename = "nursery_history_" + currentRange + ".csv";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                cv.put(MediaStore.Downloads.MIME_TYPE, "text/csv");
                cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (uri != null) {
                    try (OutputStream os = getContentResolver().openOutputStream(uri);
                         OutputStreamWriter w = new OutputStreamWriter(os)) {
                        w.write(sb.toString());
                    }
                }
            }
            Toast.makeText(this, "Exported to Downloads/" + filename, Toast.LENGTH_LONG).show();

        } catch (Exception e) {
            Toast.makeText(this, getString(R.string.error_export_failed), Toast.LENGTH_SHORT).show();
        }
    }

    // ── Bottom nav ──────────────────────────────────────────────────────

    private void setupBottomNav() {
        BottomNavigationView nav = findViewById(R.id.bottom_nav);
        nav.setSelectedItemId(R.id.nav_history);
        nav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_history) return true;
            if (id == R.id.nav_home) {
                startActivity(new Intent(this, DashboardActivity.class));
                overridePendingTransition(0, 0); finish(); return true;
            }
            if (id == R.id.nav_cert_log) {
                startActivity(new Intent(this, CertLogActivity.class));
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
