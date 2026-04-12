/**
 * Native Platform Utilities
 * Central detection and lifecycle management for Capacitor apps.
 */

import { isNativeApp } from '@/lib/escpos';

/**
 * Initialize native platform features on app startup.
 * Call this once in main.tsx or App.tsx.
 */
export const initNativePlatform = async () => {
  if (!isNativeApp()) return;

  try {
    const Capacitor = (window as any).Capacitor;

    // Configure status bar
    const StatusBar = Capacitor?.Plugins?.StatusBar;
    if (StatusBar) {
      await StatusBar.setStyle({ style: 'DARK' }).catch(() => {});
      await StatusBar.setBackgroundColor({ color: '#0a0a1a' }).catch(() => {});
    }

    // Hide splash screen after app is ready
    const SplashScreen = Capacitor?.Plugins?.SplashScreen;
    if (SplashScreen) {
      await SplashScreen.hide().catch(() => {});
    }

    // Handle back button
    const App = Capacitor?.Plugins?.App;
    if (App) {
      App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.minimizeApp();
        }
      });
    }

    console.log('[NativePlatform] Initialized successfully');
  } catch (error) {
    console.error('[NativePlatform] Init error:', error);
  }
};

/**
 * Register app lifecycle listeners for background sync triggers
 */
export const registerLifecycleListeners = (onResume: () => void) => {
  if (!isNativeApp()) return;

  const App = (window as any).Capacitor?.Plugins?.App;
  if (!App) return;

  App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
    if (isActive) {
      console.log('[NativePlatform] App resumed — triggering sync');
      onResume();
    }
  });
};
