import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';
import { isTauri } from './tauriUpdater';

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const UPDATE_TOAST_ID = 'seven-note-pwa-update';

let swRegistration: ServiceWorkerRegistration | undefined;
let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | undefined;

function showUpdateAvailableToast(): void {
  // Defer slightly on initial page load so Sonner's <Toaster /> is mounted.
  window.setTimeout(() => {
    toast.info('Nueva actualización disponible', {
      id: UPDATE_TOAST_ID,
      description: 'Hay una nueva versión de Seven Note lista. Actualiza para ver los cambios.',
      duration: Infinity,
      action: {
        label: 'Actualizar ahora',
        onClick: () => {
          if (updateSWFn) {
            void updateSWFn(true);
          } else if (swRegistration?.waiting) {
            swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
          } else {
            window.location.reload();
          }
        },
      },
    });
  }, 400);
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
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      if (manual) {
        toast.info('Aplicando nueva versión...');
      }
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
      if (updateSWFn) {
        void updateSWFn(true);
      } else if (swRegistration?.waiting) {
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        showUpdateAvailableToast();
      }
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      swRegistration = registration;

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
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
