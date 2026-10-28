/**
 * Authentic AFFiNE Edgeless Senior Tool Widgets & SVGs
 * Direct replication from AFFiNE canary blocksuite packages:
 * - @blocksuite/affine-gfx-template
 * - @blocksuite/affine-gfx-note
 * - @blocksuite/affine-gfx-brush
 * - @blocksuite/affine-gfx-shape
 * - @blocksuite/affine-gfx-mindmap
 */

// --- 1. TEMPLATES SENIOR WIDGET (Fanning Kanban & Flowchart Cards) ---

export function TemplateCard1Svg({ className = '' }: { className?: string }) {
  return (
    <svg
      width="62"
      height="40"
      viewBox="0 0 62 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g filter="url(#tc1_drop)">
        <rect x="4.76" y="4.82" width="52.7" height="30.8" rx="3" fill="white" />
        <rect x="7.36" y="7.67" width="21.74" height="11.37" rx="1" fill="#DFF4E8" />
        <rect x="32.83" y="7.61" width="21.74" height="11.37" rx="1" fill="#DFF4F3" />
        <rect x="7.43" y="21.85" width="21.74" height="11.37" rx="1" fill="#FFEACA" />
        <rect x="32.84" y="21.80" width="21.74" height="11.37" rx="1" fill="#FFE1E1" />
        {/* Sticky note pills */}
        <rect x="8.5" y="9.0" width="4.14" height="3.08" rx="0.5" fill="#9DD194" />
        <rect x="8.5" y="14.06" width="4.14" height="3.08" rx="0.5" fill="#9DD194" />
        <rect x="13.45" y="9.0" width="3.72" height="3.08" rx="0.5" fill="#9DD194" />
        <rect x="37.68" y="11.43" width="3.72" height="3.08" rx="0.5" fill="#84CFFF" />
        <rect x="43.26" y="11.43" width="3.72" height="3.08" rx="0.5" fill="#84CFFF" />
        <rect x="34.25" y="22.85" width="3.72" height="3.08" rx="0.5" fill="#F16F6F" />
        <rect x="39.21" y="22.85" width="3.72" height="3.08" rx="0.5" fill="#F16F6F" />
        <rect x="8.62" y="23.18" width="3.72" height="3.08" rx="0.5" fill="#FFC46B" />
        <rect x="13.71" y="25.66" width="3.72" height="3.08" rx="0.5" fill="#FFC46B" />
        <line x1="7.89" y1="20.75" x2="54.27" y2="20.75" stroke="#A7A7A7" strokeWidth="0.4" />
        <line x1="31.0" y1="8.73" x2="31.0" y2="32.25" stroke="#A7A7A7" strokeWidth="0.4" />
        <rect x="5.06" y="5.12" width="52.1" height="30.2" rx="2.7" stroke="#E3E2E4" strokeWidth="0.6" />
      </g>
      <defs>
        <filter id="tc1_drop" x="0.76" y="0.82" width="60.7" height="38.8" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="1.5" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.16 0" />
          <feBlend mode="normal" in2="SourceGraphic" />
        </filter>
      </defs>
    </svg>
  )
}

export function TemplateCard2Svg({ className = '' }: { className?: string }) {
  return (
    <svg
      width="55"
      height="36"
      viewBox="0 0 55 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g filter="url(#tc2_drop)">
        <rect x="4.53" y="4.12" width="46.12" height="27.13" rx="3" fill="white" />
        <rect x="4.83" y="4.42" width="45.52" height="26.53" rx="2.7" stroke="#E3E2E4" strokeWidth="0.6" />
        {/* Flowchart paths */}
        <path d="M13.2 14.4H16.4" stroke="#6B6B6B" strokeWidth="0.3" />
        <path d="M22.4 14.4H24.1V20.9H26.2" stroke="#6B6B6B" strokeWidth="0.3" />
        <path d="M20.3 14.4H24.0V9.5H26.2" stroke="#6B6B6B" strokeWidth="0.3" />
        <path d="M32.7 20.9H39.4V25.8H41.4" stroke="#6B6B6B" strokeWidth="0.3" />
        {/* Flowchart nodes */}
        <rect x="6.16" y="12.8" width="7.05" height="3.26" rx="0.73" fill="#FFDE6B" />
        <rect x="26.23" y="7.92" width="6.51" height="3.8" rx="0.73" fill="#9DD194" />
        <rect x="26.23" y="18.77" width="6.51" height="3.8" rx="0.73" fill="#FFDE6B" />
        <rect
          width="3.38"
          height="3.38"
          transform="matrix(0.707 0.707 0.707 -0.707 16.14 14.49)"
          fill="#937EE7"
        />
        <rect
          width="3.38"
          height="3.38"
          transform="matrix(0.707 0.707 0.707 -0.707 34.24 20.87)"
          fill="#937EE7"
        />
        <rect x="41.42" y="23.65" width="7.05" height="3.26" rx="0.73" fill="#937EE7" />
        <rect x="41.42" y="14.43" width="7.05" height="3.8" rx="0.73" fill="#937EE7" />
      </g>
      <defs>
        <filter id="tc2_drop" x="0.53" y="0.12" width="54.12" height="35.13" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="1.5" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.16 0" />
          <feBlend mode="normal" in2="SourceGraphic" />
        </filter>
      </defs>
    </svg>
  )
}

export function TemplateCard3Svg({ className = '' }: { className?: string }) {
  return (
    <svg
      width="80"
      height="51"
      viewBox="0 0 80 51"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g filter="url(#tc3_drop)">
        <rect x="4.29" y="4.0" width="71.53" height="42.08" rx="4" fill="white" />
        <rect x="7.66" y="9.89" width="5.89" height="1.68" rx="0.84" fill="#FFEACA" />
        <rect x="7.66" y="13.26" width="20.2" height="33.66" rx="1" fill="#FFEACA" />
        <rect x="30.38" y="9.89" width="5.89" height="1.68" rx="0.84" fill="#E1EFFF" />
        <rect x="30.38" y="13.26" width="20.2" height="33.66" rx="1" fill="#E1EFFF" />
        {/* Column 1 items */}
        <rect x="8.5" y="15.78" width="5.05" height="4.21" rx="0.5" fill="#FFDE6B" />
        <rect x="8.5" y="22.51" width="5.05" height="4.21" rx="0.5" fill="#FFDE6B" />
        <rect x="15.23" y="15.78" width="5.05" height="4.21" rx="0.5" fill="#FFDE6B" />
        <rect x="15.23" y="28.4" width="5.05" height="4.21" rx="0.5" fill="#9DD194" />
        <rect x="21.97" y="22.51" width="5.05" height="4.21" rx="0.5" fill="#FFDE6B" />
        <rect x="21.97" y="28.4" width="5.05" height="4.21" rx="0.5" fill="#F16F6F" />
        {/* Column 2 items */}
        <rect x="31.22" y="15.78" width="5.05" height="4.21" rx="0.5" fill="#B8E3FF" />
        <rect x="31.22" y="21.67" width="5.05" height="4.21" rx="0.5" fill="#B8E3FF" />
        <rect x="37.96" y="15.78" width="5.05" height="4.21" rx="0.5" fill="#B8E3FF" />
        <rect x="4.29" y="4.0" width="71.53" height="42.08" rx="4" stroke="#E3E2E4" strokeWidth="0.6" />
      </g>
      <defs>
        <filter id="tc3_drop" x="0.29" y="0.5" width="79.5" height="49.5" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="1.8" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.18 0" />
          <feBlend mode="normal" in2="SourceGraphic" />
        </filter>
      </defs>
    </svg>
  )
}

export function TemplateSeniorWidget({ isActive = false }: { isActive?: boolean }) {
  return (
    <div
      className={`relative w-16 h-12 flex items-center justify-center overflow-hidden rounded-xl transition duration-300 group cursor-pointer ${
        isActive ? 'bg-[var(--affine-hover-color)]' : 'hover:bg-[var(--affine-hover-color)]'
      }`}
      title="Plantillas prediseñadas (Templates)"
    >
      {/* Card 2: Left tilted flowchart */}
      <div className="absolute transform -translate-x-[15px] translate-y-[2px] -rotate-[10deg] scale-[0.62] origin-left transition-all duration-300 ease-out group-hover:-rotate-[16deg] group-hover:-translate-x-[18px] group-hover:-translate-y-[2px]">
        <TemplateCard2Svg />
      </div>

      {/* Card 1: Right tilted kanban */}
      <div className="absolute transform translate-x-[14px] translate-y-[4px] rotate-[8deg] scale-[0.62] origin-right transition-all duration-300 ease-out group-hover:rotate-[14deg] group-hover:translate-x-[17px] group-hover:-translate-y-[1px]">
        <TemplateCard1Svg />
      </div>

      {/* Card 3: Center foreground dashboard board */}
      <div className="absolute transform translate-y-[14px] scale-[0.58] transition-all duration-300 ease-out group-hover:translate-y-[10px] group-hover:rotate-[4deg] group-hover:scale-[0.62] shadow-sm">
        <TemplateCard3Svg />
      </div>
    </div>
  )
}

// --- 2. NOTE SENIOR WIDGET (3 Stacked Floating Cards: Link, Text, H1) ---

export function NoteSeniorWidget({ isActive = false }: { isActive?: boolean }) {
  return (
    <div
      className={`relative w-16 h-12 flex items-center justify-center overflow-hidden rounded-xl transition duration-300 group cursor-pointer ${
        isActive ? 'bg-[var(--affine-hover-color)]' : 'hover:bg-[var(--affine-hover-color)]'
      }`}
      title="Notas adhesivas y tarjetas de página (N)"
    >
      {/* Background tilted sheet paper */}
      <div className="absolute w-[50px] h-[54px] rounded-md bg-[#fff7d6] dark:bg-[#343022] border border-[#f5e6a3] dark:border-[#534d31] shadow-md transform translate-y-[12px] rotate-[4.42deg] transition-all duration-300 ease-out group-hover:translate-y-[8px] group-hover:rotate-[6deg]" />

      {/* Left Card: Link Icon 🔗 */}
      <div className="absolute bottom-2 transform -translate-x-[16px] -translate-y-[2px] -rotate-[8deg] w-6 h-6 rounded bg-white dark:bg-[#2b2b2b] shadow-md border border-black/5 flex items-center justify-center text-[#1e96eb] transition-all duration-300 ease-out group-hover:-translate-x-[20px] group-hover:-translate-y-[5px] group-hover:-rotate-[14deg] z-10">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </div>

      {/* Center Card: Text "T" */}
      <div className="absolute bottom-2 transform translate-x-0 translate-y-0 rotate-[2deg] w-6 h-6 rounded bg-white dark:bg-[#2b2b2b] shadow-md border border-black/5 flex items-center justify-center font-bold text-xs text-[var(--affine-text-primary-color)] transition-all duration-300 ease-out group-hover:-translate-y-[6px] group-hover:scale-105 z-20">
        T
      </div>

      {/* Right Card: Heading "H1" */}
      <div className="absolute bottom-2 transform translate-x-[16px] -translate-y-[2px] rotate-[8deg] w-6 h-6 rounded bg-white dark:bg-[#2b2b2b] shadow-md border border-black/5 flex items-center justify-center font-extrabold text-[10px] text-amber-500 transition-all duration-300 ease-out group-hover:translate-x-[20px] group-hover:-translate-y-[5px] group-hover:rotate-[15deg] z-10">
        H1
      </div>
    </div>
  )
}

// --- 3. PENCIL SENIOR WIDGET (Realistic Mechanical Pencil) ---

export function PencilSeniorWidget({ isActive = false }: { isActive?: boolean }) {
  return (
    <div
      className={`relative w-12 h-12 flex items-center justify-center overflow-hidden rounded-xl transition duration-300 group cursor-pointer ${
        isActive ? 'bg-[var(--affine-hover-color)] ring-2 ring-[#1e96eb]' : 'hover:bg-[var(--affine-hover-color)]'
      }`}
      title="Lápiz de dibujo libre (D)"
    >
      <div className="transform -translate-y-1 transition-all duration-200 ease-out group-hover:-translate-y-2 group-hover:scale-110">
        <svg
          width="28"
          height="48"
          viewBox="0 0 36 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Pencil Shaft Verticals */}
          <path d="M8 38.9L12.3 37.5V106.5H8V38.9Z" fill="#1e96eb" />
          <path d="M12.3 37H17.5V106.5H12.3V37Z" fill="#38bdf8" />
          <path d="M17.5 37H22.8V106.5H17.5V37Z" fill="#0284c7" />
          <path d="M22.8 31L27 38.9V106.5H22.8V31Z" fill="#0369a1" />

          {/* Wooden Cone / Metallic Grip */}
          <path
            d="M16.6 2.88C16.82 1.91 18.21 1.91 18.44 2.88L19.9 8.97L22.28 18.95L27.03 38.9L24.0 38.02C23.2 37.8 22.35 37.9 21.64 38.32L18.02 40.44C17.71 40.62 17.32 40.62 17.01 40.44L13.02 38.1C12.55 37.83 11.99 37.75 11.46 37.91L8 38.9L12.76 18.95L15.14 8.97L16.6 2.88Z"
            fill="#E2E8F0"
            stroke="#CBD5E1"
            strokeWidth="0.5"
          />

          {/* Graphite Lead Tip */}
          <path
            d="M16.74 2.26C16.93 1.44 18.1 1.44 18.3 2.26L20.37 10.97H14.66L16.74 2.26Z"
            fill="#334155"
          />
        </svg>
      </div>
    </div>
  )
}

// --- 4. ERASER SENIOR WIDGET (Realistic Blue & White Rubber Block) ---

export function EraserSeniorWidget({ isActive = false }: { isActive?: boolean }) {
  return (
    <div
      className={`relative w-12 h-12 flex items-center justify-center overflow-hidden rounded-xl transition duration-300 group cursor-pointer ${
        isActive ? 'bg-[var(--affine-hover-color)] ring-2 ring-[#1e96eb]' : 'hover:bg-[var(--affine-hover-color)]'
      }`}
      title="Borrador de trazos de lápiz (E)"
    >
      <div className="transform translate-y-1 transition-all duration-200 ease-out group-hover:-translate-y-0.5 group-hover:scale-110">
        <svg
          width="32"
          height="38"
          viewBox="0 0 44 49"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* White Rubber Body */}
          <rect x="6" y="2" width="32" height="44" rx="5.75" fill="#FAFAFA" stroke="#E2E8F0" strokeWidth="1" />
          
          {/* Subtle 3D Top Corner Highlight */}
          <rect
            x="34"
            y="4.5"
            width="14"
            height="3"
            rx="1.5"
            transform="rotate(90 34 4.5)"
            fill="white"
            fillOpacity="0.8"
          />

          {/* Blue Paper Sleeve / Jacket Wrapper */}
          <path
            d="M5.5 20.25V46H16.5V16.5H9.37C8.8 16.5 8.3 16.89 8.16 17.45L6.45 19.11C5.9 19.21 5.5 19.69 5.5 20.25Z"
            fill="#173654"
          />
          <path
            d="M27.5 16.5H34.63C35.2 16.5 35.7 16.89 35.84 17.45L37.55 19.11C38.1 19.21 38.5 19.69 38.5 20.25V46H27.5V16.5Z"
            fill="#1E96EB"
          />
          <rect
            x="-0.5"
            y="0.5"
            width="11"
            height="30"
            transform="matrix(-1 0 0 1 27 16)"
            fill="#38BDF8"
          />
          <line x1="5.5" y1="20" x2="38.5" y2="20" stroke="white" strokeOpacity="0.3" strokeWidth="0.8" />
        </svg>
      </div>
    </div>
  )
}

// --- 5. SHAPES SENIOR WIDGET (3D Yellow Cylinder, Sphere, Pyramid) ---

export function ShapeSeniorWidget({ isActive = false }: { isActive?: boolean }) {
  return (
    <div
      className={`relative w-14 h-12 flex items-center justify-center overflow-hidden rounded-xl transition duration-300 group cursor-pointer ${
        isActive ? 'bg-[var(--affine-hover-color)]' : 'hover:bg-[var(--affine-hover-color)]'
      }`}
      title="Formas geométricas (Rectángulo, Círculo, Rombo, etc.)"
    >
      <div className="relative w-10 h-9 transition-all duration-300 ease-out group-hover:scale-110 group-hover:-translate-y-1">
        {/* Yellow Cylinder / Rounded Square in center back */}
        <div className="absolute top-0 left-2.5 w-6 h-6 rounded-lg bg-linear-to-b from-[#ffe58f] to-[#faad14] shadow-md border border-[#ffd666] transform rotate-3" />

        {/* Yellow Sphere / Circle on left front */}
        <div className="absolute bottom-0 left-0 w-5 h-5 rounded-full bg-radial from-[#fffb8f] via-[#ffd666] to-[#fa8c16] shadow-md border border-[#ffe58f]" />

        {/* Yellow Triangle / Pyramid on right front */}
        <div className="absolute bottom-0 right-0 w-5 h-5 flex items-center justify-center">
          <svg width="22" height="18" viewBox="0 0 62 50" fill="none">
            <path
              d="M0.8 49.2L31 0.8L61.2 49.2H0.8Z"
              fill="url(#pyr_grad)"
              stroke="#ffd666"
              strokeWidth="1.5"
            />
            <defs>
              <linearGradient id="pyr_grad" x1="31" y1="0.8" x2="31" y2="49.2" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ffec3d" />
                <stop offset="1" stopColor="#faad14" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  )
}

// --- 6. TEXT SENIOR WIDGET (Sticker Badge "Text" with Folded Corner) ---

export function TextSeniorWidget({ isActive = false }: { isActive?: boolean }) {
  return (
    <div
      className={`relative w-14 h-12 flex items-center justify-center overflow-hidden rounded-xl transition duration-300 group cursor-pointer ${
        isActive ? 'bg-[var(--affine-hover-color)]' : 'hover:bg-[var(--affine-hover-color)]'
      }`}
      title="Insertar texto flotante (T)"
    >
      <div className="relative transform transition-all duration-200 ease-out group-hover:scale-110 group-hover:-rotate-3 group-hover:-translate-y-1">
        {/* Authentic AFFiNE Text Script Sticker Badge */}
        <div className="px-2.5 py-1 rounded-md bg-white dark:bg-[#2b2b2b] shadow-md border border-black/10 flex items-center gap-1">
          <span className="font-serif italic font-black text-sm text-[var(--affine-text-primary-color)] tracking-tight">
            Text
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#1e96eb]" />
        </div>
      </div>
    </div>
  )
}

// --- 7. MINDMAP SENIOR WIDGET (Branching Nodes Structure) ---

export function MindmapSeniorWidget({ isActive = false }: { isActive?: boolean }) {
  return (
    <div
      className={`relative w-12 h-12 flex items-center justify-center overflow-hidden rounded-xl transition duration-300 group cursor-pointer ${
        isActive ? 'bg-[var(--affine-hover-color)] ring-2 ring-[#1e96eb]' : 'hover:bg-[var(--affine-hover-color)]'
      }`}
      title="Mapa mental / Mindmap interactivo (M)"
    >
      <div className="transform transition-all duration-200 ease-out group-hover:scale-110 group-hover:-translate-y-0.5">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Main central node */}
          <rect x="2" y="10" width="8" height="8" rx="2.5" fill="#1e96eb" />
          {/* Connecting branches */}
          <path d="M10 14 C14 14, 14 6, 18 6" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M10 14 C14 14, 14 22, 18 22" stroke="#a855f7" strokeWidth="1.6" strokeLinecap="round" />
          {/* Child nodes */}
          <rect x="18" y="3" width="7" height="6" rx="2" fill="#38bdf8" />
          <rect x="18" y="19" width="7" height="6" rx="2" fill="#a855f7" />
        </svg>
      </div>
    </div>
  )
}

// --- 8. LASER POINTER SENIOR WIDGET (Presenter Laser Beam) ---

export function LaserSeniorWidget({ isActive = false }: { isActive?: boolean }) {
  return (
    <div
      className={`relative w-12 h-12 flex items-center justify-center overflow-hidden rounded-xl transition duration-300 group cursor-pointer ${
        isActive ? 'bg-[var(--affine-hover-color)] ring-2 ring-rose-500' : 'hover:bg-[var(--affine-hover-color)]'
      }`}
      title="Puntero Láser de Presentación (L)"
    >
      <div className="transform transition-all duration-200 ease-out group-hover:scale-110 group-hover:-translate-y-0.5">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Flash laser beam effect */}
          <path
            d="M5 23 L18 10"
            stroke="#f43f5e"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Laser Head Glow */}
          <circle cx="19" cy="9" r="4.5" fill="#f43f5e" />
          <circle cx="19" cy="9" r="2" fill="#ffffff" />
          {/* Rays */}
          <line x1="19" y1="2" x2="19" y2="4" stroke="#fb7185" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="26" y1="9" x2="24" y2="9" stroke="#fb7185" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="24" y1="4" x2="22.5" y2="5.5" stroke="#fb7185" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}
