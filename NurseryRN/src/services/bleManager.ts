// src/services/bleManager.ts
// Port of BLEManager.java — offline fallback data source via BLE advertisement

import { BleManager, Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { SensorSnapshot } from '../types';

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
 */

export interface BLEDataCallback {
  /** Called on each successfully parsed advertisement */
  onSnapshotReceived(snapshot: SensorSnapshot, rssi: number): void;
  /** Called when BLE scanning fails or permission is denied */
  onBLEError(message: string): void;
}

export class BLEManagerImpl {
  private static readonly TAG = 'BLEManager';

  /** Must match ESP32 BLE_SERVICE_UUID in firmware */
  private static readonly NODE_SERVICE_UUID = '12345678-1234-1234-1234-1234567890ab';

  /** Manufacturer ID registered in the ESP32 advertisement (match firmware) */
  private static readonly MANUFACTURER_ID = 0x05a7;

  private manager: BleManager;
  private scanning = false;
  private lastRssi = -100;
  private dataCallback: BLEDataCallback | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  /**
   * Set the callback for BLE events
   */
  public setDataCallback(callback: BLEDataCallback | null): void {
    this.dataCallback = callback;
  }

  /**
   * Start BLE scan for ESP32 advertisements
   */
  public async startScan(): Promise<void> {
    if (this.scanning) {
      return;
    }

    try {
      // Check if Bluetooth is available and enabled
      const state = await this.manager.state();
      if (state !== 'PoweredOn') {
        this.notifyError('Bluetooth is not powered on');
        return;
      }

      // Start scanning with service UUID filter
      this.manager.startDeviceScan(
        [BLEManagerImpl.NODE_SERVICE_UUID],
        { allowDuplicates: true },
        (error, device) => {
          if (error) {
            this.stopScan(); // reset scanning flag before notifying
            this.notifyError(`BLE scan error: ${error.message}`);
            return;
          }

          if (device) {
            this.lastRssi = device.rssi ?? -100;
            this.handleAdvertisement(device);
          }
        },
      );

      this.scanning = true;
      console.log('BLE scan started — listening for ESP32 advertisements');
    } catch (error) {
      this.notifyError(`Failed to start BLE scan: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stop BLE scan
   */
  public stopScan(): void {
    if (!this.scanning) {
      return;
    }

    this.manager.stopDeviceScan();
    this.scanning = false;
    console.log('BLE scan stopped');
  }

  /**
   * Check if currently scanning
   */
  public isScanning(): boolean {
    return this.scanning;
  }

  /**
   * Convert RSSI to signal bar strength (1-3)
   */
  public getSignalBars(): number {
    if (this.lastRssi >= -60) return 3;
    if (this.lastRssi >= -80) return 2;
    return 1;
  }

  /**
   * Handle incoming BLE advertisement
   */
  private handleAdvertisement(device: Device): void {
    if (!device.manufacturerData) {
      return;
    }

    // Manufacturer data is typically a base64-encoded string in react-native-ble-plx
    const mfrData = this.decodeManufacturerData(device.manufacturerData);
    if (!mfrData || mfrData.length < 18) {
      console.debug('Advertisement found but manufacturer data too short');
      return;
    }

    const snapshot = this.parsePayload(mfrData);
    if (snapshot && this.dataCallback) {
      this.dataCallback.onSnapshotReceived(snapshot, this.lastRssi);
    }
  }

  /**
   * Decode manufacturer data (base64 string to byte array)
   */
  private decodeManufacturerData(manufacturerDataStr: string): Buffer | null {
    try {
      // Handle both hex string and base64 formats
      if (manufacturerDataStr.startsWith('0x')) {
        // Hex string format
        const hex = manufacturerDataStr.slice(2);
        return Buffer.from(hex, 'hex');
      }
      // Assume base64
      return Buffer.from(manufacturerDataStr, 'base64');
    } catch (error) {
      console.warn(`Failed to decode manufacturer data: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Parse the 18-byte manufacturer-specific advertisement payload
   * and construct a SensorSnapshot with EWMA values.
   */
  private parsePayload(data: Buffer): SensorSnapshot | null {
    try {
      if (data.length < 18) {
        return null;
      }

      // Read little-endian format
      const statusCode = data.readUInt16LE(0);      // [0-1]
      const humEwma = data.readFloatLE(2);          // [2-5]
      const tempEwma = data.readFloatLE(6);         // [6-9]
      const moistEwma = data.readFloatLE(10);       // [10-13]
      const flags = data.readUInt16LE(14);          // [14-15]

      const pumpOn = (flags & 0x01) !== 0;
      const fanOn = (flags & 0x02) !== 0;

      let status: 'NOMINAL' | 'APPROACH' | 'BREACH' = 'NOMINAL';
      switch (statusCode) {
        case 1:
          status = 'APPROACH';
          break;
        case 2:
          status = 'BREACH';
          break;
        default:
          status = 'NOMINAL';
          break;
      }

      const snapshot: SensorSnapshot = {
        // BLE advertisement carries EWMA averages — duplicate to inlet/outlet
        humidityInlet: humEwma,
        humidityOutlet: humEwma,
        tempInlet: tempEwma,
        tempOutlet: tempEwma,
        moisture5cm: moistEwma,
        moisture10cm: moistEwma,
        pumpState: pumpOn,
        fanState: fanOn,
        systemStatus: status,
        lastUpdated: 'BLE', // indicator that this is a BLE-sourced value
      };

      return snapshot;
    } catch (error) {
      console.error(`Failed to parse BLE payload: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Internal helper to notify error
   */
  private notifyError(message: string): void {
    console.error(`[${BLEManagerImpl.TAG}] ${message}`);
    if (this.dataCallback) {
      this.dataCallback.onBLEError(message);
    }
  }

  /**
   * Cleanup when done
   */
  public destroy(): void {
    this.stopScan();
    this.manager.destroy();
  }
}

// Singleton instance
let bleManagerInstance: BLEManagerImpl | null = null;

export function getBLEManager(): BLEManagerImpl {
  if (!bleManagerInstance) {
    bleManagerInstance = new BLEManagerImpl();
  }
  return bleManagerInstance;
}

export function destroyBLEManager(): void {
  if (bleManagerInstance) {
    bleManagerInstance.destroy();
    bleManagerInstance = null;
  }
}
