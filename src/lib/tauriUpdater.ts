import { toast } from 'sonner';

export const isTauri =
  typeof window !== 'undefined' &&
  Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

// In native desktop environments, unregister any service workers and clear cache storage
if (isTauri && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key));
      });
    }
  } catch (err) {
    console.warn('Failed to clear service workers in desktop environment', err);
  }
}

let hasCheckedOnStartup = false;

export async function checkForAppUpdates(manual = false) {
  if (!isTauri) {
    if (manual) {
      toast.info('Estás ejecutando la versión web. Las actualizaciones son automáticas en la web.');
    }
    return;
  }

  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const { relaunch } = await import('@tauri-apps/plugin-process');

    const update = await check();

    if (!update) {
      if (manual) {
        toast.success('Seven Note está actualizado en la versión más reciente.');
      }
      return;
    }

    toast.info(`Nueva versión ${update.version} disponible`, {
      description: update.body || 'Se ha encontrado una nueva versión de Seven Note.',
      duration: 15000,
      action: {
        label: 'Actualizar ahora',
        onClick: async () => {
          const toastId = toast.loading('Descargando e instalando actualización...');
          try {
            let downloaded = 0;
            let contentLength = 0;

            await update.downloadAndInstall((event) => {
              if (event.event === 'Started') {
                contentLength = event.data.contentLength || 0;
              } else if (event.event === 'Progress') {
                downloaded += event.data.chunkLength;
                if (contentLength > 0) {
                  const percent = Math.round((downloaded / contentLength) * 100);
                  toast.loading(`Descargando actualización: ${percent}%`, { id: toastId });
                }
              } else if (event.event === 'Finished') {
                toast.loading('Instalando y reiniciando Seven Note...', { id: toastId });
              }
            });

            toast.success('¡Actualización completada! Reiniciando...', { id: toastId });
            await relaunch();
          } catch (err: unknown) {
            console.error('Error al instalar la actualización:', err);
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(`Error al actualizar: ${msg}`, { id: toastId });
          }
        },
      },
    });
  } catch (error) {
    console.error('Error al buscar actualizaciones:', error);
    if (manual) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`No se pudo verificar actualizaciones: ${msg}`);
    }
  }
}

export function initTauriUpdater() {
  if (hasCheckedOnStartup || !isTauri) return;
  hasCheckedOnStartup = true;

  // Wait 3 seconds after startup before checking silently in the background
  setTimeout(() => {
    checkForAppUpdates(false);
  }, 3000);
}
