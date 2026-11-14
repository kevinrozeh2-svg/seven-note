import { registerSW } from 'virtual:pwa-register';
import { isTauri } from './tauriUpdater';

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Registers the PWA Service Worker in web environments and automatically
 * reloads open tabs once a new deployment takes control.
 */
export function initPwaAutoUpdate(): void {
  if (isTauri || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const hadController = Boolean(navigator.serviceWorker.controller);
  let isReloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only reload when replacing an already-active SW, not on first-ever install.
    if (!hadController || isReloading) return;
    isReloading = true;
    window.location.reload();
  });

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const checkForUpdates = () => {
        registration.update().catch(() => {
          // Ignore transient offline/network errors during background update checks.
        });
      };

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdates();
        }
      });

      window.setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
    },
  });
}
