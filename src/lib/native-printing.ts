/**
 * Native Printing Service for Capacitor (Android/iOS)
 * 
 * This module provides native thermal printer support for the Android app.
 * It bridges between the web app and native Bluetooth/USB printer capabilities.
 * 
 * For Android:
 * - Uses Android's BluetoothSocket for direct printer communication
 * - Supports USB Host API for USB printers
 * - Network printing via TCP sockets
 * 
 * SETUP INSTRUCTIONS FOR ANDROID:
 * 
 * 1. Add these permissions to android/app/src/main/AndroidManifest.xml:
 * 
 *    <uses-permission android:name="android.permission.BLUETOOTH" />
 *    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
 *    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
 *    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
 *    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
 *    <uses-permission android:name="android.permission.INTERNET" />
 *    <uses-feature android:name="android.hardware.usb.host" android:required="false" />
 * 
 * 2. For USB printers, add to AndroidManifest.xml inside <activity>:
 * 
 *    <intent-filter>
 *      <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />
 *    </intent-filter>
 *    <meta-data android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"
 *      android:resource="@xml/device_filter" />
 * 
 * 3. Create android/app/src/main/res/xml/device_filter.xml:
 * 
 *    <?xml version="1.0" encoding="utf-8"?>
 *    <resources>
 *      <!-- XPrinter -->
 *      <usb-device vendor-id="1046" />
 *      <!-- Epson -->
 *      <usb-device vendor-id="1208" />
 *      <!-- Generic thermal printers -->
 *      <usb-device class="7" />
 *    </resources>
 * 
 * RECOMMENDED CAPACITOR PLUGINS:
 * 
 * For production Android printing, install one of these community plugins:
 * 
 * Option 1: @nicephoneme/cordova-plugin-thermal-printer (works with Capacitor)
 *   npm install @nicephoneme/cordova-plugin-thermal-printer
 *   npx cap sync android
 * 
 * Option 2: capacitor-thermal-printer
 *   npm install capacitor-thermal-printer
 *   npx cap sync android
 * 
 * After installing, rebuild the Android app:
 *   npx cap sync android
 *   npx cap open android (to build in Android Studio)
 */

import { isNativeApp } from './escpos';

// Types for native printer plugins
export interface NativePrinter {
  name: string;
  address: string; // MAC address for Bluetooth, IP for network
  type: 'bluetooth' | 'usb' | 'network';
  connected?: boolean;
}

export interface NativePrintResult {
  success: boolean;
  error?: string;
}

// Check if we're running in Capacitor
export const isCapacitorAvailable = (): boolean => {
  return typeof (window as any).Capacitor !== 'undefined';
};

// Check if native Bluetooth printing plugin is available
export const isNativeBluetoothPrintAvailable = (): boolean => {
  const win = window as any;
  return !!(
    win.BluetoothPrinter || 
    win.ThermalPrinter ||
    win.cordova?.plugins?.ThermalPrinter
  );
};

/**
 * Discover Bluetooth printers using native Android APIs
 * Requires Bluetooth permissions to be granted
 */
export const discoverBluetoothPrinters = async (): Promise<NativePrinter[]> => {
  const win = window as any;
  
  // Try different plugin APIs
  if (win.ThermalPrinter) {
    return new Promise((resolve, reject) => {
      win.ThermalPrinter.listPrinters(
        { type: 'bluetooth' },
        (printers: any[]) => {
          resolve(printers.map(p => ({
            name: p.name || p.deviceName || 'Unknown Printer',
            address: p.address || p.macAddress,
            type: 'bluetooth' as const,
          })));
        },
        (error: string) => reject(new Error(error))
      );
    });
  }
  
  if (win.BluetoothPrinter) {
    return new Promise((resolve, reject) => {
      win.BluetoothPrinter.list(
        (printers: any[]) => {
          resolve(printers.map(p => ({
            name: p.name || 'Unknown Printer',
            address: p.address,
            type: 'bluetooth' as const,
          })));
        },
        (error: string) => reject(new Error(error))
      );
    });
  }
  
  throw new Error('No native Bluetooth printing plugin available. Please install a thermal printer plugin for your platform.');
};

/**
 * Connect to a Bluetooth printer using native APIs
 */
export const connectNativeBluetoothPrinter = async (address: string): Promise<boolean> => {
  const win = window as any;
  
  if (win.ThermalPrinter) {
    return new Promise((resolve, reject) => {
      win.ThermalPrinter.connect(
        { type: 'bluetooth', address },
        () => resolve(true),
        (error: string) => reject(new Error(error))
      );
    });
  }
  
  if (win.BluetoothPrinter) {
    return new Promise((resolve, reject) => {
      win.BluetoothPrinter.connect(
        address,
        () => resolve(true),
        (error: string) => reject(new Error(error))
      );
    });
  }
  
  throw new Error('No native Bluetooth printing plugin available');
};

/**
 * Print raw ESC/POS data to connected Bluetooth printer
 */
export const printNativeBluetooth = async (
  address: string, 
  data: Uint8Array
): Promise<NativePrintResult> => {
  const win = window as any;
  
  // Convert Uint8Array to base64 for plugin compatibility
  const base64Data = btoa(String.fromCharCode(...data));
  
  if (win.ThermalPrinter) {
    return new Promise((resolve) => {
      win.ThermalPrinter.printRaw(
        { type: 'bluetooth', address, data: Array.from(data) },
        () => resolve({ success: true }),
        (error: string) => resolve({ success: false, error })
      );
    });
  }
  
  if (win.BluetoothPrinter) {
    return new Promise((resolve) => {
      win.BluetoothPrinter.printBase64(
        address,
        base64Data,
        () => resolve({ success: true }),
        (error: string) => resolve({ success: false, error })
      );
    });
  }
  
  return { success: false, error: 'No native Bluetooth printing plugin available' };
};

/**
 * Print via network (TCP) on native platform
 * This can work even when the edge function can't reach the printer
 */
export const printNativeNetwork = async (
  ipAddress: string,
  port: number,
  data: Uint8Array
): Promise<NativePrintResult> => {
  const win = window as any;
  
  if (win.ThermalPrinter) {
    return new Promise((resolve) => {
      win.ThermalPrinter.printRaw(
        { type: 'tcp', address: ipAddress, port, data: Array.from(data) },
        () => resolve({ success: true }),
        (error: string) => resolve({ success: false, error })
      );
    });
  }
  
  // Fallback: Use edge function for network printing
  return { success: false, error: 'Native network printing not available, use edge function' };
};

/**
 * Request Bluetooth permissions on Android
 */
export const requestBluetoothPermissions = async (): Promise<boolean> => {
  if (!isCapacitorAvailable()) return false;
  
  try {
    // Dynamic import to avoid build errors when Capacitor isn't installed
    const Capacitor = (window as any).Capacitor;
    if (!Capacitor?.Plugins?.Permissions) {
      console.warn('Capacitor Permissions plugin not available');
      return true; // Assume permissions are handled natively
    }
    
    const { Permissions } = Capacitor.Plugins;
    
    // Request location permission (required for Bluetooth scanning on Android)
    const locationResult = await Permissions.requestPermission?.('location');
    if (locationResult?.state !== 'granted') {
      console.warn('Location permission not granted - Bluetooth scanning may be limited');
    }
    
    return true;
  } catch (error) {
    console.error('Error requesting Bluetooth permissions:', error);
    return false;
  }
};

/**
 * Helper to determine the best printing method for the current platform
 */
export const getBestPrintingMethod = (): 'native-bluetooth' | 'native-network' | 'web-bluetooth' | 'web-usb' | 'network' | 'browser' => {
  // In native Capacitor app
  if (isNativeApp()) {
    if (isNativeBluetoothPrintAvailable()) {
      return 'native-bluetooth';
    }
    // Native apps should use network printing as fallback
    return 'native-network';
  }
  
  // In web browser
  const nav = navigator as any;
  
  if (nav.bluetooth) {
    return 'web-bluetooth';
  }
  
  if (nav.usb) {
    return 'web-usb';
  }
  
  // Network printing via edge function works everywhere
  return 'network';
};

/**
 * Check platform capabilities
 */
export const getPlatformPrintCapabilities = () => {
  const nav = navigator as any;
  
  return {
    isNative: isNativeApp(),
    isCapacitor: isCapacitorAvailable(),
    hasNativeBluetoothPlugin: isNativeBluetoothPrintAvailable(),
    hasWebBluetooth: !!nav.bluetooth,
    hasWebUSB: !!nav.usb,
    hasNetworkPrinting: true, // Always available via edge function
    hasBrowserPrint: true, // Always available
    recommendedMethod: getBestPrintingMethod(),
  };
};
