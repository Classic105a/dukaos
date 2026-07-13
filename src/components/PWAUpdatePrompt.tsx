import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * C6: With `registerType: 'prompt'` the service worker no longer silently
 * swaps out HTML. This component registers the SW at boot and surfaces an
 * explicit "Update available" toast that lets the user reload on their own
 * terms — preventing stale HTML/chunk mismatches after a deploy.
 */
const PWAUpdatePrompt = () => {
  const [, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (import.meta.env.DEV) return;

    let disposed = false;

    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            if (disposed) return;
            toast("Update available", {
              description: "A new version of DukaOS is ready.",
              duration: Infinity,
              action: {
                label: "Reload",
                onClick: () => updateSW(true),
              },
            });
          },
          onOfflineReady() {
            if (disposed) return;
            setReady(true);
          },
        });
      })
      .catch(() => {
        /* plugin virtual module unavailable — skip */
      });

    return () => {
      disposed = true;
    };
  }, []);

  return null;
};

export default PWAUpdatePrompt;