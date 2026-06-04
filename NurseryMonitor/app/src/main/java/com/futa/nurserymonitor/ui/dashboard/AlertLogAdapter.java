package com.futa.nurserymonitor.ui.dashboard;

import android.content.res.ColorStateList;
import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.futa.nurserymonitor.R;
import com.futa.nurserymonitor.models.EventLogEntry;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/**
 * AlertLogAdapter — RecyclerView adapter for the dashboard alert log.
 *
 * Displays the last 50 events in reverse-chronological order.
 * Each row:
 *   • Coloured dot: red (BREACH), amber (APPROACH), green (RESOLVED/other)
 *   • Plain-English event description
 *   • Hardware timestamp by default; tapping toggles to server timestamp
 *   • Tapping the row expands the full sensor values at event time
 */
public class AlertLogAdapter extends RecyclerView.Adapter<AlertLogAdapter.AlertViewHolder> {

    // Colours (hex → int)
    private static final int COLOR_BREACH   = Color.parseColor("#EF4444");
    private static final int COLOR_APPROACH = Color.parseColor("#F59E0B");
    private static final int COLOR_NOMINAL  = Color.parseColor("#22C55E");
    private static final int COLOR_INFO     = Color.parseColor("#2E75B6");

    private final List<EventLogEntry> items;

    // Tracks which row is expanded (-1 = none)
    private int expandedPosition = RecyclerView.NO_POSITION;

    // Display-format for the timestamps shown in the list
    private static final SimpleDateFormat SDF_DISPLAY;
    private static final SimpleDateFormat SDF_PARSE;

    static {
        SDF_PARSE = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
        SDF_PARSE.setTimeZone(TimeZone.getTimeZone("UTC"));
        SDF_DISPLAY = new SimpleDateFormat("HH:mm dd/MM", Locale.getDefault());
    }

    public AlertLogAdapter(List<EventLogEntry> items) {
        this.items = items;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ViewHolder
    // ──────────────────────────────────────────────────────────────────────────

    static class AlertViewHolder extends RecyclerView.ViewHolder {
        View viewDot;
        TextView tvDescription;
        TextView tvTimestamp;
        LinearLayout layoutExpanded;
        TextView tvHumInlet, tvHumOutlet;
        TextView tvTempInlet, tvTempOutlet;
        TextView tvMoisture5, tvMoisture10;
        TextView tvActuators;

        // Tracks whether this row is showing HW or server timestamp
        boolean showingServerTs = false;

        AlertViewHolder(@NonNull View itemView) {
            super(itemView);
            viewDot         = itemView.findViewById(R.id.view_dot);
            tvDescription   = itemView.findViewById(R.id.tv_event_description);
            tvTimestamp     = itemView.findViewById(R.id.tv_timestamp);
            layoutExpanded  = itemView.findViewById(R.id.layout_expanded_detail);
            tvHumInlet      = itemView.findViewById(R.id.tv_detail_hum_inlet);
            tvHumOutlet     = itemView.findViewById(R.id.tv_detail_hum_outlet);
            tvTempInlet     = itemView.findViewById(R.id.tv_detail_temp_inlet);
            tvTempOutlet    = itemView.findViewById(R.id.tv_detail_temp_outlet);
            tvMoisture5     = itemView.findViewById(R.id.tv_detail_moisture_5);
            tvMoisture10    = itemView.findViewById(R.id.tv_detail_moisture_10);
            tvActuators     = itemView.findViewById(R.id.tv_detail_actuators);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Adapter overrides
    // ──────────────────────────────────────────────────────────────────────────

    @NonNull
    @Override
    public AlertViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_alert_log, parent, false);
        return new AlertViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull AlertViewHolder holder, int position) {
        EventLogEntry entry = items.get(position);
        boolean isExpanded  = (position == expandedPosition);

        // ── Dot colour ───────────────────────────────────────────────────────
        int dotColor;
        switch (entry.getParsedEventType()) {
            case BREACH:      dotColor = COLOR_BREACH;   break;
            case APPROACH:    dotColor = COLOR_APPROACH; break;
            case RESOLVED:    dotColor = COLOR_NOMINAL;  break;
            default:          dotColor = COLOR_INFO;     break;
        }
        holder.viewDot.setBackgroundTintList(ColorStateList.valueOf(dotColor));

        // ── Description ──────────────────────────────────────────────────────
        holder.tvDescription.setText(buildDescription(entry));

        // ── Timestamp — HW by default ────────────────────────────────────────
        holder.showingServerTs = false;
        holder.tvTimestamp.setText(formatTimestamp(entry.getTimestampHw()));

        // Tap timestamp → toggle HW / server
        holder.tvTimestamp.setOnClickListener(v -> {
            holder.showingServerTs = !holder.showingServerTs;
            holder.tvTimestamp.setText(holder.showingServerTs
                    ? formatTimestamp(entry.getTimestampServer())
                    : formatTimestamp(entry.getTimestampHw()));
        });

        // ── Expand / collapse on row tap ──────────────────────────────────────
        holder.layoutExpanded.setVisibility(isExpanded ? View.VISIBLE : View.GONE);

        holder.itemView.setOnClickListener(v -> {
            int previousExpanded = expandedPosition;
            expandedPosition = isExpanded ? RecyclerView.NO_POSITION : position;
            if (previousExpanded != RecyclerView.NO_POSITION) {
                notifyItemChanged(previousExpanded);
            }
            notifyItemChanged(position);
        });

        // ── Expanded detail ───────────────────────────────────────────────────
        if (isExpanded) {
            holder.tvHumInlet.setText(String.format(Locale.US,
                    "Hum In: %.1f %%RH", entry.getHumidityInlet()));
            holder.tvHumOutlet.setText(String.format(Locale.US,
                    "Hum Out: %.1f %%RH", entry.getHumidityOutlet()));
            holder.tvTempInlet.setText(String.format(Locale.US,
                    "Temp In: %.1f °C", entry.getTempInlet()));
            holder.tvTempOutlet.setText(String.format(Locale.US,
                    "Temp Out: %.1f °C", entry.getTempOutlet()));
            holder.tvMoisture5.setText(String.format(Locale.US,
                    "Soil 5 cm: %.1f %%VWC", entry.getMoisture5cm()));
            holder.tvMoisture10.setText(String.format(Locale.US,
                    "Soil 10 cm: %.1f %%VWC", entry.getMoisture10cm()));
            holder.tvActuators.setText(String.format(Locale.US,
                    "Pump: %s | Fan: %s%s",
                    entry.isPumpState() ? "ON" : "OFF",
                    entry.isFanState()  ? "ON" : "OFF",
                    entry.isSmsSent()   ? " | SMS ✓" : ""));
        }
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Public update method — called from DashboardActivity after poll
    // ──────────────────────────────────────────────────────────────────────────

    public void updateData(List<EventLogEntry> newItems) {
        items.clear();
        items.addAll(newItems);
        notifyDataSetChanged();
    }

    public void prependEntry(EventLogEntry entry) {
        items.add(0, entry);
        if (items.size() > 50) items.remove(items.size() - 1);
        notifyItemInserted(0);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Builds a plain-English description string from the event type
     * and the sensor context.
     */
    private String buildDescription(EventLogEntry e) {
        switch (e.getParsedEventType()) {
            case BREACH:
                return String.format(Locale.US,
                        "Breach detected — Hum: %.0f%%RH / Temp: %.0f°C",
                        Math.min(e.getHumidityInlet(), e.getHumidityOutlet()),
                        Math.max(e.getTempInlet(), e.getTempOutlet()));
            case APPROACH:
                return String.format(Locale.US,
                        "Warning — values approaching threshold",
                        e.getHumidityInlet());
            case RESOLVED:
                return "All conditions returned to NOMINAL — actuation stopped";
            case ACTUATOR_ON:
                return String.format("Actuator ON — Pump: %s | Fan: %s",
                        e.isPumpState() ? "ON" : "OFF",
                        e.isFanState()  ? "ON" : "OFF");
            case ACTUATOR_OFF:
                return String.format("Actuator OFF — Pump: %s | Fan: %s",
                        e.isPumpState() ? "ON" : "OFF",
                        e.isFanState()  ? "ON" : "OFF");
            default:
                return "System event";
        }
    }

    /** Formats an ISO 8601 timestamp for compact list display (HH:mm dd/MM). */
    private String formatTimestamp(String iso) {
        if (iso == null || iso.isEmpty()) return "—";
        try {
            Date d = SDF_PARSE.parse(iso);
            return d != null ? SDF_DISPLAY.format(d) : iso;
        } catch (ParseException e) {
            return iso;
        }
    }
}
