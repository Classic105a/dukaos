import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNativePlatform } from "./lib/native-platform";
import { isSQLiteAvailable, initSQLiteDB } from "./lib/sqlite-db";
import { reconcileStores } from "./lib/sqlite-recovery";
import { installGlobalErrorHandlers } from "./lib/observability";

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
