import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNativePlatform } from "./lib/native-platform";
import { isSQLiteAvailable, initSQLiteDB } from "./lib/sqlite-db";
import { reconcileStores } from "./lib/sqlite-recovery";
import { installGlobalErrorHandlers } from "./lib/observability";

// Android Chromium has a long-standing compositor bug where transformed or
// filtered layers scrolling under fixed/sticky UI can expose stale frame-buffer
// tiles as horizontal black/garbled bands. Samsung Internet does not reproduce
// it on the tested device, so we only enable this conservative paint path for
// Chrome-family Android browsers and WebAPK/PWA shells.
const enableAndroidChromiumCompositorSafeMode = () => {
  if (typeof navigator === "undefined" || typeof document === "undefined") return;

  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isSamsungInternet = /SamsungBrowser/i.test(ua);
  const isChromeFamily = /(Chrome|CriOS|EdgA|OPR|Opera|Brave)/i.test(ua);

  if (isAndroid && isChromeFamily && !isSamsungInternet) {
    document.documentElement.classList.add("android-chromium-compositor-safe");
  }
};

enableAndroidChromiumCompositorSafeMode();

// Initialize native platform features (no-op on web)
initNativePlatform();

// Capture unhandled errors and promise rejections
installGlobalErrorHandlers();

// Initialize SQLite and reconcile stores (no-op on web)
if (isSQLiteAvailable()) {
  initSQLiteDB()
    .then(() => reconcileStores())
    .then(({ recovered }) => {
      if (recovered > 0) {
        console.log(`[Boot] Recovered ${recovered} sale(s) from SQLite`);
      }
    })
    .catch(e => console.error('[Boot] SQLite init error:', e));
}

createRoot(document.getElementById("root")!).render(<App />);
