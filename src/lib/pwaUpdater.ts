import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';
import { isTauri } from './tauriUpdater';

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const UPDATE_TOAST_ID = 'seven-note-pwa-update';

let swRegistration: ServiceWorkerRegistration | undefined;
let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | undefined;
let updateAvailable = false;
const updateListeners = new Set<(available: boolean) => void>();

function notifyUpdateListeners(): void {
  updateListeners.forEach((listener) => listener(updateAvailable));
}

function markUpdateAvailable(): void {
  if (!updateAvailable) {
    updateAvailable = true;
    notifyUpdateListeners();
  }
  showUpdateAvailableToast();
}

export function isWebUpdateAvailable(): boolean {
  return updateAvailable;
}

export function subscribeToWebUpdate(listener: (available: boolean) => void): () => void {
  updateListeners.add(listener);
  listener(updateAvailable);
  return () => {
    updateListeners.delete(listener);
  };
}

export function applyWebUpdate(): void {
  if (updateSWFn) {
    void updateSWFn(true);
  } else if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  } else {
    window.location.reload();
  }
}

export function showUpdateAvailableToast(): void {
  toast.info('Nueva actualización disponible', {
    id: UPDATE_TOAST_ID,
    description: 'Hay una nueva versión de Seven Note lista. Actualiza para ver los cambios.',
    duration: Infinity,
    action: {
      label: 'Actualizar ahora',
      onClick: () => {
        applyWebUpdate();
      },
    },
  });
}

/**
 * Checks for a newer PWA Service Worker deployment in web environments.
 */
export async function checkForWebUpdates(manual = false): Promise<void> {
  if (isTauri || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const reg = swRegistration || (await navigator.serviceWorker.getRegistration());
    if (!reg) {
      if (manual) {
        toast.info('Las actualizaciones automáticas solo están activas en la versión desplegada (producción).');
      }
      return;
    }

    await reg.update();

    if (reg.waiting) {
      markUpdateAvailable();
      return;
    }

    if (manual) {
      if (reg.installing) {
        toast.info('Descargando nueva versión en segundo plano...');
      } else {
        toast.success('Ya estás usando la versión más reciente de Seven Note.');
      }
    }
  } catch {
    if (manual) {
      toast.error('No se pudo verificar si hay actualizaciones disponibles.');
    }
  }
}

/**
 * Registers the PWA Service Worker in web environments and prompts the user
 * when a new deployment is ready to activate.
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

  updateSWFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      markUpdateAvailable();
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      swRegistration = registration;

      if (registration.waiting) {
        markUpdateAvailable();
      }

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
