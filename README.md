# ⚡ Seven Note

> Una alternativa ultra-ligera a **AFFiNE**, fusionando lo mejor de **Notion** (editor de bloques ricos) y **Milanote** (tableros visuales con tarjetas infinitas y flechas conectoras). Diseñada con arquitectura **100% Offline-First**, sin CRDTs pesados, con sincronización opcional en la nube con **Supabase** y lista para desplegar en **GitHub + Vercel**.

![Seven Note Preview](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/www/public/og.jpg)

---

## ✨ Características Principales

- **⚡ Híbrido Notion + Milanote**:
  - **Modo Documento (Notion)**: Editor estructurado de texto rico con encabezados, citas, listas de viñetas, listas de tareas interactivas con celebración confetti, bloques de código y exportación Markdown.
  - **Modo Tablero (Milanote)**: Lienzo infinito con zoom, paneo, cuadrícula de puntos, minimapa y tarjetas interactivas de:
    - 📌 **Notas adhesivas** (con paleta de colores: amarillo, azul, verde, morado, rosa, gris).
    - ✅ **Checklists** (con barra de progreso en tiempo real y contador de tareas).
    - 🖼️ **Imágenes offline** (sube fotos locales directamente desde tu dispositivo).
    - 🔗 **Enlaces web** (con título, descripción y apertura en un clic).
    - 📁 **Sub-tableros anidados** (crea tableros dentro de tableros con navegación fluida y breadcrumbs).
    - ↗️ **Conexiones y flechas** (arrastra conectores animados entre tarjetas).
  - **Modo Dividido (AFFiNE Hybrid)**: Trabaja en el documento y en el tablero visual lado a lado con sincronización continua.
- **🛡️ 100% Offline-First (Local-First)**:
  - Todo se guarda instantáneamente en **IndexedDB** mediante **Dexie.js**.
  - Latencia de 0 ms. Funciona sin internet ni conexión de red.
  - Incluye **PWA (Progressive Web App)** con Service Worker automático para instalar la app en Windows, Mac, Android o iOS.
  - Exportación e importación completa de copias de seguridad en formato JSON.
- **☁️ Sincronización Opcional con Supabase**:
  - Sin bloquear la interfaz ni requerir inicio de sesión obligatorio.
  - Si configuras tus claves de Supabase (en la interfaz o en `.env`), se activa un motor de sincronización que respalda tus notas y tarjetas automáticamente en PostgreSQL.
- **🔍 Búsqueda Rápida Global (`Ctrl + K`)**:
  - Encuentra cualquier página, nota adhesiva o tarea en milisegundos.
- **🎨 UI/UX Moderna**:
  - Soporte nativo para Modo Oscuro y Modo Claro.
  - Papelera de reciclaje con restauración y borrado permanente.
  - Iconos modernos con Lucide React y estilos con Tailwind CSS.

---

## 🚀 Despliegue Rápido en Vercel + GitHub

### 1. Subir a GitHub
```bash
git init
git add .
git commit -m "feat: initial commit of Seven Note"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/seven-note.git
git push -u origin main
```

### 2. Desplegar en Vercel
1. Ve a [Vercel](https://vercel.com) e inicia sesión.
2. Haz clic en **"Add New Project"** e importa tu repositorio `seven-note`.
3. *(Opcional)* En la sección **Environment Variables**, añade:
   - `VITE_SUPABASE_URL`: La URL de tu proyecto Supabase.
   - `VITE_SUPABASE_ANON_KEY`: La clave anónima pública de tu proyecto Supabase.
4. Haz clic en **Deploy**. ¡Tu aplicación estará online en menos de 1 minuto!

---

## 🗄️ Configuración de Supabase (Opcional)

Si deseas sincronización en la nube con Supabase:
1. Crea un proyecto gratuito en [Supabase](https://supabase.com).
2. Ve al **SQL Editor** de Supabase y ejecuta el contenido del archivo [`src/supabase_schema.sql`](file:///src/supabase_schema.sql).
3. En la app Seven Note, abre el botón **Configuración** (o el icono de la nube en la cabecera) e introduce tu **Project URL** y **Anon Key**.
4. Haz clic en **"Probar conexión"** y luego en **"Guardar"**. ¡Listo!

---

## 🛠️ Desarrollo Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción (TypeScript + Vite)
npm run build
```
