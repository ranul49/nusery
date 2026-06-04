package com.futa.nurserymonitor.models;

import com.google.gson.annotations.SerializedName;

/**
 * SensorSnapshot — live sensor data polled every 5 seconds from
 * GET /v1/users/{user}/devices/{device}/
 *
 * Maps directly from the Thinger.io JSON response via Gson.
 */
public class SensorSnapshot {

    /** Humidity at the tunnel inlet from DHT22 sensor 1 (%RH) */
    @SerializedName("humidity_inlet")
    private float humidityInlet;

    /** Humidity at the tunnel outlet from DHT22 sensor 2 (%RH) */
    @SerializedName("humidity_outlet")
    private float humidityOutlet;

    /** Temperature at the tunnel inlet (°C) */
    @SerializedName("temp_inlet")
    private float tempInlet;

    /** Temperature at the tunnel outlet (°C) */
    @SerializedName("temp_outlet")
    private float tempOutlet;

    /** Soil volumetric water content at 5 cm depth (%VWC) */
    @SerializedName("moisture_5cm")
    private float moisture5cm;

    /** Soil volumetric water content at 10 cm depth (%VWC) */
    @SerializedName("moisture_10cm")
    private float moisture10cm;

    /** True = misting pump relay is energised */
    @SerializedName("pump_state")
    private boolean pumpState;

    /** True = cooling fan relay is energised */
    @SerializedName("fan_state")
    private boolean fanState;

    /**
     * Overall system status determined by ESP32 firmware:
     * NOMINAL  – all values within thresholds
     * APPROACH – any value within 5 % of threshold
     * BREACH   – any value has crossed the threshold
     */
    @SerializedName("system_status")
    private String systemStatus;   // "NOMINAL" | "APPROACH" | "BREACH"

    /** ISO 8601 timestamp of the last successful sensor read (DS1307 RTC) */
    @SerializedName("last_updated")
    private String lastUpdated;

    // ──────────────────────────────────────────────────────────────────────────
    // Helper enum for type-safe status comparisons in UI layer
    // ──────────────────────────────────────────────────────────────────────────
    public enum Status {
        NOMINAL, APPROACH, BREACH, UNKNOWN
    }

    /**
     * Returns the parsed Status enum from the raw string field.
     * Falls back to UNKNOWN if the string is null or unrecognised.
     */
    public Status getParsedStatus() {
        if (systemStatus == null) return Status.UNKNOWN;
        switch (systemStatus.toUpperCase()) {
            case "NOMINAL":  return Status.NOMINAL;
            case "APPROACH": return Status.APPROACH;
            case "BREACH":   return Status.BREACH;
            default:         return Status.UNKNOWN;
        }
    }

    /**
     * Returns true if any float sensor field is NaN (DHT22 checksum failure
     * or capacitive probe open-circuit).
     */
    public boolean hasSensorError() {
        return Float.isNaN(humidityInlet)
                || Float.isNaN(humidityOutlet)
                || Float.isNaN(tempInlet)
                || Float.isNaN(tempOutlet)
                || Float.isNaN(moisture5cm)
                || Float.isNaN(moisture10cm);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Getters
    // ──────────────────────────────────────────────────────────────────────────

    public float getHumidityInlet()  { return humidityInlet; }
    public float getHumidityOutlet() { return humidityOutlet; }
    public float getTempInlet()      { return tempInlet; }
    public float getTempOutlet()     { return tempOutlet; }
    public float getMoisture5cm()    { return moisture5cm; }
    public float getMoisture10cm()   { return moisture10cm; }
    public boolean isPumpState()     { return pumpState; }
    public boolean isFanState()      { return fanState; }
    public String getSystemStatus()  { return systemStatus; }
    public String getLastUpdated()   { return lastUpdated; }

    // ──────────────────────────────────────────────────────────────────────────
    // Setters (used by BLEManager to construct a snapshot from advertisement)
    // ──────────────────────────────────────────────────────────────────────────

    public void setHumidityInlet(float v)   { this.humidityInlet = v; }
    public void setHumidityOutlet(float v)  { this.humidityOutlet = v; }
    public void setTempInlet(float v)       { this.tempInlet = v; }
    public void setTempOutlet(float v)      { this.tempOutlet = v; }
    public void setMoisture5cm(float v)     { this.moisture5cm = v; }
    public void setMoisture10cm(float v)    { this.moisture10cm = v; }
    public void setPumpState(boolean v)     { this.pumpState = v; }
    public void setFanState(boolean v)      { this.fanState = v; }
    public void setSystemStatus(String v)   { this.systemStatus = v; }
    public void setLastUpdated(String v)    { this.lastUpdated = v; }
}
