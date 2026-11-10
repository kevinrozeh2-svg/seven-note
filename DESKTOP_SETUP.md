# Seven Note - Versión de Escritorio Nativa (Windows & macOS)

Seven Note está empaquetada como una aplicación de escritorio nativa ultraligera mediante **Tauri v2**. Consume una fracción mínima de RAM en comparación con Electron y se actualiza sola directamente desde GitHub Releases.

---

## 🚀 1. Cómo probar la app localmente

Para ejecutar la aplicación nativa en tu máquina durante el desarrollo:

```bash
npm run tauri dev
```

Este comando levanta el servidor de Vite y abre la ventana nativa de Seven Note con DevTools y hot-reloading.

---

## 📦 2. Cómo compilar el instalador localmente (Windows)

Si quieres generar el instalador `.exe` o `.msi` en tu computadora sin esperar a GitHub:

```bash
npm run tauri build
```

Los instaladores resultantes se guardarán en:
`src-tauri/target/release/bundle/msi/` y `src-tauri/target/release/bundle/nsis/`

---

## 🌐 3. Compilación Multiplataforma Automática en GitHub (Windows y macOS)

Ya dejamos configurado el workflow de GitHub Actions en [`.github/workflows/release.yml`](.github/workflows/release.yml).

Cada vez que publiques un tag de versión o actives el workflow manualmente:
1. GitHub inicia una máquina con **Windows** y otra con **macOS**.
2. Compila el instalador `.exe` / `.msi` para Windows.
3. Compila el instalador `.dmg` para Mac (tanto Apple Silicon M1/M2/M3 como Intel).
4. Genera y firma el manifiesto de actualización `latest.json`.
5. Publica todo en la pestaña **Releases** de tu repositorio:
   `https://github.com/kevinrozeh2-svg/seven-note/releases`

---

## 🔑 4. Paso Único: Configurar la Clave Secreta en GitHub

Para que GitHub Actions pueda firmar criptográficamente los paquetes y el auto-actualizador funcione de forma segura:

1. Ve a tu repositorio en GitHub:
   `https://github.com/kevinrozeh2-svg/seven-note/settings/secrets/actions`
2. Haz clic en **New repository secret**.
3. Nombre del secreto:
   ```
   TAURI_SIGNING_PRIVATE_KEY
   ```
4. Valor del secreto (copia exactamente esta clave):
   ```
   dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWduIGVuY3J5cHRlZCBzZWNyZXQga2V5ClJXUlRZMEl5ZXJBOVlZeUt0a3NmRms5SGI2Z1dkbFFVcjZMN3pXZFBlNGMwMnlyWmx0WUFBQkFBQUFBQUFBQUFBQUlBQUFBQWtxdkpQQmhNeDI3T0Qyc1l5ZjNxQ0dKT2RHTlh2QnNCb1BZeE9sSmFvUFZYT01TQWlvWDI0Q1hCUWlsQ0xTcEJmNnBVL2pJQXF4VVp5aElNT1o1NUkra0gyRmYzaVZNN3VjMlhVYytEVVh5akhYdlUvUWd6ckRFSjNKM2JaYWg4NW9nOWpHM3lNMzg9Cg==
   ```
5. Guarda el secreto. *(Nota: La clave pública correspondiente ya quedó integrada en `src-tauri/tauri.conf.json`)*.

---

## 🔄 5. Flujo de Trabajo para Publicar Actualizaciones a tu Equipo

Cuando hagas mejoras en la aplicación y quieras que tu equipo las reciba:

1. En `package.json` y `src-tauri/tauri.conf.json`, sube la versión (por ejemplo `1.0.1`).
2. Sube los cambios y crea un tag:
   ```bash
   git add .
   git commit -m "Release v1.0.1"
   git push origin main
   git tag v1.0.1
   git push origin v1.0.1
   ```
3. GitHub Actions compilará automáticamente los ejecutables.
4. **¿Qué verá tu equipo?**
   - Cuando tu equipo abra Seven Note en su PC o Mac, a los 3 segundos la app consultará GitHub en segundo plano.
   - Aparecerá una notificación: **"Nueva versión v1.0.1 disponible"**.
   - Al hacer clic en **"Actualizar ahora"**, la app descargará la actualización, la instalará y se reiniciará automáticamente.
   - También pueden pulsar en cualquier momento el botón **"Buscar actualizaciones"** dentro de Configuración ⚙️.
   - **Tus notas y datos locales nunca se pierden**, ya que IndexedDB y la base de datos local persisten entre actualizaciones.
