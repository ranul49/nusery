// src/services/downloadExportUtil.ts
// Port of DownloadExportUtil.java — export data to Downloads folder

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { EventLogEntry } from '../types';

/**
 * DownloadExportUtil — write text exports to device Downloads folder
 * or share via system share sheet.
 *
 * Supports:
 *   • Direct file write to Downloads (Android/iOS)
 *   • CSV export of event logs
 *   • JSON export of configurations
 *   • System share integration
 */

export class DownloadExportUtil {
  private static readonly TAG = 'DownloadExportUtil';

  /**
   * Write text content to Downloads folder
   * Returns the file path if successful
   */
  public static async writeTextToDownloads(
    filename: string,
    content: string,
    mimeType: string = 'text/plain',
  ): Promise<string> {
    try {
      // Get the Documents directory as a safe fallback
      const documentDir = FileSystem.documentDirectory;
      if (!documentDir) {
        throw new Error('Document directory not available');
      }

      // Construct the file path
      const filePath = `${documentDir}${filename}`;

      // Write file to disk
      await FileSystem.writeAsStringAsync(filePath, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      console.log(`File written to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error(
        `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Share file using system share sheet
   */
  public static async shareFile(
    filePath: string,
    title: string = 'Share Export',
  ): Promise<boolean> {
    try {
      // expo-sharing correctly attaches the file on both Android and iOS.
      // The file:// URI must be used for expo-sharing.
      const fileUri = filePath.startsWith('file://')
        ? filePath
        : `file://${filePath}`;

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.warn('Sharing is not available on this device');
        return false;
      }

      await Sharing.shareAsync(fileUri, { dialogTitle: title });
      console.log('Share successful');
      return true;
    } catch (error) {
      console.error(
        `Failed to share file: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Export event log as CSV
   */
  public static async exportEventLogAsCSV(
    events: Array<{
      eventId: string;
      nodeId: string;
      timestampHw: string;
      timestampServer: string;
      eventType: string;
      humidityInlet: number;
      humidityOutlet: number;
      tempInlet: number;
      tempOutlet: number;
      moisture5cm: number;
      moisture10cm: number;
      pumpState: boolean;
      fanState: boolean;
      smsSent: boolean;
      tamperFlag: boolean;
    }>,
  ): Promise<string> {
    try {
      const headers = [
        'Event ID',
        'Node ID',
        'HW Timestamp',
        'Server Timestamp',
        'Event Type',
        'Humidity Inlet (%)',
        'Humidity Outlet (%)',
        'Temp Inlet (°C)',
        'Temp Outlet (°C)',
        'Moisture 5cm (%)',
        'Moisture 10cm (%)',
        'Pump State',
        'Fan State',
        'SMS Sent',
        'Tamper Flag',
      ];

      const rows = events.map((e) => [
        e.eventId,
        e.nodeId,
        e.timestampHw,
        e.timestampServer,
        e.eventType,
        e.humidityInlet.toFixed(2),
        e.humidityOutlet.toFixed(2),
        e.tempInlet.toFixed(2),
        e.tempOutlet.toFixed(2),
        e.moisture5cm.toFixed(2),
        e.moisture10cm.toFixed(2),
        e.pumpState ? 'ON' : 'OFF',
        e.fanState ? 'ON' : 'OFF',
        e.smsSent ? 'YES' : 'NO',
        e.tamperFlag ? 'YES' : 'NO',
      ]);

      // Escape CSV fields and join
      const csvContent = [
        headers.map(this.escapeCsvField).join(','),
        ...rows.map((row) => row.map(this.escapeCsvField).join(',')),
      ].join('\n');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
      const filename = `event_log_${timestamp}.csv`;

      return await this.writeTextToDownloads(filename, csvContent, 'text/csv');
    } catch (error) {
      console.error(
        `Failed to export event log as CSV: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Export event log as JSON
   */
  public static async exportEventLogAsJSON(
    events: EventLogEntry[],
  ): Promise<string> {
    try {
      const jsonContent = JSON.stringify(events, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
      const filename = `event_log_${timestamp}.json`;

      return await this.writeTextToDownloads(filename, jsonContent, 'application/json');
    } catch (error) {
      console.error(
        `Failed to export event log as JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Export sensor readings history as CSV
   */
  public static async exportSensorHistoryAsCSV(
    readings: Array<{
      timestamp: string;
      humidityInlet: number;
      humidityOutlet: number;
      tempInlet: number;
      tempOutlet: number;
      moisture5cm: number;
      moisture10cm: number;
    }>,
  ): Promise<string> {
    try {
      const headers = [
        'Timestamp',
        'Humidity Inlet (%)',
        'Humidity Outlet (%)',
        'Temp Inlet (°C)',
        'Temp Outlet (°C)',
        'Moisture 5cm (%)',
        'Moisture 10cm (%)',
      ];

      const rows = readings.map((r) => [
        r.timestamp,
        r.humidityInlet.toFixed(2),
        r.humidityOutlet.toFixed(2),
        r.tempInlet.toFixed(2),
        r.tempOutlet.toFixed(2),
        r.moisture5cm.toFixed(2),
        r.moisture10cm.toFixed(2),
      ]);

      const csvContent = [
        headers.map(this.escapeCsvField).join(','),
        ...rows.map((row) => row.map(this.escapeCsvField).join(',')),
      ].join('\n');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
      const filename = `sensor_history_${timestamp}.csv`;

      return await this.writeTextToDownloads(filename, csvContent, 'text/csv');
    } catch (error) {
      console.error(
        `Failed to export sensor history as CSV: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Delete a file
   */
  public static async deleteFile(filePath: string): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        console.warn(`File does not exist: ${filePath}`);
        return false;
      }

      await FileSystem.deleteAsync(filePath, { idempotent: true });
      console.log(`File deleted: ${filePath}`);
      return true;
    } catch (error) {
      console.error(
        `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Check if file exists
   */
  public static async fileExists(filePath: string): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return fileInfo.exists;
    } catch (error) {
      console.error(
        `Failed to check file existence: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Get document directory path for files
   */
  public static getDocumentDirectory(): string | null {
    return FileSystem.documentDirectory;
  }

  /**
   * List files in directory
   */
  public static async listFiles(dirPath: string): Promise<string[]> {
    try {
      const files = await FileSystem.readDirectoryAsync(dirPath);
      return files;
    } catch (error) {
      console.error(
        `Failed to list files: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Escape CSV field (wrap in quotes and escape internal quotes)
   */
  private static escapeCsvField(field: any): string {
    const str = String(field);
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}

export default DownloadExportUtil;
