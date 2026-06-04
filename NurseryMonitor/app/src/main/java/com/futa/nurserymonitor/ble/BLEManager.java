package com.futa.nurserymonitor.ble;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.Build;
import android.os.ParcelUuid;
import android.util.Log;

import com.futa.nurserymonitor.models.SensorSnapshot;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * BLEManager — offline fallback data source.
 *
 * When the app detects no Wi-Fi / mobile data it starts a BLE scan
 * for the ESP32 advertisement that carries compressed EWMA sensor values.
 *
 * ─── Advertisement payload layout (18 bytes manufacturer data) ───────────────
 *  [0-1]  uint16 : tunnel_status  (0=NOMINAL, 1=APPROACH, 2=BREACH)
 *  [2-5]  float32: humidity_ewma  (%RH)
 *  [6-9]  float32: temperature_ewma (°C)
 *  [10-13]float32: moisture_ewma  (%VWC, average of 5 cm + 10 cm)
 *  [14-15]uint16 : pump_state (1=ON) | fan_state (1=ON) packed as bits
 *  [16-17]uint16 : reserved
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The service UUID below must match the UUID advertised by the ESP32 BLE
 * firmware (defined in cassava_nursery_firmware.ino).
 */
public class BLEManager {

    private static final String TAG = "BLEManager";

    /** Must match ESP32 BLE_SERVICE_UUID in firmware */
    public static final UUID NODE_SERVICE_UUID =
            UUID.fromString("12345678-1234-1234-1234-1234567890ab");

    /** Manufacturer ID registered in the ESP32 advertisement (arbitrary, match firmware) */
    private static final int MANUFACTURER_ID = 0x05A7;

    private final Context context;
    private BluetoothLeScanner scanner;
    private boolean scanning = false;

    /** Latest RSSI from the advertisement (-100 = unknown) */
    private int lastRssi = -100;

    /** Callback set by the owning Activity/Fragment */
    private BLEDataCallback dataCallback;

    // ──────────────────────────────────────────────────────────────────────────
    // Callback interface
    // ──────────────────────────────────────────────────────────────────────────

    public interface BLEDataCallback {
        /** Called on each successfully parsed advertisement (OkHttp thread equivalent). */
        void onSnapshotReceived(SensorSnapshot snapshot, int rssi);
        /** Called when BLE scanning fails or permission is denied. */
        void onBLEError(String message);
    }

    public BLEManager(Context context) {
        this.context = context.getApplicationContext();
    }

    public void setDataCallback(BLEDataCallback cb) {
        this.dataCallback = cb;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Start scan
    // ──────────────────────────────────────────────────────────────────────────

    public void startScan() {
        if (scanning) return;

        BluetoothManager bm = (BluetoothManager)
                context.getSystemService(Context.BLUETOOTH_SERVICE);
        if (bm == null) {
            notifyError("Bluetooth not available on this device");
            return;
        }

        BluetoothAdapter adapter = bm.getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            notifyError("Bluetooth is disabled");
            return;
        }

        scanner = adapter.getBluetoothLeScanner();
        if (scanner == null) {
            notifyError("BLE scanner not available");
            return;
        }

        // Filter on the node's service UUID so we only see ESP32 advertisements
        List<ScanFilter> filters = new ArrayList<>();
        filters.add(new ScanFilter.Builder()
                .setServiceUuid(new ParcelUuid(NODE_SERVICE_UUID))
                .build());

        ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build();

        try {
            scanner.startScan(filters, settings, leScanCallback);
            scanning = true;
            Log.i(TAG, "BLE scan started — listening for ESP32 advertisements");
        } catch (SecurityException e) {
            // API 31+ requires BLUETOOTH_SCAN permission
            notifyError("BLE scan permission denied: " + e.getMessage());
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Stop scan
    // ──────────────────────────────────────────────────────────────────────────

    public void stopScan() {
        if (!scanning || scanner == null) return;
        try {
            scanner.stopScan(leScanCallback);
        } catch (SecurityException e) {
            Log.w(TAG, "stopScan permission error: " + e.getMessage());
        }
        scanning = false;
        Log.i(TAG, "BLE scan stopped");
    }

    public boolean isScanning() { return scanning; }

    /** RSSI → 1–3 bar signal strength for UI */
    public int getSignalBars() {
        if (lastRssi >= -60) return 3;
        if (lastRssi >= -80) return 2;
        return 1;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ScanCallback
    // ──────────────────────────────────────────────────────────────────────────

    private final ScanCallback leScanCallback = new ScanCallback() {

        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            lastRssi = result.getRssi();
            ScanRecord record = result.getScanRecord();
            if (record == null) return;

            byte[] mfr = record.getManufacturerSpecificData(MANUFACTURER_ID);
            if (mfr == null || mfr.length < 16) {
                Log.d(TAG, "Advertisement found but manufacturer data too short");
                return;
            }

            SensorSnapshot snap = parsePayload(mfr);
            if (snap != null && dataCallback != null) {
                dataCallback.onSnapshotReceived(snap, lastRssi);
            }
        }

        @Override
        public void onScanFailed(int errorCode) {
            scanning = false;
            notifyError("BLE scan failed with code " + errorCode);
        }
    };

    // ──────────────────────────────────────────────────────────────────────────
    // Payload parser
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Parses the 18-byte manufacturer-specific advertisement payload
     * and constructs a SensorSnapshot with EWMA values.
     */
    private SensorSnapshot parsePayload(byte[] data) {
        try {
            ByteBuffer buf = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);

            int statusCode = buf.getShort() & 0xFFFF;     // [0-1]
            float humEwma  = buf.getFloat();               // [2-5]
            float tempEwma = buf.getFloat();               // [6-9]
            float moistEwma= buf.getFloat();               // [10-13]
            int flags      = buf.getShort() & 0xFFFF;      // [14-15]

            boolean pumpOn = (flags & 0x01) != 0;
            boolean fanOn  = (flags & 0x02) != 0;

            String status;
            switch (statusCode) {
                case 1:  status = "APPROACH"; break;
                case 2:  status = "BREACH";   break;
                default: status = "NOMINAL";  break;
            }

            SensorSnapshot snap = new SensorSnapshot();
            // BLE advertisement carries EWMA averages — duplicate to inlet/outlet
            snap.setHumidityInlet(humEwma);
            snap.setHumidityOutlet(humEwma);
            snap.setTempInlet(tempEwma);
            snap.setTempOutlet(tempEwma);
            snap.setMoisture5cm(moistEwma);
            snap.setMoisture10cm(moistEwma);
            snap.setPumpState(pumpOn);
            snap.setFanState(fanOn);
            snap.setSystemStatus(status);
            snap.setLastUpdated("BLE");   // indicator that this is a BLE-sourced value

            return snap;
        } catch (Exception e) {
            Log.e(TAG, "Failed to parse BLE payload", e);
            return null;
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ──────────────────────────────────────────────────────────────────────────

    private void notifyError(String msg) {
        Log.e(TAG, msg);
        if (dataCallback != null) dataCallback.onBLEError(msg);
    }
}
