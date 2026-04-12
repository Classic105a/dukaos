/**
 * Native Barcode Scanner for Capacitor (Android)
 * 
 * Uses device camera for real-time barcode scanning.
 * Falls back to manual input on web.
 */

import { isNativeApp } from '@/lib/escpos';

export interface BarcodeScanResult {
  content: string;
  format: string;
  cancelled: boolean;
}

/**
 * Check if native barcode scanning is available
 */
export const isNativeScannerAvailable = (): boolean => {
  return isNativeApp() && typeof (window as any).Capacitor?.Plugins?.BarcodeScanner !== 'undefined';
};

/**
 * Scan a barcode using the native camera
 * Returns the scanned content or null if cancelled
 */
export const scanBarcode = async (): Promise<BarcodeScanResult | null> => {
  if (!isNativeScannerAvailable()) {
    return null;
  }

  try {
    const { BarcodeScanner } = (window as any).Capacitor.Plugins;

    // Check camera permission
    const status = await BarcodeScanner.checkPermission({ force: true });
    if (!status.granted) {
      console.warn('[BarcodeScanner] Camera permission not granted');
      return null;
    }

    // Make background transparent for scanner overlay
    document.querySelector('body')?.classList.add('scanner-active');
    BarcodeScanner.hideBackground();

    const result = await BarcodeScanner.startScan();

    // Restore UI
    document.querySelector('body')?.classList.remove('scanner-active');
    BarcodeScanner.showBackground();

    if (result.hasContent) {
      return {
        content: result.content,
        format: result.format || 'unknown',
        cancelled: false,
      };
    }

    return { content: '', format: '', cancelled: true };
  } catch (error) {
    console.error('[BarcodeScanner] Error:', error);
    document.querySelector('body')?.classList.remove('scanner-active');
    return null;
  }
};

/**
 * Stop an active scan
 */
export const stopScan = async (): Promise<void> => {
  if (!isNativeScannerAvailable()) return;

  try {
    const { BarcodeScanner } = (window as any).Capacitor.Plugins;
    await BarcodeScanner.stopScan();
    BarcodeScanner.showBackground();
    document.querySelector('body')?.classList.remove('scanner-active');
  } catch {
    // Ignore errors when stopping
  }
};
