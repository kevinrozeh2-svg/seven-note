# Seven Note Design System (DESIGN.md)
> Inspired by **Notion** & **Milanote** Design Systems (Reference: `VoltAgent/awesome-design-md` & Notion/Milanote UI Guidelines)

---

## 1. Design Philosophy: "A Tool, Not a Personality"

The core aesthetic shifts away from generic "AI-generated" templates (harsh gradients, glowing cyan/purple borders, bulbous 24px rounded corners, dark-only themes, and heavy drop shadows). 

Instead, it embodies **human-crafted digital craftsmanship**:
* **Calm & Warm Minimalism:** Tactile surfaces, off-white paper tones, and soft ink near-black.
* **Physical Spatial Canvas (Milanote):** Note cards that feel like real paper memo pads and pinboards, with delicate 1px borders, subtle tactile shadows, and pastel hues.
* **Typographic Restraint (Notion):** Humanist system typography, deliberate hierarchies, tight letter spacing for headings, and comfortable reading line-height.
* **Intentional Accents:** Monochromatic UI chrome with color reserved almost exclusively for user-created content (stickies, tags, status badges).

---

## 2. Color Palette & Surface Tokens

### Light Mode (Warm Paper Foundation)
* **App Canvas / Page Background:** `#FFFFFF`
* **Sidebar & Secondary Surface:** `#FBFBFA` *(Notion iconic warm ivory / paper-gray)*
* **Tertiary & Inset Surface:** `#F7F6F5`
* **Overlay Panels & Modals:** `#FFFFFF`
* **Primary Ink (Text):** `#37352F` *(Soft warm charcoal, reduces eye fatigue vs pure #000)*
* **Secondary Text:** `#787774` *(Warm graphite)*
* **Tertiary / Placeholder Text:** `#9B9A97` *(Muted warm gray)*
* **Dividers & Borders:** `rgba(55, 53, 47, 0.09)` or `#E9E9E7` *(Ultra-fine 1px lines)*
* **Hover State:** `rgba(55, 53, 47, 0.055)` *(Soft, non-jarring feedback)*
* **Active / Selected State:** `rgba(55, 53, 47, 0.09)`
* **Brand Primary Accent:** `#2383E2` *(Notion Blue)* or `#5645D4` *(Notion Purple)*
* **Selection Highlight:** `rgba(35, 131, 226, 0.14)`

### Dark Mode (Warm Charcoal Foundation)
* **App Canvas / Page Background:** `#191919` *(Warm dark, avoid cold blue zinc/slate)*
* **Sidebar & Secondary Surface:** `#202020`
* **Tertiary & Inset Surface:** `#262626`
* **Overlay Panels & Modals:** `#2C2C2C`
* **Primary Ink (Text):** `#E6E6E5` *(Warm white)*
* **Secondary Text:** `#9B9B9B`
* **Tertiary / Placeholder Text:** `#666666`
* **Dividers & Borders:** `rgba(255, 255, 255, 0.08)` or `#2E2E2E`
* **Hover State:** `rgba(255, 255, 255, 0.055)`
* **Active / Selected State:** `rgba(255, 255, 255, 0.1)`
* **Brand Primary Accent:** `#2E8EEA`

---

## 3. Milanote Tactile Note Palette (Physical Paper Cards)

Sticky notes and todo cards use real-world paper pastel tones with matching subtle borders:

| Color Name | Light BG | Light Border | Light Ink | Dark BG | Dark Border | Dark Ink |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Yellow** (Classic Post-it) | `#FFF9DB` | `#F5EEAF` | `#49420D` | `#3A341B` | `#574E22` | `#FEF08A` |
| **White / Paper** | `#FFFFFF` | `#E8E7E4` | `#37352F` | `#252525` | `#3A3A3A` | `#E6E6E5` |
| **Peach / Orange** | `#FFE8D4` | `#FCD2AF` | `#5C310B` | `#3D271A` | `#5E3820` | `#FED7AA` |
| **Mint / Green** | `#DCF5E3` | `#B6E8C4` | `#184A25` | `#1A3424` | `#285338` | `#BBF7D0` |
| **Sky / Blue** | `#E0F0FD` | `#BDE0FB` | `#11446E` | `#183048` | `#23496E` | `#BAE6FD` |
| **Lavender / Purple** | `#EDE7FB` | `#D7C9F7` | `#3D2870` | `#2D2345` | `#46346E` | `#E9D5FF` |
| **Rose / Blush** | `#FCE4EC` | `#F8B8CC` | `#6E1D38` | `#3D1D2B` | `#612B43` | `#FBCFE8` |
| **Slate / Warm Gray** | `#F1F1EF` | `#E3E2DE` | `#37352F` | `#2E2E2E` | `#404040` | `#D4D4D4` |

---

## 4. Typography Hierarchy (Notion Humanist Stack)

```css
font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
```

* **Document Title (H1):** `font-bold text-[32px] md:text-[36px] tracking-[-0.025em] leading-[1.2]`
* **Heading 1:** `font-semibold text-[24px] tracking-[-0.02em] leading-[1.25] mt-6 mb-2`
* **Heading 2:** `font-semibold text-[19px] tracking-[-0.015em] leading-[1.3] mt-5 mb-1.5`
* **Heading 3:** `font-semibold text-[16px] tracking-[-0.01em] leading-[1.35] mt-4 mb-1`
* **Body / Paragraphs:** `text-[14px] md:text-[15px] leading-[1.6] text-[var(--app-text-primary)]`
* **Monospace (Code):** `"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`

---

## 5. Geometry, Radius & Shadows

* **Small UI (Buttons, Menus, Inputs, Tabs):** `rounded-md` (6px) or `rounded-lg` (8px). Never pill-shape unless specifically designated as an active tag chip.
* **Cards & Sticky Notes:** `rounded-lg` (8px to 10px).
* **Floating Palettes / Docks:** `rounded-xl` (12px).
* **Borders:** Always crisp `1px solid` border. Never 2px or 3px borders on cards.
* **Tactile Multi-Layer Shadows (No AI-glow):**
  * `card-shadow`: `0 1px 3px rgba(15, 15, 15, 0.06), 0 1px 2px rgba(15, 15, 15, 0.04)`
  * `popover-shadow`: `0 3px 12px rgba(15, 15, 15, 0.12), 0 1px 4px rgba(15, 15, 15, 0.08)`
  * `dock-shadow`: `0 6px 20px rgba(15, 15, 15, 0.08), 0 2px 6px rgba(15, 15, 15, 0.05)`

---

## 6. Components Anatomy

### Header & Navigation
* Clean 46px height with bottom hairline divider (`1px solid var(--app-border)`).
* Segmented control with 4px inner padding, `rounded-lg` container, and soft shadow on the active tab.

### Sidebar (Notion-style)
* Background: `#FBFBFA` (Light) / `#202020` (Dark).
* Navigation items: 28px height, 6px border radius, 13px font size.
* Category labels: 11px uppercase with `tracking-wider` and muted graphite text.

### Visual Canvas (Milanote-style)
* Subtle dot grid (`#E3E2DE` / `#2A2A2A`) with 20px spacing.
* Floating tool dock with tactile pill container, clean 1px border, and frosted background.
* Note and Todo nodes with tactile pastel background, paper headers, and subtle connector handles.

### Rich Text Editor
* Clean typography with generous reading margins.
* Callout boxes: soft rounded pastel container with icon, 1px border, and natural text ink (no harsh saturated borders or dark contrast boxes).
* Code block with subtle warm paper background (`#F7F6F5` / `#222222`), 1px border, and language selector.
