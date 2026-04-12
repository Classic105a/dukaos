/**
 * Native Haptics for Capacitor
 * Provides tactile feedback on product selection, errors, etc.
 */

import { isNativeApp } from '@/lib/escpos';

let hapticsPlugin: any = null;

const getHaptics = () => {
  if (hapticsPlugin) return hapticsPlugin;
  if (isNativeApp() && (window as any).Capacitor?.Plugins?.Haptics) {
    hapticsPlugin = (window as any).Capacitor.Plugins.Haptics;
  }
  return hapticsPlugin;
};

/** Light tap — product added to cart */
export const tapLight = () => {
  getHaptics()?.impact?.({ style: 'LIGHT' }).catch(() => {});
};

/** Medium tap — payment confirmed */
export const tapMedium = () => {
  getHaptics()?.impact?.({ style: 'MEDIUM' }).catch(() => {});
};

/** Heavy tap — error or warning */
export const tapHeavy = () => {
  getHaptics()?.impact?.({ style: 'HEAVY' }).catch(() => {});
};

/** Success vibration pattern */
export const vibrateSuccess = () => {
  getHaptics()?.notification?.({ type: 'SUCCESS' }).catch(() => {});
};

/** Error vibration pattern */
export const vibrateError = () => {
  getHaptics()?.notification?.({ type: 'ERROR' }).catch(() => {});
};
