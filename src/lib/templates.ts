import { type CanvasNodeType, type CanvasNodeData } from '../db'

export interface CanvasTemplateNodeDef {
  type: CanvasNodeType
  positionX: number
  positionY: number
  data: CanvasNodeData
}

export interface CanvasTemplateEdgeDef {
  sourceIndex: number // Index in the nodes array
  targetIndex: number
  label?: string
  color?: string
}

export type TemplateCategory =
  | 'Tableros Edgeless'
  | 'Proyectos'
  | 'Trabajo'
  | 'Personal'
  | 'Creatividad'
  | 'Estudio'

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Tableros Edgeless',
  'Proyectos',
  'Trabajo',
  'Personal',
  'Creatividad',
  'Estudio'
]

export interface AppTemplate {
  id: string
  title: string
  description: string
  icon: string
  category: TemplateCategory
  type: 'canvas' | 'doc'
  tags?: string[]
  featured?: boolean
  isCustom?: boolean
  createdAt?: number
  docContent?: string
  nodes?: CanvasTemplateNodeDef[]
  edges?: CanvasTemplateEdgeDef[]
  hasCover?: boolean
  coverType?: 'bannerText' | 'color' | 'gradient' | 'image'
  coverBannerTitle?: string
  coverBannerSubtitle?: string
  coverColor?: string
  coverBannerStyle?: 'minimal-light' | 'minimal-dark' | 'cream' | 'serif'
}

export function resolveTemplateContent(html?: string): string {
  if (!html) return '<p></p>'
  const now = new Date()
  const todayShort = now.toLocaleDateString('es-ES')
  const todayLong = now.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  return html
    .replace(/\{\{TODAY\}\}/g, todayShort)
    .replace(/\{\{TODAY_LONG\}\}/g, todayLong)
}

export const APP_TEMPLATES: AppTemplate[] = [
  // --- Plantilla Proyectos & Subproyectos (Estilo Notion Minimal) ---
  {
    id: 'projects-and-subprojects',
    title: 'Proyectos y subproyectos',
    description: 'Cabecera tipográfica estética con banner "PROJECTS & SUB-PROJECTS", icono de carpeta y gestión organizada de proyectos e iniciativas.',
    icon: 'folder',
    category: 'Proyectos',
    type: 'doc',
    featured: true,
    tags: ['roadmap', 'iniciativas', 'hitos', 'notion'],
    hasCover: true,
    coverType: 'bannerText',
    coverBannerTitle: 'PROJECTS &',
    coverBannerSubtitle: 'SUB-PROJECTS',
    coverColor: '#ffffff',
    coverBannerStyle: 'minimal-light',
    docContent: `
      <h2>🎯 Visión General de Proyectos</h2>
      <p>Espacio centralizado para gestionar las iniciativas estratégicas, hojas de ruta y entregables del equipo.</p>
      
      <h3>🚀 Iniciativas Activas (Q4)</h3>
      <ul data-type="taskList">
        <li data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><strong>Lanzamiento Versión 2.0:</strong> Arquitectura offline-first con sincronización en la nube.</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div><strong>Rediseño Estético de Notas:</strong> Portadas tipográficas minimalistas e iconos elevados estilo Notion.</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div><strong>Subproyectos & Dependencias:</strong> Tableros interconectados para desglose de tareas complejas.</div></li>
      </ul>

      <h3>📁 Subproyectos & Hitos</h3>
      <blockquote>
        <em>"Un proyecto sin sub-hitos claros es solo una buena intención."</em>
      </blockquote>
    `
  },
  // --- Tableros Milanote Auténticos (Screenshots de Referencia) ---
  {
    id: 'milanote-inspiration',
    title: 'Tablero de inspiración (Milanote)',
    description: 'Moodboard visual completo con paleta de color pantone, collage fotográfico, tarjeta de YouTube, banner editorial y conector curvo.',
    icon: '🎨',
    category: 'Tableros Edgeless',
    type: 'canvas',
    featured: true,
    tags: ['moodboard', 'diseño', 'paleta', 'visual'],
    nodes: [
      {
        type: 'note',
        positionX: 60,
        positionY: 80,
        data: {
          content: 'Rostros recortados, formas geométricas, sobrio, atrevido, minimalista, futurista',
          color: 'slate',
          width: 250
        }
      },
      {
        type: 'image',
        positionX: 200,
        positionY: 40,
        data: {
          imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
          caption: 'Retrato con formas geométricas'
        }
      },
      {
        type: 'image',
        positionX: 20,
        positionY: 260,
        data: {
          imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop&q=80',
          caption: 'Retrato en azul con audífonos'
        }
      },
      {
        type: 'image',
        positionX: 180,
        positionY: 480,
        data: {
          imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=500&auto=format&fit=crop&q=80',
          caption: 'ESTADO DE MOVIMIENTO - Tipografía JD'
        }
      },
      {
        type: 'image',
        positionX: 430,
        positionY: 40,
        data: {
          imageUrl: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=500&auto=format&fit=crop&q=80',
          caption: 'Retrato velado en blanco y negro'
        }
      },
      {
        type: 'note',
        positionX: 400,
        positionY: 540,
        data: {
          title: 'El Grupo de Música del Futuro',
          content: 'El Grupo de Música del Futuro',
          isBanner: true,
          color: 'redBanner'
        }
      },
      {
        type: 'colorPalette',
        positionX: 670,
        positionY: 60,
        data: {
          title: 'Paleta Visual',
          swatches: [
            { id: '1', hex: '#FFBF00', name: 'Mañana' },
            { id: '2', hex: '#D42511', name: 'Hollywood' },
            { id: '3', hex: '#257EF4', name: 'Azul Dodger' }
          ]
        }
      },
      {
        type: 'link',
        positionX: 880,
        positionY: 130,
        data: {
          title: 'Animación de burbujas futurista',
          url: 'https://youtube.com/shorts/j0BPqFjVAzg?si=milanote',
          imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
          isVideo: true
        }
      },
      {
        type: 'note',
        positionX: 880,
        positionY: 550,
        data: {
          title: 'SA Studio',
          content: 'SA',
          color: 'redBanner',
          width: 200
        }
      },
      {
        type: 'subboard',
        positionX: 740,
        positionY: 700,
        data: {
          title: 'Robot Node',
          subtitle: '2 conexiones',
          isStandalone: true,
          iconType: 'folder',
          iconColor: '#0369a1'
        }
      }
    ],
    edges: [
      { sourceIndex: 9, targetIndex: 8, label: '2', color: '#334155' }
    ]
  },
  {
    id: 'milanote-research',
    title: 'Investigación (Milanote)',
    description: 'Tablero de investigación sobre diseño danés: citas con barra de acento, tabla de sillas y enlaces.',
    icon: '🔍',
    category: 'Tableros Edgeless',
    type: 'canvas',
    nodes: [
      {
        type: 'note',
        positionX: 40,
        positionY: 70,
        data: {
          title: 'Diseño Danés',
          showTitle: true,
          content: 'Su historia se remonta a principios del siglo XX, pero realmente ganó prominencia internacional en la era posterior a la Segunda Guerra Mundial. Las raíces del diseño danés están fuertemente influenciadas por el movimiento de Artes y Oficios y la escuela Bauhaus alemana, que enfatizaban la funcionalidad, la artesanía y la simplicidad. Sin embargo, los daneses añadieron una calidez y calidad orgánica distintivas, a menudo inspiradas en el paisaje escandinavo.',
          alertBox: 'Diseño centrado en el usuario',
          color: 'blue',
          width: 280
        }
      },
      {
        type: 'table',
        positionX: 30,
        positionY: 530,
        data: {
          title: 'Diseños de sillas famosas',
          col1Title: 'Diseños de sillas famosas',
          col2Title: 'Date',
          headerColor: 'yellow',
          rows: [
            { id: '1', checked: false, col1: 'Lanzamiento: Silla Wishbone de Hans J. Wegner', col2: '1949' },
            { id: '2', checked: false, col1: 'Introducción: Silla Egg de Arne Jacobsen', col2: '1958' },
            { id: '3', checked: false, col1: 'Debut de la Silla Panton de Verner Panton', col2: '1967' }
          ]
        }
      },
      {
        type: 'todo',
        positionX: 40,
        positionY: 690,
        data: {
          title: 'Principios Clave',
          todos: [
            { id: '1', text: 'Funcionalidad y Simplicidad', completed: true },
            { id: '2', text: 'Artesanía de Calidad', completed: true },
            { id: '3', text: 'Estética Atemporal', completed: true }
          ],
          color: 'slate'
        }
      },
      {
        type: 'link',
        positionX: 340,
        positionY: 50,
        data: {
          title: 'Designmuseum Denmark',
          url: 'https://designmuseum.dk/en/',
          description: 'Designmuseum Danmark er et centrum for design og kunsthåndværk.',
          imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&auto=format&fit=crop&q=80'
        }
      },
      {
        type: 'note',
        positionX: 580,
        positionY: 90,
        data: {
          isQuote: true,
          quoteAuthor: 'Poul Kjærholm',
          content: 'Estoy tratando de hacer que la gente se dé cuenta de que debemos producir cosas bellas, pero al mismo tiempo, cosas que se puedan utilizar.',
          color: 'green',
          width: 260
        }
      },
      {
        type: 'image',
        positionX: 620,
        positionY: 250,
        data: {
          imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&auto=format&fit=crop&q=80',
          caption: 'Silla Panton Roja'
        }
      },
      {
        type: 'link',
        positionX: 340,
        positionY: 620,
        data: {
          title: 'ARNE JACOBSEN | Biography 2023',
          url: 'https://youtu.be/LvwtRPwdv4U?si=milanote',
          imageUrl: 'https://images.unsplash.com/photo-1503602642458-232111445657?w=500&auto=format&fit=crop&q=80',
          isVideo: true
        }
      },
      {
        type: 'note',
        positionX: 600,
        positionY: 570,
        data: {
          title: 'Estudios actuales',
          showTitle: true,
          content: 'Copenhague alberga varios estudios de diseño de <mark class="bg-cyan-200 dark:bg-cyan-800 text-neutral-900 dark:text-neutral-100 px-1 rounded">productos influyentes</mark> que continúan dando forma al diseño danés e internacional.\n\nNorgram se centra en crear marcas icónicas y experiencias digitales... mientras que Komplot Design, <mark class="bg-cyan-200 dark:bg-cyan-800 text-neutral-900 dark:text-neutral-100 px-1 rounded">fundado en 1987, trabaja en diseño industrial, gráfico</mark> y de muebles.',
          hasHtmlHighlight: true,
          color: 'slate',
          width: 270
        }
      },
      {
        type: 'note',
        positionX: 860,
        positionY: 610,
        data: {
          content: 'Enraizado en la tradición del diseño escandinavo, caracterizado por una estética duradera, funcionalidad y una expresión honesta.',
          linkUrl: 'professionals.muuto.com',
          color: 'peach',
          width: 260
        }
      }
    ],
    edges: []
  },
  {
    id: 'milanote-project-plan',
    title: 'Plano del proyecto (Milanote Dark)',
    description: 'Producción de película en modo oscuro: poster ConcreteAngels, presupuesto con checkboxes, videos de skateboarding, notas y archivo Illustrator.',
    icon: '🎬',
    category: 'Tableros Edgeless',
    type: 'canvas',
    nodes: [
      {
        type: 'image',
        positionX: 40,
        positionY: 70,
        data: {
          imageUrl: 'https://images.unsplash.com/photo-1520045892732-304bc3ac5d8e?w=500&auto=format&fit=crop&q=80',
          caption: 'ConcreteAngels Poster'
        }
      },
      {
        type: 'note',
        positionX: 40,
        positionY: 600,
        data: {
          title: 'Acerca de la película:',
          showTitle: true,
          isQuote: true,
          content: 'Concrete Angels es una mirada profunda a la cultura de los jóvenes patinadores que están rompiendo los límites del patinaje técnico.',
          color: 'darkNote',
          width: 260
        }
      },
      {
        type: 'subboard',
        positionX: 290,
        positionY: 70,
        data: {
          title: 'Ideas',
          subtitle: '2 tablas, 1 documento',
          subboards: [
            { id: '1', title: 'Ideas', count: '17 tarjetas', icon: 'idea', color: '#0284c7' },
            { id: '2', title: 'Tablero de inspiración', count: '12 tarjetas', icon: 'sparkle', color: '#10b981' },
            { id: '3', title: 'Guión', count: '335 palabras', icon: 'doc', color: '#06b6d4' }
          ]
        }
      },
      {
        type: 'table',
        positionX: 290,
        positionY: 530,
        data: {
          title: 'Film budget',
          col1Title: 'Elemento',
          col2Title: 'Cost',
          headerColor: 'dark',
          hasCheckboxes: true,
          showTotal: true,
          totalText: '$23,000',
          rows: [
            { id: '1', checked: true, col1: 'Equipo y material', col2: '$6,500' },
            { id: '2', checked: true, col1: 'Equipo y mano de obra', col2: '$8,000' },
            { id: '3', checked: true, col1: 'Viajes y localizaciones', col2: '$3,000' },
            { id: '4', checked: true, col1: 'Producción y banda sonora', col2: '$3,000' },
            { id: '5', checked: false, col1: 'Marketing y distribución', col2: '$2,500' }
          ]
        }
      },
      {
        type: 'subboard',
        positionX: 530,
        positionY: 70,
        data: {
          title: 'Filmación',
          subtitle: '2 tablas',
          imageUrl: 'https://images.unsplash.com/photo-1564982752979-3f7bc974d29a?w=500&auto=format&fit=crop&q=80',
          subboards: [
            { id: 'sb-film-1', title: 'Guión gráfico', count: '20 tarjetas', icon: 'film', color: '#ec4899' }
          ]
        }
      },
      {
        type: 'subboard',
        positionX: 620,
        positionY: 820,
        data: {
          title: 'Skaters',
          subtitle: '15 tarjetas',
          isStandalone: true,
          iconType: 'skull',
          iconColor: '#c084fc'
        }
      },
      {
        type: 'link',
        positionX: 770,
        positionY: 70,
        data: {
          title: 'Skatepark Video Preview',
          url: 'https://vimeo.com',
          imageUrl: 'https://images.unsplash.com/photo-1547447134-cd3f5c716030?w=500&auto=format&fit=crop&q=80',
          isVideo: true
        }
      },
      {
        type: 'comment',
        positionX: 770,
        positionY: 440,
        data: {
          commentAuthor: 'Natali',
          commentDate: '16 Jan 2026',
          commentText: '¡Me encanta este tráiler! 💜💜'
        }
      }
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, label: '', color: '#ec4899' }
    ]
  },
  {
    id: 'flowchart',
    title: 'Diagrama de Flujo & Toma de Decisiones',
    description: 'Estructura de flujo clásica de AFFiNE con formas geométricas (Inicio/Fin, Decisión de diamante, Procesos y flechas).',
    icon: '🔀',
    category: 'Tableros Edgeless',
    type: 'canvas',
    nodes: [
      {
        type: 'shape',
        positionX: 300,
        positionY: 80,
        data: { shapeType: 'ellipse', color: 'green', content: 'Inicio del Proceso' }
      },
      {
        type: 'shape',
        positionX: 300,
        positionY: 230,
        data: { shapeType: 'rect', color: 'blue', content: 'Recopilar Requerimientos de Usuario' }
      },
      {
        type: 'shape',
        positionX: 300,
        positionY: 370,
        data: { shapeType: 'diamond', color: 'yellow', content: '¿Factibilidad Técnica Aprobada?' }
      },
      {
        type: 'shape',
        positionX: 520,
        positionY: 370,
        data: { shapeType: 'rect', color: 'rose', content: 'Iterar y Ajustar Arquitectura' }
      },
      {
        type: 'shape',
        positionX: 300,
        positionY: 530,
        data: { shapeType: 'rect', color: 'purple', content: 'Implementar & Desplegar Solución' }
      },
      {
        type: 'shape',
        positionX: 300,
        positionY: 670,
        data: { shapeType: 'ellipse', color: 'green', content: 'Fin / Entrega Exitosa' }
      }
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, label: 'Comenzar', color: '#10b981' },
      { sourceIndex: 1, targetIndex: 2, label: 'Validar', color: '#3b82f6' },
      { sourceIndex: 2, targetIndex: 3, label: 'No', color: '#f59e0b' },
      { sourceIndex: 3, targetIndex: 1, label: 'Revisar', color: '#ef4444' },
      { sourceIndex: 2, targetIndex: 4, label: 'Sí', color: '#10b981' },
      { sourceIndex: 4, targetIndex: 5, label: 'Completado', color: '#8b5cf6' }
    ]
  },
  {
    id: 'swot-analysis',
    title: 'Análisis FODA / SWOT Visual',
    description: '4 cuadrantes enmarcados para Fortalezas, Oportunidades, Debilidades y Amenazas con notas de colores.',
    icon: '📊',
    category: 'Tableros Edgeless',
    type: 'canvas',
    nodes: [
      // Frame 1: Fortalezas
      {
        type: 'frame',
        positionX: 80,
        positionY: 80,
        data: { title: 'Fortalezas (Strengths)', frameIndex: 1, color: 'emerald', width: 360, height: 280 }
      },
      {
        type: 'note',
        positionX: 110,
        positionY: 130,
        data: { title: 'Ventaja Competitiva', content: 'Soporte 100% offline y latencia cero con IndexedDB.', color: 'green' }
      },
      // Frame 2: Oportunidades
      {
        type: 'frame',
        positionX: 480,
        positionY: 80,
        data: { title: 'Oportunidades (Opportunities)', frameIndex: 2, color: 'blue', width: 360, height: 280 }
      },
      {
        type: 'note',
        positionX: 510,
        positionY: 130,
        data: { title: 'Crecimiento en el Mercado', content: 'Usuarios que buscan alternativas locales a Notion y Miro.', color: 'blue' }
      },
      // Frame 3: Debilidades
      {
        type: 'frame',
        positionX: 80,
        positionY: 400,
        data: { title: 'Debilidades (Weaknesses)', frameIndex: 3, color: 'amber', width: 360, height: 280 }
      },
      {
        type: 'note',
        positionX: 110,
        positionY: 450,
        data: { title: 'Área de Mejora', content: 'Optimizar exportación masiva y colaboración multiusuario.', color: 'yellow' }
      },
      // Frame 4: Amenazas
      {
        type: 'frame',
        positionX: 480,
        positionY: 400,
        data: { title: 'Amenazas (Threats)', frameIndex: 4, color: 'purple', width: 360, height: 280 }
      },
      {
        type: 'note',
        positionX: 510,
        positionY: 450,
        data: { title: 'Factores Externos', content: 'Cambios rápidos en APIs y navegadores modernos.', color: 'purple' }
      }
    ],
    edges: []
  },
  {
    id: 'pitch-deck',
    title: 'Presentación Pitch Deck (Marcos de Diapositiva)',
    description: 'Secuencia de diapositivas en marcos (#1 Problema, #2 Solución, #3 Mercado, #4 Roadmap) lista para Modo Presentación.',
    icon: '📽️',
    category: 'Tableros Edgeless',
    type: 'canvas',
    nodes: [
      // Slide 1
      {
        type: 'frame',
        positionX: 60,
        positionY: 100,
        data: { title: '1. El Problema Actual', frameIndex: 1, color: 'indigo', width: 440, height: 300 }
      },
      {
        type: 'note',
        positionX: 90,
        positionY: 160,
        data: { title: 'Dolores de los usuarios', content: 'Aplicaciones pesadas en la nube que fallan sin conexión a internet y saturan la memoria RAM.', color: 'rose' }
      },
      // Slide 2
      {
        type: 'frame',
        positionX: 540,
        positionY: 100,
        data: { title: '2. Nuestra Solución Ligera', frameIndex: 2, color: 'blue', width: 440, height: 300 }
      },
      {
        type: 'note',
        positionX: 570,
        positionY: 160,
        data: { title: 'Seven Note', content: 'Arquitectura offline-first inspirada en AFFiNE y Milanote. Rápida, privada y adaptable.', color: 'blue' }
      },
      // Slide 3
      {
        type: 'frame',
        positionX: 60,
        positionY: 460,
        data: { title: '3. Roadmap & Objetivos', frameIndex: 3, color: 'emerald', width: 440, height: 300 }
      },
      {
        type: 'todo',
        positionX: 90,
        positionY: 520,
        data: {
          title: 'Hitos Q3 / Q4',
          color: 'green',
          todos: [
            { id: '1', text: 'Lanzamiento de lienzo edgeless', completed: true },
            { id: '2', text: 'Modo presentación pantalla completa', completed: true },
            { id: '3', text: 'Integración Supabase y sync en la nube', completed: true }
          ]
        }
      },
      // Slide 4
      {
        type: 'frame',
        positionX: 540,
        positionY: 460,
        data: { title: '4. Conclusión & Siguientes Pasos', frameIndex: 4, color: 'purple', width: 440, height: 300 }
      },
      {
        type: 'shape',
        positionX: 640,
        positionY: 530,
        data: { shapeType: 'star', color: 'yellow', content: '¡Listos para Crecer!' }
      }
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 2, label: 'Evolución', color: '#6366f1' },
      { sourceIndex: 2, targetIndex: 4, label: 'Impacto', color: '#0ea5e9' }
    ]
  },
  {
    id: 'mindmap',
    title: 'Mapa Mental & Brainstorming de Conceptos',
    description: 'Nodo central con ramas secundarias y notas conectadas para organizar ideas complejas.',
    icon: '🧠',
    category: 'Tableros Edgeless',
    type: 'canvas',
    nodes: [
      {
        type: 'shape',
        positionX: 380,
        positionY: 260,
        data: { shapeType: 'roundedRect', color: 'purple', content: 'Concepto Central: Producto', fontSize: 'lg' }
      },
      {
        type: 'note',
        positionX: 80,
        positionY: 100,
        data: { title: '🎨 Experiencia de Usuario', content: 'Diseño limpio, temas oscuros y atajos de teclado rápidos.', color: 'yellow' }
      },
      {
        type: 'note',
        positionX: 680,
        positionY: 100,
        data: { title: '⚡ Rendimiento', content: 'Carga instantánea, animaciones a 60fps y bundle optimizado.', color: 'blue' }
      },
      {
        type: 'note',
        positionX: 80,
        positionY: 420,
        data: { title: '🔒 Privacidad & Datos', content: 'Cifrado local, exportación en JSON/MD y sin rastreadores.', color: 'green' }
      },
      {
        type: 'note',
        positionX: 680,
        positionY: 420,
        data: { title: '☁️ Sincronización', content: 'Soporte offline y persistencia confiable en Supabase.', color: 'rose' }
      }
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, color: '#eab308' },
      { sourceIndex: 0, targetIndex: 2, color: '#38bdf8' },
      { sourceIndex: 0, targetIndex: 3, color: '#22c55e' },
      { sourceIndex: 0, targetIndex: 4, color: '#ec4899' }
    ]
  },
  {
    id: 'fishbone-diagram',
    title: 'Diagrama de Causa y Efecto (Ishikawa / Fishbone)',
    description: 'Plantilla de AFFiNE para análisis de causa raíz agrupada en Personas, Procesos, Tecnología y Entorno.',
    icon: '🐟',
    category: 'Tableros Edgeless',
    type: 'canvas',
    nodes: [
      // Head: The main effect / problem
      {
        type: 'shape',
        positionX: 720,
        positionY: 240,
        data: { shapeType: 'roundedRect', color: 'rose', content: 'Efecto / Problema a Resolver', fontSize: 'base' }
      },
      // Category 1: Personas (Top Left)
      {
        type: 'shape',
        positionX: 180,
        positionY: 80,
        data: { shapeType: 'rect', color: 'blue', content: 'Personas / Equipo' }
      },
      {
        type: 'note',
        positionX: 180,
        positionY: 170,
        data: { title: 'Causas', content: 'Sobrecarga de trabajo o falta de capacitación específica.', color: 'blue' }
      },
      // Category 2: Procesos (Top Middle)
      {
        type: 'shape',
        positionX: 450,
        positionY: 80,
        data: { shapeType: 'rect', color: 'yellow', content: 'Procesos / Métodos' }
      },
      {
        type: 'note',
        positionX: 450,
        positionY: 170,
        data: { title: 'Causas', content: 'Cuellos de botella en la fase de revisión y testing.', color: 'yellow' }
      },
      // Category 3: Tecnología (Bottom Left)
      {
        type: 'shape',
        positionX: 180,
        positionY: 340,
        data: { shapeType: 'rect', color: 'purple', content: 'Tecnología / Herramientas' }
      },
      {
        type: 'note',
        positionX: 180,
        positionY: 430,
        data: { title: 'Causas', content: 'Herramientas desconectadas y falta de sincronización.', color: 'purple' }
      },
      // Category 4: Entorno (Bottom Middle)
      {
        type: 'shape',
        positionX: 450,
        positionY: 340,
        data: { shapeType: 'rect', color: 'green', content: 'Entorno / Políticas' }
      },
      {
        type: 'note',
        positionX: 450,
        positionY: 430,
        data: { title: 'Causas', content: 'Requerimientos cambiantes y plazos ajustados.', color: 'green' }
      }
    ],
    edges: [
      { sourceIndex: 1, targetIndex: 0, label: 'Causas', color: '#38bdf8' },
      { sourceIndex: 3, targetIndex: 0, label: 'Causas', color: '#f59e0b' },
      { sourceIndex: 5, targetIndex: 0, label: 'Causas', color: '#a855f7' },
      { sourceIndex: 7, targetIndex: 0, label: 'Causas', color: '#10b981' }
    ]
  },
  {
    id: 'project-kanban-board',
    title: 'Seguimiento de Proyecto Kanban',
    description: '3 columnas con marcos de diapositiva y tarjetas de tareas para gestionar el flujo de entrega.',
    icon: '📋',
    category: 'Tableros Edgeless',
    type: 'canvas',
    featured: true,
    tags: ['kanban', 'sprint', 'tareas', 'agile'],
    nodes: [
      // Frame 1: Backlog
      {
        type: 'frame',
        positionX: 50,
        positionY: 60,
        data: { title: '1. Por Hacer (Backlog)', frameIndex: 1, color: 'indigo', width: 340, height: 420 }
      },
      {
        type: 'todo',
        positionX: 70,
        positionY: 120,
        data: {
          title: 'Historias de Usuario',
          color: 'blue',
          todos: [
            { id: '1', text: 'Diseñar interfaz minimalista', completed: true },
            { id: '2', text: 'Añadir filtros avanzados', completed: false },
            { id: '3', text: 'Validar rendimiento en móviles', completed: false }
          ]
        }
      },
      // Frame 2: In Progress
      {
        type: 'frame',
        positionX: 420,
        positionY: 60,
        data: { title: '2. En Desarrollo (Sprint)', frameIndex: 2, color: 'blue', width: 340, height: 420 }
      },
      {
        type: 'note',
        positionX: 440,
        positionY: 120,
        data: {
          title: '🔥 Enfoque Actual',
          content: 'Pulir animación del puntero láser y exportación a PNG con alta resolución.',
          color: 'yellow'
        }
      },
      // Frame 3: Done
      {
        type: 'frame',
        positionX: 790,
        positionY: 60,
        data: { title: '3. Completado (Done)', frameIndex: 3, color: 'emerald', width: 340, height: 420 }
      },
      {
        type: 'shape',
        positionX: 840,
        positionY: 150,
        data: { shapeType: 'star', color: 'green', content: 'Sprint Terminado con Éxito' }
      }
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 2, label: 'En progreso', color: '#6366f1' },
      { sourceIndex: 2, targetIndex: 4, label: 'Aprobado', color: '#10b981' }
    ]
  },
  {
    id: 'marketing-4p',
    title: 'Matriz de Marketing 4P (AFFiNE)',
    description: 'Cuadrícula estratégica de 4 cuadrantes para Producto, Precio, Plaza y Promoción.',
    icon: '🎯',
    category: 'Tableros Edgeless',
    type: 'canvas',
    nodes: [
      // 1. Producto
      {
        type: 'frame',
        positionX: 80,
        positionY: 60,
        data: { title: 'Producto (Product)', frameIndex: 1, color: 'indigo', width: 360, height: 280 }
      },
      {
        type: 'note',
        positionX: 110,
        positionY: 110,
        data: { title: 'Propuesta de Valor', content: 'Editor todo-en-uno que fusiona notas y lienzo infinito offline.', color: 'blue' }
      },
      // 2. Precio
      {
        type: 'frame',
        positionX: 480,
        positionY: 60,
        data: { title: 'Precio (Price)', frameIndex: 2, color: 'emerald', width: 360, height: 280 }
      },
      {
        type: 'note',
        positionX: 510,
        positionY: 110,
        data: { title: 'Modelo de Precios', content: 'Gratuito para uso personal y local; planes pro para equipos.', color: 'green' }
      },
      // 3. Plaza / Distribución
      {
        type: 'frame',
        positionX: 80,
        positionY: 380,
        data: { title: 'Plaza (Place)', frameIndex: 3, color: 'amber', width: 360, height: 280 }
      },
      {
        type: 'note',
        positionX: 110,
        positionY: 430,
        data: { title: 'Canales de Acceso', content: 'PWA web instalable, soporte multiplataforma y modo offline.', color: 'yellow' }
      },
      // 4. Promoción
      {
        type: 'frame',
        positionX: 480,
        positionY: 380,
        data: { title: 'Promoción (Promotion)', frameIndex: 4, color: 'purple', width: 360, height: 280 }
      },
      {
        type: 'note',
        positionX: 510,
        positionY: 430,
        data: { title: 'Estrategia de Crecimiento', content: 'Comunidad open-source, tutoriales en video y plantillas virales.', color: 'purple' }
      }
    ]
  },

  // --- Document Templates ---
  {
    id: 'daily-journal',
    title: 'Diario Personal / Reflexión Diaria',
    description: 'Plantilla guiada para anotar metas, reflexiones, gratitud y balance del día.',
    icon: '📅',
    category: 'Personal',
    type: 'doc',
    featured: true,
    tags: ['diario', 'gratitud', 'prioridades', 'hábitos'],
    docContent: `
      <h1>📅 Diario Personal: {{TODAY_LONG}}</h1>
      <p><em>"Un pequeño paso cada día construye una gran transformación."</em></p>
      
      <h3>🎯 3 Prioridades de Hoy</h3>
      <ul data-type="taskList">
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Prioridad máxima de enfoque: </div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Segunda meta del día: </div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Hábito o bienestar personal: </div></li>
      </ul>

      <h3>💡 Reflexión & Aprendizaje</h3>
      <p>Escribe aquí lo más destacado que aprendiste hoy o los desafíos superados...</p>

      <h3>✨ Agradecimiento</h3>
      <ul>
        <li>Agradecido/a por: </li>
        <li>Un momento agradable: </li>
      </ul>
    `
  },
  {
    id: 'meeting-notes',
    title: 'Notas de Reunión & Minuta',
    description: 'Estructura para reuniones de equipo, toma de decisiones y compromisos clave.',
    icon: '👥',
    category: 'Trabajo',
    type: 'doc',
    featured: true,
    tags: ['reunión', 'minuta', 'equipo', 'acuerdos'],
    docContent: `
      <h1>👥 Minuta de Reunión: Proyecto Estratégico</h1>
      <p><strong>Fecha:</strong> {{TODAY}} | <strong>Moderador:</strong> Equipo | <strong>Duración:</strong> 45 min</p>

      <h3>📋 Asistentes</h3>
      <ul>
        <li>Participante 1 (Líder de Producto)</li>
        <li>Participante 2 (Desarrollo)</li>
        <li>Participante 3 (Diseño / UX)</li>
      </ul>

      <h3>💬 Puntos Tratados</h3>
      <p>1. Revisión de avances semanales y métricas clave.<br/>2. Discusión de bloqueos e integraciones técnicas.<br/>3. Alineación del calendario de entregas.</p>

      <h3>🚀 Acuerdos & Tareas Asignadas</h3>
      <ul data-type="taskList">
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Validar prototipo de UI con el cliente (Responsable: UX)</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Desplegar versión estable en entorno de staging (Responsable: Dev)</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Enviar resumen y documentación a stakeholders</div></li>
      </ul>
    `
  },
  {
    id: 'project-plan',
    title: 'Plan de Proyecto & Roadmap',
    description: 'Esquema completo para definir objetivos, etapas, entregables y riesgos.',
    icon: '🚀',
    category: 'Proyectos',
    type: 'doc',
    tags: ['proyecto', 'roadmap', 'fases', 'hitos'],
    docContent: `
      <h1>🚀 Plan de Proyecto: Nueva Iniciativa</h1>
      <blockquote>
        <em>Objetivo General: Entregar una solución robusta, intuitiva y con soporte offline antes de finalizar el trimestre.</em>
      </blockquote>

      <h3>📌 Alcance & Objetivos</h3>
      <ul>
        <li>Diseño de interfaz minimalista inspirado en AFFiNE y Notion.</li>
        <li>Persistencia local 100% offline con sincronización en la nube.</li>
        <li>Soporte de tableros visuales y enlaces bidireccionales.</li>
      </ul>

      <h3>🗓️ Fases de Ejecución</h3>
      <p><strong>Fase 1: Descubrimiento & Diseño</strong> (Semana 1 - 2)<br/>
      <strong>Fase 2: Arquitectura & Desarrollo Core</strong> (Semana 3 - 5)<br/>
      <strong>Fase 3: Pruebas de Usuario & Lanzamiento</strong> (Semana 6)</p>

      <h3>✅ Hitos Principales</h3>
      <ul data-type="taskList">
        <li data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div>Definición de requerimientos y wireframes</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Implementación de componentes y navegación</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Pruebas de estrés y despliegue en producción</div></li>
      </ul>
    `
  },
  // --- Nuevas Plantillas de Lienzo (Canvas) ---
  {
    id: 'system-architecture',
    title: 'Arquitectura de Sistema & Producto',
    description: 'Mapa técnico por capas (Cliente, API, Datos y Servicios Externos) con nodos conectados para diseñar arquitecturas.',
    icon: '🏗️',
    category: 'Tableros Edgeless',
    type: 'canvas',
    tags: ['arquitectura', 'técnico', 'sistema', 'diagrama'],
    nodes: [
      {
        type: 'frame',
        positionX: 40,
        positionY: 60,
        data: { title: 'Capa Cliente (Web / Desktop)', frameIndex: 1, color: 'indigo', width: 300, height: 220 }
      },
      {
        type: 'shape',
        positionX: 80,
        positionY: 130,
        data: { shapeType: 'roundedRect', color: 'blue', content: 'App React + IndexedDB' }
      },
      {
        type: 'frame',
        positionX: 400,
        positionY: 60,
        data: { title: 'Capa API & Lógica', frameIndex: 2, color: 'purple', width: 300, height: 220 }
      },
      {
        type: 'shape',
        positionX: 440,
        positionY: 130,
        data: { shapeType: 'roundedRect', color: 'purple', content: 'API Gateway / Edge Functions' }
      },
      {
        type: 'frame',
        positionX: 760,
        positionY: 60,
        data: { title: 'Persistencia & Sync', frameIndex: 3, color: 'emerald', width: 300, height: 220 }
      },
      {
        type: 'shape',
        positionX: 800,
        positionY: 130,
        data: { shapeType: 'roundedRect', color: 'green', content: 'PostgreSQL / Storage' }
      },
      {
        type: 'note',
        positionX: 400,
        positionY: 340,
        data: { title: 'Decisiones Clave (ADR)', content: 'Priorizar escritura local instantánea y sincronización delta en segundo plano.', color: 'yellow', width: 300 }
      }
    ],
    edges: [
      { sourceIndex: 1, targetIndex: 3, label: 'HTTPS / Sync', color: '#7c3aed' },
      { sourceIndex: 3, targetIndex: 5, label: 'SQL / RLS', color: '#10b981' },
      { sourceIndex: 6, targetIndex: 3, label: 'Criterio', color: '#f59e0b' }
    ]
  },
  {
    id: 'visual-storyboard',
    title: 'Storyboard & Guión Visual',
    description: 'Secuencia de 4 escenas enmarcadas para planificar videos, campañas publicitarias o recorridos de usuario.',
    icon: '🎞️',
    category: 'Creatividad',
    type: 'canvas',
    featured: true,
    tags: ['storyboard', 'video', 'guión', 'escenas'],
    nodes: [
      {
        type: 'frame',
        positionX: 40,
        positionY: 60,
        data: { title: 'Escena 1 — Gancho (0-5s)', frameIndex: 1, color: 'indigo', width: 280, height: 240 }
      },
      {
        type: 'note',
        positionX: 60,
        positionY: 115,
        data: { title: 'Plano & Voz en off', content: 'Abrir con el problema principal en pantalla limpia. Frase directa en menos de 8 palabras.', color: 'blue' }
      },
      {
        type: 'frame',
        positionX: 350,
        positionY: 60,
        data: { title: 'Escena 2 — Contexto (5-15s)', frameIndex: 2, color: 'purple', width: 280, height: 240 }
      },
      {
        type: 'note',
        positionX: 370,
        positionY: 115,
        data: { title: 'Demostración rápida', content: 'Mostrar la fricción actual y la transición hacia el flujo resuelto.', color: 'purple' }
      },
      {
        type: 'frame',
        positionX: 660,
        positionY: 60,
        data: { title: 'Escena 3 — Solución (15-40s)', frameIndex: 3, color: 'emerald', width: 280, height: 240 }
      },
      {
        type: 'note',
        positionX: 680,
        positionY: 115,
        data: { title: 'Beneficio tangible', content: 'Tres capturas clave con ritmo ágil y subtítulos de alto contraste.', color: 'green' }
      },
      {
        type: 'frame',
        positionX: 970,
        positionY: 60,
        data: { title: 'Escena 4 — Cierre & CTA', frameIndex: 4, color: 'amber', width: 280, height: 240 }
      },
      {
        type: 'note',
        positionX: 990,
        positionY: 115,
        data: { title: 'Llamado a la acción', content: 'Resumen en 1 línea + enlace o siguiente paso concreto.', color: 'yellow' }
      }
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 2, label: 'Corte', color: '#7c3aed' },
      { sourceIndex: 2, targetIndex: 4, label: 'Transición', color: '#10b981' },
      { sourceIndex: 4, targetIndex: 6, label: 'Cierre', color: '#f59e0b' }
    ]
  },
  // --- Nuevas Plantillas de Documentos ---
  {
    id: 'product-prd',
    title: 'Especificación de Producto (PRD)',
    description: 'Documento estructurado para definir problema, usuarios, requisitos funcionales, métricas de éxito y alcance.',
    icon: '📐',
    category: 'Proyectos',
    type: 'doc',
    tags: ['prd', 'producto', 'especificación', 'requisitos'],
    hasCover: true,
    coverType: 'bannerText',
    coverBannerTitle: 'PRODUCT',
    coverBannerSubtitle: 'SPECIFICATION',
    coverColor: '#18181b',
    coverBannerStyle: 'minimal-dark',
    docContent: `
      <h2>1. Contexto & Problema</h2>
      <p>Describe qué problema real estamos resolviendo, para quién ocurre y por qué importa ahora.</p>
      <blockquote><em>Hipótesis: Al simplificar este flujo reduciremos la fricción inicial y aumentaremos la retención semanal.</em></blockquote>

      <h2>2. Objetivos & Métricas de Éxito</h2>
      <ul>
        <li><strong>Objetivo principal:</strong> Reducir el tiempo de primera acción por debajo de 30 segundos.</li>
        <li><strong>Métrica secundaria:</strong> Tasa de adopción semanal del equipo.</li>
      </ul>

      <h2>3. Requisitos Funcionales</h2>
      <ul data-type="taskList">
        <li data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div>Definir casos de uso principales y estados vacíos</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Validar diseño responsivo en escritorio y móvil</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Garantizar persistencia offline y sincronización</div></li>
      </ul>

      <h2>4. Fuera de Alcance (No-Goals)</h2>
      <p>Lista explícita de lo que NO se construirá en esta iteración para proteger el enfoque.</p>
    `
  },
  {
    id: 'sprint-retrospective',
    title: 'Retrospectiva de Sprint',
    description: 'Formato clásico Start / Stop / Continue para evaluar iteraciones del equipo y definir acciones concretas.',
    icon: '🔄',
    category: 'Proyectos',
    type: 'doc',
    tags: ['sprint', 'agile', 'retrospectiva', 'equipo'],
    docContent: `
      <h1>🔄 Retrospectiva de Sprint — {{TODAY}}</h1>
      <p><strong>Equipo:</strong> Producto & Ingeniería | <strong>Facilitador:</strong> —</p>

      <h3>✅ Qué salió bien (Seguir haciendo)</h3>
      <ul>
        <li>Entregas incrementales sin regresiones críticas.</li>
        <li>Comunicación rápida para desbloquear dependencias.</li>
      </ul>

      <h3>⚠️ Qué generó fricción (Dejar de hacer / Ajustar)</h3>
      <ul>
        <li>Cambios de alcance a mitad de semana sin re-estimación.</li>
      </ul>

      <h3>💡 Experimentos & Acciones del Próximo Sprint</h3>
      <ul data-type="taskList">
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Documentar criterios de aceptación antes de iniciar desarrollo</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Reservar bloque semanal para deuda técnica y pruebas</div></li>
      </ul>
    `
  },
  {
    id: 'quarterly-okrs',
    title: 'OKRs Trimestrales',
    description: 'Alinea objetivos ambiciosos con resultados clave medibles y seguimiento semanal de progreso.',
    icon: '🎯',
    category: 'Trabajo',
    type: 'doc',
    tags: ['okr', 'estrategia', 'metas', 'trimestre'],
    hasCover: true,
    coverType: 'bannerText',
    coverBannerTitle: 'QUARTERLY',
    coverBannerSubtitle: 'OKRS & GOALS',
    coverColor: '#ffffff',
    coverBannerStyle: 'minimal-light',
    docContent: `
      <h2>🎯 Objetivo 1: Consolidar experiencia de producto</h2>
      <ul data-type="taskList">
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div><strong>KR 1.1:</strong> Alcanzar puntuación de satisfacción ≥ 4.7/5</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div><strong>KR 1.2:</strong> Reducir incidencias críticas reportadas en un 50%</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div><strong>KR 1.3:</strong> Publicar 3 mejoras clave de flujo de trabajo</div></li>
      </ul>

      <h2>🚀 Objetivo 2: Crecimiento y documentación</h2>
      <ul data-type="taskList">
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div><strong>KR 2.1:</strong> Completar base de conocimiento interna al 100%</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div><strong>KR 2.2:</strong> Documentar 5 casos de éxito con métricas reales</div></li>
      </ul>
    `
  },
  {
    id: 'one-on-one-meeting',
    title: 'Reunión 1:1 (One-on-One)',
    description: 'Agenda enfocada en bienestar, avances, bloqueos, feedback mutuo y crecimiento profesional.',
    icon: '🤝',
    category: 'Trabajo',
    type: 'doc',
    tags: ['1:1', 'liderazgo', 'feedback', 'gestión'],
    docContent: `
      <h1>🤝 Reunión 1:1 — {{TODAY}}</h1>
      <p><strong>Participantes:</strong> — | <strong>Frecuencia:</strong> Quincenal</p>

      <h3>🧭 Pulso & Prioridades</h3>
      <ul>
        <li>¿Cómo te sientes con tu carga actual esta semana?</li>
        <li>¿Cuál es el logro del que estás más orgulloso/a recientemente?</li>
      </ul>

      <h3>🚧 Bloqueos & Apoyo Necesario</h3>
      <p>Anota aquí decisiones pendientes, dependencias o recursos que necesites desbloquear.</p>

      <h3>📈 Desarrollo & Próximos Pasos</h3>
      <ul data-type="taskList">
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Acción acordada #1</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Acción acordada #2</div></li>
      </ul>
    `
  },
  {
    id: 'client-proposal-brief',
    title: 'Brief de Cliente & Propuesta',
    description: 'Estructura profesional para resumir necesidades del cliente, entregables, cronograma y presupuesto.',
    icon: '💼',
    category: 'Trabajo',
    type: 'doc',
    tags: ['cliente', 'propuesta', 'brief', 'comercial'],
    docContent: `
      <h1>💼 Propuesta de Proyecto</h1>
      <p><strong>Cliente:</strong> — | <strong>Fecha:</strong> {{TODAY}} | <strong>Estado:</strong> Borrador</p>

      <h3>1. Diagnóstico & Reto</h3>
      <p>Resumen claro de la situación actual del cliente y la oportunidad principal identificada.</p>

      <h3>2. Solución & Entregables</h3>
      <ul>
        <li><strong>Entregable 1:</strong> Auditoría y arquitectura de solución.</li>
        <li><strong>Entregable 2:</strong> Diseño visual e implementación completa.</li>
        <li><strong>Entregable 3:</strong> Capacitación y soporte post-lanzamiento.</li>
      </ul>

      <h3>3. Cronograma & Siguientes Pasos</h3>
      <ul data-type="taskList">
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Aprobación de alcance y firma</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Reunión de arranque (Kick-off)</div></li>
      </ul>
    `
  },
  {
    id: 'weekly-planner',
    title: 'Planificador Semanal',
    description: 'Organiza el foco de tu semana de lunes a viernes, prioridades clave y revisión de cierre.',
    icon: '🗓️',
    category: 'Personal',
    type: 'doc',
    tags: ['semanal', 'productividad', 'agenda', 'tareas'],
    docContent: `
      <h1>🗓️ Planificador Semanal</h1>
      <blockquote><em>Foco principal de la semana: completar lo importante antes que lo urgente.</em></blockquote>

      <h3>⭐ Top 3 Resultados de la Semana</h3>
      <ul data-type="taskList">
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Resultado clave #1</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Resultado clave #2</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Resultado clave #3</div></li>
      </ul>

      <h3>📌 Agenda por Días</h3>
      <p><strong>Lunes:</strong> Arranque y bloque de trabajo profundo<br/>
      <strong>Martes:</strong> Seguimiento de proyectos activos<br/>
      <strong>Miércoles:</strong> Revisión intermedia y entregables<br/>
      <strong>Jueves:</strong> Iteración y cierre de pendientes<br/>
      <strong>Viernes:</strong> Balance semanal y limpieza de bandeja</p>
    `
  },
  {
    id: 'book-reading-notes',
    title: 'Notas de Lectura & Libros',
    description: 'Captura ideas centrales, citas memorables y aprendizajes accionables de cada libro o artículo.',
    icon: '📚',
    category: 'Personal',
    type: 'doc',
    tags: ['lectura', 'libros', 'resumen', 'conocimiento'],
    docContent: `
      <h1>📚 Notas de Lectura</h1>
      <p><strong>Autor:</strong> — | <strong>Categoría:</strong> — | <strong>Fecha:</strong> {{TODAY}}</p>

      <h3>💎 Tesis Central en 3 Frases</h3>
      <p>Resume con tus propias palabras cuál es la idea principal que defiende el autor.</p>

      <h3>✍️ Citas Destacadas</h3>
      <blockquote><em>"Agrega aquí la frase más reveladora del libro junto con el número de página."</em></blockquote>

      <h3>⚡ Cómo Aplicarlo en mi Vida / Trabajo</h3>
      <ul data-type="taskList">
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Primer cambio o experimento concreto a aplicar esta semana</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Idea para conectar con otras notas de mi espacio</div></li>
      </ul>
    `
  },
  {
    id: 'creative-content-script',
    title: 'Guión de Contenido & Video',
    description: 'Plantilla ágil para estructurar gancho, desarrollo, ritmo visual y CTA en videos, newsletters o artículos.',
    icon: '✨',
    category: 'Creatividad',
    type: 'doc',
    tags: ['contenido', 'guión', 'youtube', 'redacción'],
    docContent: `
      <h1>✨ Guión de Contenido</h1>
      <p><strong>Formato:</strong> Video / Artículo | <strong>Audiencia:</strong> — | <strong>Fecha:</strong> {{TODAY}}</p>

      <h3>🎣 Gancho (Primeros 10 segundos)</h3>
      <blockquote><em>Promesa clara + curiosidad inmediata sin rodeos.</em></blockquote>

      <h3>🧩 Estructura del Desarrollo</h3>
      <ul>
        <li><strong>Punto 1:</strong> Contexto real y error común.</li>
        <li><strong>Punto 2:</strong> Demostración paso a paso con ejemplo concreto.</li>
        <li><strong>Punto 3:</strong> Resultado final y detalle que marca la diferencia.</li>
      </ul>

      <h3>📣 Cierre & Llamado a la Acción</h3>
      <p>Resume la idea principal en una frase memorable e invita al siguiente paso.</p>
    `
  },
  {
    id: 'cornell-study-notes',
    title: 'Notas Cornell (Método de Estudio)',
    description: 'Sistema probado para tomar apuntes efectivos con preguntas clave, desarrollo estructurado y síntesis final.',
    icon: '🎓',
    category: 'Estudio',
    type: 'doc',
    featured: true,
    tags: ['estudio', 'cornell', 'apuntes', 'universidad'],
    docContent: `
      <h1>🎓 Apuntes Cornell — Tema de Estudio</h1>
      <p><strong>Asignatura / Curso:</strong> — | <strong>Fecha:</strong> {{TODAY}}</p>

      <h3>❓ Preguntas Clave & Conceptos</h3>
      <ul>
        <li>¿Cuál es el principio fundamental detrás de este tema?</li>
        <li>¿En qué casos falla o tiene excepciones?</li>
        <li>¿Cómo se relaciona con la clase anterior?</li>
      </ul>

      <h3>📝 Desarrollo de Notas</h3>
      <p>Registra definiciones claras, fórmulas, ejemplos resueltos y esquemas durante la sesión.</p>

      <h3>🧠 Resumen de Síntesis (con tus palabras)</h3>
      <blockquote><em>Escribe en 3-4 líneas lo esencial para repasar en 60 segundos antes de un examen.</em></blockquote>

      <h3>✅ Repaso Espaciado</h3>
      <ul data-type="taskList">
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Repaso a las 24 horas</div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Repaso a los 7 días</div></li>
      </ul>
    `
  },
  {
    id: 'research-paper-summary',
    title: 'Resumen de Investigación / Paper',
    description: 'Ficha analítica para sintetizar papers académicos, metodología, hallazgos y limitaciones.',
    icon: '🔬',
    category: 'Estudio',
    type: 'doc',
    tags: ['investigación', 'paper', 'académico', 'análisis'],
    docContent: `
      <h1>🔬 Ficha de Investigación</h1>
      <p><strong>Autores / Año:</strong> — | <strong>Fuente:</strong> —</p>

      <h3>🎯 Pregunta de Investigación</h3>
      <p>¿Qué hipótesis o vacío en la literatura intenta resolver este trabajo?</p>

      <h3>🧪 Metodología</h3>
      <ul>
        <li><strong>Muestra / Dataset:</strong> —</li>
        <li><strong>Enfoque experimental:</strong> —</li>
      </ul>

      <h3>📊 Hallazgos Principales & Limitaciones</h3>
      <p>Anota los resultados más sólidos y cualquier sesgo o limitación que deba considerarse.</p>
    `
  }
]
