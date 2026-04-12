import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNativePlatform } from "./lib/native-platform";

// Initialize native platform features (no-op on web)
initNativePlatform();

createRoot(document.getElementById("root")!).render(<App />);
