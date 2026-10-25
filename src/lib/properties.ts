import {
  Tag,
  FileText,
  Calendar,
  Layers,
  Clock,
  RefreshCw,
  User,
  Sliders,
  Maximize2,
  Type,
  Hash,
  CheckSquare,
  HelpCircle,
  type LucideIcon
} from 'lucide-react'

export type PropertyVisibility = 'always_show' | 'always_hide' | 'hide_empty'

export interface PropertyDefinition {
  id: string
  name: string
  icon: LucideIcon
  type: 'tag' | 'select' | 'boolean' | 'date' | 'text' | 'number' | 'readonly' | 'user'
  defaultVisibility: PropertyVisibility
}

export const BUILT_IN_PROPERTIES: PropertyDefinition[] = [
  {
    id: 'tags',
    name: 'Etiquetas',
    icon: Tag,
    type: 'tag',
    defaultVisibility: 'always_show'
  },
  {
    id: 'documentMode',
    name: 'Modo de documento',
    icon: FileText,
    type: 'select',
    defaultVisibility: 'always_hide'
  },
  {
    id: 'isJournal',
    name: 'Diario',
    icon: Calendar,
    type: 'boolean',
    defaultVisibility: 'always_hide'
  },
  {
    id: 'templateName',
    name: 'Plantilla',
    icon: Layers,
    type: 'select',
    defaultVisibility: 'always_hide'
  },
  {
    id: 'createdAt',
    name: 'Creado',
    icon: Clock,
    type: 'readonly',
    defaultVisibility: 'always_show'
  },
  {
    id: 'updatedAt',
    name: 'Actualizado',
    icon: RefreshCw,
    type: 'readonly',
    defaultVisibility: 'always_show'
  },
  {
    id: 'createdBy',
    name: 'Creado por',
    icon: User,
    type: 'user',
    defaultVisibility: 'always_hide'
  },
  {
    id: 'lastEditedBy',
    name: 'Última edición por',
    icon: User,
    type: 'user',
    defaultVisibility: 'always_hide'
  },
  {
    id: 'borderlessTheme',
    name: 'Tema sin bordes',
    icon: Sliders,
    type: 'boolean',
    defaultVisibility: 'always_hide'
  },
  {
    id: 'pageWidth',
    name: 'Ancho de página',
    icon: Maximize2,
    type: 'select',
    defaultVisibility: 'always_hide'
  }
]

export interface AvailablePropertyToAdd {
  id: string
  name: string
  icon: LucideIcon
  type: string
  isCustom?: boolean
}

export const ADDABLE_PROPERTIES: AvailablePropertyToAdd[] = [
  { id: 'tags', name: 'Etiquetas', icon: Tag, type: 'tag' },
  { id: 'custom_text', name: 'Texto', icon: Type, type: 'text', isCustom: true },
  { id: 'custom_number', name: 'Número', icon: Hash, type: 'number', isCustom: true },
  { id: 'custom_checkbox', name: 'Casilla de verificación', icon: CheckSquare, type: 'checkbox', isCustom: true },
  { id: 'custom_date', name: 'Fecha', icon: Calendar, type: 'date', isCustom: true },
  { id: 'createdBy', name: 'Creado por', icon: User, type: 'user' },
  { id: 'lastEditedBy', name: 'Última edición por', icon: User, type: 'user' },
  { id: 'updatedAt', name: 'Actualizado', icon: RefreshCw, type: 'readonly' },
  { id: 'createdAt', name: 'Creado', icon: Clock, type: 'readonly' },
  { id: 'documentMode', name: 'Modo de documento', icon: FileText, type: 'select' },
  { id: 'isJournal', name: 'Diario', icon: Calendar, type: 'boolean' },
  { id: 'borderlessTheme', name: 'Tema sin bordes', icon: Sliders, type: 'boolean' },
  { id: 'pageWidth', name: 'Ancho de página', icon: Maximize2, type: 'select' },
  { id: 'templateName', name: 'Plantilla', icon: Layers, type: 'select' },
  { id: 'custom_unknown', name: 'Unknown', icon: HelpCircle, type: 'unknown', isCustom: true }
]

export const VISIBILITY_LABELS: Record<PropertyVisibility, string> = {
  always_show: 'Siempre mostrar',
  always_hide: 'Siempre ocultar',
  hide_empty: 'Ocultar cuando esté vacío'
}
