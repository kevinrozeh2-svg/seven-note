import { useState } from 'react'
import {
  X,
  Layers
} from 'lucide-react'

interface TemplateItem {
  id: string
  title: string
  description: string
  icon: string
  category: string
  content: string
}

const PREBUILT_TEMPLATES: TemplateItem[] = [
  {
    id: 'daily-journal',
    title: 'Diario Personal / Reflexión Diaria',
    description: 'Plantilla guiada para anotar metas, reflexiones, gratitud y balance del día.',
    icon: '📅',
    category: 'Personal',
    content: `
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
    content: `
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
    content: `
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
  {
    id: 'brainstorming',
    title: 'Lluvia de Ideas / Brainstorming',
    description: 'Espacio libre para aterrizar conceptos, explorar hipótesis y contrastar opciones.',
    icon: '💡',
    category: 'Creatividad',
    content: `
      <h1>💡 Sesión de Brainstorming & Nuevas Ideas</h1>
      <p><em>Sin filtros iniciales: todas las ideas son bienvenidas para luego seleccionar las mejores.</em></p>

      <h3>🔥 Ideas en Bruto</h3>
      <ul>
        <li>Idea A: Integración de comandos rápidos tipo slash menu (/).</li>
        <li>Idea B: Modo edgeless infinito para crear mapas conceptuales.</li>
        <li>Idea C: Exportación automática a PDF y Markdown con estilos personalizados.</li>
      </ul>

      <h3>⚖️ Evaluación & Pros / Contras</h3>
      <p>Analizar factibilidad técnica, valor para el usuario y tiempo estimado de desarrollo.</p>
    `
  }
]

interface TemplatesModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: TemplateItem) => void
}

export function TemplatesModal({ isOpen, onClose, onSelectTemplate }: TemplatesModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas')

  if (!isOpen) return null

  const categories = ['Todas', 'Personal', 'Trabajo', 'Proyectos', 'Creatividad']

  const filtered = selectedCategory === 'Todas'
    ? PREBUILT_TEMPLATES
    : PREBUILT_TEMPLATES.filter((t) => t.category === selectedCategory)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[#18181b] border border-[#27272a] rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#27272a] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Galería de Plantillas</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Categories Pills */}
        <div className="px-5 py-2.5 border-b border-[#27272a] flex gap-1.5 overflow-x-auto shrink-0 bg-[#141416]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition shrink-0 ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#222226] text-zinc-400 hover:text-zinc-200 hover:bg-[#2a2a30]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Templates List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className="p-4 rounded-xl bg-[#141416] border border-[#27272a] hover:border-[#3f3f46] hover:bg-[#1a1a1e] transition cursor-pointer flex items-start gap-4 group"
              onClick={() => {
                onSelectTemplate(tpl)
                onClose()
              }}
            >
              <span className="text-3xl p-2 rounded-lg bg-[#222226] shrink-0">{tpl.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-zinc-100 group-hover:text-blue-400 transition text-sm">
                    {tpl.title}
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#27272a] text-zinc-400">
                    {tpl.category}
                  </span>
                </div>
                <p className="text-zinc-400 mt-1 leading-relaxed">
                  {tpl.description}
                </p>
                <div className="mt-3 flex justify-end">
                  <button className="px-3 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-md font-medium text-xs transition">
                    Usar esta plantilla
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
