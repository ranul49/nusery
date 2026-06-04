package com.futa.nurserymonitor.models;

import com.google.gson.annotations.SerializedName;

/**
 * EventLogEntry — one row from the Thinger.io actuation_events data bucket.
 *
 * Maps via Gson from:
 *   GET /v1/users/{user}/buckets/actuation_events/data
 *
 * The tamper_flag is computed client-side: if |timestamp_hw − timestamp_server|
 * exceeds 60 seconds the row is flagged as potentially tampered.
 */
public class EventLogEntry {

    @SerializedName("event_id")
    private String eventId;                // UUID string

    @SerializedName("node_id")
    private String nodeId;                 // e.g. "tunnel_01"

    /** Hardware (DS1307 RTC) timestamp — ISO 8601 */
    @SerializedName("timestamp_hw")
    private String timestampHw;

    /** Server-assigned timestamp from Thinger.io — ISO 8601 */
    @SerializedName("timestamp_server")
    private String timestampServer;

    /**
     * Event classification:
     * BREACH | APPROACH | RESOLVED | ACTUATOR_ON | ACTUATOR_OFF
     */
    @SerializedName("event_type")
    private String eventType;

    @SerializedName("humidity_inlet")
    private float humidityInlet;

    @SerializedName("humidity_outlet")
    private float humidityOutlet;

    @SerializedName("temp_inlet")
    private float tempInlet;

    @SerializedName("temp_outlet")
    private float tempOutlet;

    @SerializedName("moisture_5cm")
    private float moisture5cm;

    @SerializedName("moisture_10cm")
    private float moisture10cm;

    @SerializedName("pump_state")
    private boolean pumpState;

    @SerializedName("fan_state")
    private boolean fanState;

    /** True = the SIM800L successfully dispatched an SMS for this event */
    @SerializedName("sms_sent")
    private boolean smsSent;

    /**
     * Computed locally after parsing:
     * True when |timestamp_hw epoch – timestamp_server epoch| > 60 seconds.
     * NOT serialised — set by ThingerAPI after parsing the JSON.
     */
    private boolean tamperFlag;

    // ──────────────────────────────────────────────────────────────────────────
    // Event type enum for type-safe UI comparisons
    // ──────────────────────────────────────────────────────────────────────────
    public enum EventType {
        BREACH, APPROACH, RESOLVED, ACTUATOR_ON, ACTUATOR_OFF, UNKNOWN
    }

    public EventType getParsedEventType() {
        if (eventType == null) return EventType.UNKNOWN;
        switch (eventType.toUpperCase()) {
            case "BREACH":       return EventType.BREACH;
            case "APPROACH":     return EventType.APPROACH;
            case "RESOLVED":     return EventType.RESOLVED;
            case "ACTUATOR_ON":  return EventType.ACTUATOR_ON;
            case "ACTUATOR_OFF": return EventType.ACTUATOR_OFF;
            default:             return EventType.UNKNOWN;
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Getters
    // ──────────────────────────────────────────────────────────────────────────

    public String getEventId()       { return eventId; }
    public String getNodeId()        { return nodeId; }
    public String getTimestampHw()   { return timestampHw; }
    public String getTimestampServer(){ return timestampServer; }
    public String getEventType()     { return eventType; }
    public float getHumidityInlet()  { return humidityInlet; }
    public float getHumidityOutlet() { return humidityOutlet; }
    public float getTempInlet()      { return tempInlet; }
    public float getTempOutlet()     { return tempOutlet; }
    public float getMoisture5cm()    { return moisture5cm; }
    public float getMoisture10cm()   { return moisture10cm; }
    public boolean isPumpState()     { return pumpState; }
    public boolean isFanState()      { return fanState; }
    public boolean isSmsSent()       { return smsSent; }
    public boolean isTamperFlag()    { return tamperFlag; }

    // ──────────────────────────────────────────────────────────────────────────
    // Setters — used by ThingerAPI (tamperFlag) and DashboardActivity (manual entries)
    // ──────────────────────────────────────────────────────────────────────────

    public void setEventId(String v)        { this.eventId = v; }
    public void setNodeId(String v)         { this.nodeId = v; }
    public void setTimestampHw(String v)    { this.timestampHw = v; }
    public void setTimestampServer(String v){ this.timestampServer = v; }
    public void setEventType(String v)      { this.eventType = v; }
    public void setHumidityInlet(float v)   { this.humidityInlet = v; }
    public void setHumidityOutlet(float v)  { this.humidityOutlet = v; }
    public void setTempInlet(float v)       { this.tempInlet = v; }
    public void setTempOutlet(float v)      { this.tempOutlet = v; }
    public void setMoisture5cm(float v)     { this.moisture5cm = v; }
    public void setMoisture10cm(float v)    { this.moisture10cm = v; }
    public void setPumpState(boolean v)     { this.pumpState = v; }
    public void setFanState(boolean v)      { this.fanState = v; }
    public void setSmsSent(boolean v)       { this.smsSent = v; }
    public void setTamperFlag(boolean v)    { this.tamperFlag = v; }
}
