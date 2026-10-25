import { type CanvasNodeType, type ShapeKind } from '../db'

export interface CanvasTemplateNodeDef {
  type: CanvasNodeType
  positionX: number
  positionY: number
  data: {
    title?: string
    content?: string
    color?: string
    shapeType?: ShapeKind
    frameIndex?: number
    frameTitle?: string
    width?: number
    height?: number
    fontSize?: 'sm' | 'base' | 'lg' | 'xl'
    textAlign?: 'left' | 'center' | 'right'
    todos?: Array<{ id: string; text: string; completed: boolean }>
    imageUrl?: string
  }
}

export interface CanvasTemplateEdgeDef {
  sourceIndex: number // Index in the nodes array
  targetIndex: number
  label?: string
  color?: string
}

export interface AppTemplate {
  id: string
  title: string
  description: string
  icon: string
  category: 'Tableros Edgeless' | 'Personal' | 'Trabajo' | 'Proyectos' | 'Creatividad'
  type: 'canvas' | 'doc'
  docContent?: string
  nodes?: CanvasTemplateNodeDef[]
  edges?: CanvasTemplateEdgeDef[]
}

export const APP_TEMPLATES: AppTemplate[] = [
  // --- AFFiNE Edgeless Canvas Templates ---
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

  // --- Document Templates ---
  {
    id: 'daily-journal',
    title: 'Diario Personal / Reflexión Diaria',
    description: 'Plantilla guiada para anotar metas, reflexiones, gratitud y balance del día.',
    icon: '📅',
    category: 'Personal',
    type: 'doc',
    docContent: `
      <h1>📅 Diario Personal: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h1>
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
    docContent: `
      <h1>👥 Minuta de Reunión: Proyecto Estratégico</h1>
      <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-ES')} | <strong>Moderador:</strong> Equipo | <strong>Duración:</strong> 45 min</p>

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
  }
]
