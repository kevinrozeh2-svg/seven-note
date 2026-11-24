# Seven Note Design System (`DESIGN.md`)

---

## 1. Filosofía de Diseño: Estación Oscura Minimalista

Seven Note es una herramienta de pensamiento y escritura de precisión. Su estética evita adornos genéricos (gradientes neón, radios inflados de `24px`, sombras con brillo artificial) y prioriza:

* **Grafito Profundo y Calma Visual:** Modo oscuro por defecto sobre superficies de grafito neutro (`#141414`, `#181818`, `#1e1e1e`) con tinta suave (`#dcddde`) que reduce la fatiga visual en sesiones largas.
* **Modo Claro Limpio y Funcional:** Superficies claras neutras (`#ffffff`, `#f8f8f8`, `#ececec`) usando exclusivamente tokens semánticos `--app-*`, sin fondos oscuros hardcodeados.
* **Un Único Acento Violeta Intencional:** `--app-accent: #7c3aed` (hover `#9061f9` en oscuro / `#6d28d9` en claro) para estados activos, foco de teclado, selección y acciones primarias. El resto del chrome permanece monocromático.
* **Tarjetas Táctiles en el Lienzo Espacial:** Notas y tareas del lienzo conservan tonos pastel tipo papel con bordes nítidos de `1px` y sombras multicapa sutiles.

---

## 2. Paleta de Colores y Tokens Semánticos

### Modo Oscuro (Principal — Grafito Profundo)
* **Fondo Principal / Editor (`--app-bg-primary`):** `#1e1e1e`
* **Sidebar / Superficie Secundaria (`--app-bg-secondary`):** `#181818`
* **Ribbon / Superficie Terciaria (`--app-bg-tertiary`):** `#141414`
* **Popovers y Modales (`--app-bg-overlay`):** `#252525`
* **Fondo del Lienzo (`--app-bg-canvas`):** `#161616`
* **Texto Primario (`--app-text-primary`):** `#dcddde`
* **Texto Secundario (`--app-text-secondary`):** `#8e8e8e`
* **Texto Muted (`--app-text-muted`):** `#6b6b6b`
* **Bordes y Divisores (`--app-border` / `--app-border-strong`):** `rgba(255, 255, 255, 0.06)` / `rgba(255, 255, 255, 0.12)`
* **Hover / Activo (`--app-hover` / `--app-active`):** `rgba(255, 255, 255, 0.05)` / `rgba(255, 255, 255, 0.09)`
* **Acento Primario (`--app-accent`):** `#7c3aed` · Soft: `rgba(124, 58, 237, 0.18)`

### Modo Claro (Superficies Neutras)
* **Fondo Principal (`--app-bg-primary`):** `#ffffff`
* **Sidebar (`--app-bg-secondary`):** `#f8f8f8`
* **Ribbon / Terciario (`--app-bg-tertiary`):** `#f1f1f2`
* **Popovers y Modales (`--app-bg-overlay`):** `#ffffff`
* **Texto Primario (`--app-text-primary`):** `#2e3338`
* **Texto Secundario (`--app-text-secondary`):** `#5c6370`
* **Texto Muted (`--app-text-muted`):** `#7b8290`
* **Bordes (`--app-border` / `--app-border-strong`):** `rgba(0, 0, 0, 0.08)` / `rgba(0, 0, 0, 0.14)`
* **Acento Primario (`--app-accent`):** `#7c3aed` · Hover: `#6d28d9` · Soft: `rgba(124, 58, 237, 0.12)`

---

## 3. Paleta Táctil del Lienzo (Notas y Tareas)

| Color | Claro BG | Claro Borde | Claro Tinta | Oscuro BG | Oscuro Borde | Oscuro Tinta |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Amarillo** | `#FFF9DB` | `#F5EEAF` | `#49420D` | `#3A341B` | `#574E22` | `#FEF08A` |
| **Papel** | `#FFFFFF` | `#E8E7E4` | `#2E3338` | `#252525` | `#3A3A3A` | `#DCDDDE` |
| **Durazno** | `#FFE8D4` | `#FCD2AF` | `#5C310B` | `#3D271A` | `#5E3820` | `#FED7AA` |
| **Menta** | `#DCF5E3` | `#B6E8C4` | `#184A25` | `#1A3424` | `#285338` | `#BBF7D0` |
| **Cielo** | `#E0F0FD` | `#BDE0FB` | `#11446E` | `#183048` | `#23496E` | `#BAE6FD` |
| **Lavanda** | `#EDE7FB` | `#D7C9F7` | `#3D2870` | `#2D2345` | `#46346E` | `#E9D5FF` |
| **Rosa** | `#FCE4EC` | `#F8B8CC` | `#6E1D38` | `#3D1D2B` | `#612B43` | `#FBCFE8` |
| **Grafito** | `#F1F1EF` | `#E3E2DE` | `#2E3338` | `#2E2E2E` | `#404040` | `#D4D4D4` |

---

## 4. Tipografía, Geometría e Iconografía

* **Tipografía UI / Editor:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`
* **Monospace (código y metadatos técnicos):** `"SFMono-Regular", Menlo, Monaco, Consolas, monospace`
* **Escala de Radios Única:**
  * Controles pequeños (botones, inputs, pestañas, items de menú): `6px` (`rounded-md`)
  * Tarjetas y nodos del lienzo: `10px` (`rounded-lg` / `rounded-[10px]`)
  * Popovers, docks y modales: `12px` (`rounded-xl`) — evitar `rounded-3xl` (`24px`)
* **Iconografía:** `@phosphor-icons/react` como librería canónica (sin emojis Unicode crudos como íconos de UI).
* **Accesibilidad:** Todos los botones de solo ícono llevan `aria-label`, las acciones de fila se muestran con `group-focus-within:opacity-100`, y `:focus-visible` usa `2px solid var(--app-accent)`.
