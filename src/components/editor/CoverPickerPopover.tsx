import React, { useState, useRef, useEffect } from 'react'
import {
  Palette,
  Image as ImageIcon,
  Type,
  Trash2,
  X,
  Upload,
  Sparkles,
  Check
} from 'lucide-react'
import { toast } from 'sonner'
import { processAndUploadImage } from '../../lib/imageOptimizer'

export interface CoverConfig {
  hasCover: boolean
  coverType: 'bannerText' | 'color' | 'gradient' | 'image'
  coverUrl?: string
  coverColor?: string
  coverBannerTitle?: string
  coverBannerSubtitle?: string
  coverBannerStyle?: 'minimal-light' | 'minimal-dark' | 'cream' | 'serif'
  coverPosition?: number
}

interface CoverPickerPopoverProps {
  isOpen: boolean
  onClose: () => void
  currentConfig?: CoverConfig
  onSelectCover: (config: CoverConfig) => void
  onRemoveCover: () => void
  noteTitle?: string
}

export const TYPOGRAPHY_PRESETS = [
  {
    id: 'projects-en',
    title: 'PROJECTS &',
    subtitle: 'SUB-PROJECTS',
    bg: '#ffffff',
    textColor: '#18181b',
    label: 'Projects & Sub-projects (Original)'
  },
  {
    id: 'projects-es',
    title: 'PROYECTOS &',
    subtitle: 'SUBPROYECTOS',
    bg: '#ffffff',
    textColor: '#18181b',
    label: 'Proyectos & Subproyectos'
  },
  {
    id: 'workspace-notes',
    title: 'WORKSPACE &',
    subtitle: 'DOCUMENTATION',
    bg: '#ffffff',
    textColor: '#18181b',
    label: 'Workspace & Documentation'
  },
  {
    id: 'ideas-creative',
    title: 'IDEAS &',
    subtitle: 'CREATIVITY',
    bg: '#faf8f5',
    textColor: '#292524',
    label: 'Ideas & Creativity (Arena)'
  },
  {
    id: 'goals-roadmap',
    title: 'GOALS &',
    subtitle: 'ROADMAP',
    bg: '#f0fdf4',
    textColor: '#14532d',
    label: 'Goals & Roadmap (Verde Suave)'
  },
  {
    id: 'noir-dark',
    title: 'PROJECTS &',
    subtitle: 'SUB-PROJECTS',
    bg: '#18181b',
    textColor: '#f4f4f5',
    label: 'Minimalist Noir (Oscuro)'
  }
]

export const GRADIENT_PRESETS = [
  { id: 'pure-white', label: 'Blanco Puro', gradient: '#ffffff' },
  { id: 'warm-cream', label: 'Crema Cálido', gradient: '#faf8f5' },
  { id: 'sunset', label: 'Sunset Glow', gradient: 'linear-gradient(135deg, #ffedd5 0%, #ffe4e6 50%, #fef3c7 100%)' },
  { id: 'ocean', label: 'Ocean Mist', gradient: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #e0e7ff 100%)' },
  { id: 'lavender', label: 'Lavanda Suave', gradient: 'linear-gradient(135deg, #ede9fe 0%, #fae8ff 50%, #f5f3ff 100%)' },
  { id: 'mint', label: 'Menta Fresca', gradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #f0fdf4 100%)' },
  { id: 'obsidian', label: 'Obsidian Dark', gradient: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)' }
]

export const AESTHETIC_IMAGES = [
  {
    id: 'arch-1',
    label: 'Minimalist Architecture',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80'
  },
  {
    id: 'workspace-1',
    label: 'Desk & Notebook',
    url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1600&q=80'
  },
  {
    id: 'nature-1',
    label: 'Foggy Forest',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80'
  },
  {
    id: 'abstract-1',
    label: 'Geometric Shadows',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80'
  }
]

export function CoverPickerPopover({
  isOpen,
  onClose,
  currentConfig,
  onSelectCover,
  onRemoveCover,
  noteTitle
}: CoverPickerPopoverProps) {
  const [activeTab, setActiveTab] = useState<'typography' | 'gradient' | 'image'>('typography')
  const [customTitle, setCustomTitle] = useState(currentConfig?.coverBannerTitle || 'PROJECTS &')
  const [customSubtitle, setCustomSubtitle] = useState(currentConfig?.coverBannerSubtitle || 'SUB-PROJECTS')
  const [customBg, setCustomBg] = useState(currentConfig?.coverColor || '#ffffff')
  const [customImageUrl, setCustomImageUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (currentConfig?.coverBannerTitle) {
      setCustomTitle(currentConfig.coverBannerTitle)
    } else if (noteTitle && noteTitle !== 'Untitled' && noteTitle !== 'Documento sin título') {
      // Suggest based on note title
      const upper = noteTitle.toUpperCase()
      if (upper.includes(' Y ')) {
        const parts = upper.split(' Y ')
        setCustomTitle(`${parts[0].trim()} &`)
        setCustomSubtitle(parts.slice(1).join(' ').trim())
      } else {
        setCustomTitle(upper)
        setCustomSubtitle('PROJECT')
      }
    }
    if (currentConfig?.coverBannerSubtitle) {
      setCustomSubtitle(currentConfig.coverBannerSubtitle)
    }
    if (currentConfig?.coverColor) {
      setCustomBg(currentConfig.coverColor)
    }
  }, [currentConfig, noteTitle, isOpen])

  if (!isOpen) return null

  const handleApplyPreset = (preset: typeof TYPOGRAPHY_PRESETS[0]) => {
    onSelectCover({
      hasCover: true,
      coverType: 'bannerText',
      coverBannerTitle: preset.title,
      coverBannerSubtitle: preset.subtitle,
      coverColor: preset.bg,
      coverBannerStyle: preset.bg === '#18181b' ? 'minimal-dark' : 'minimal-light'
    })
    toast.success('Portada aplicada')
    onClose()
  }

  const handleApplyCustomTypography = () => {
    onSelectCover({
      hasCover: true,
      coverType: 'bannerText',
      coverBannerTitle: customTitle.trim() || 'PROJECTS &',
      coverBannerSubtitle: customSubtitle.trim() || 'SUB-PROJECTS',
      coverColor: customBg,
      coverBannerStyle: customBg === '#18181b' ? 'minimal-dark' : 'minimal-light'
    })
    toast.success('Banner tipográfico aplicado')
    onClose()
  }

  const handleApplyGradient = (gradient: string) => {
    onSelectCover({
      hasCover: true,
      coverType: 'gradient',
      coverColor: gradient
    })
    toast.success('Color de portada aplicado')
    onClose()
  }

  const handleApplyImage = (url: string) => {
    onSelectCover({
      hasCover: true,
      coverType: 'image',
      coverUrl: url
    })
    toast.success('Imagen de portada aplicada')
    onClose()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setIsUploading(true)
      const result = await processAndUploadImage(file)
      handleApplyImage(result.url)
    } catch {
      toast.error('Error al subir la imagen')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col text-neutral-800 dark:text-neutral-100 max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Sparkles className="w-4 h-4 text-neutral-500" />
            <span>Portada de la Nota</span>
          </div>
          <div className="flex items-center gap-1">
            {currentConfig?.hasCover && (
              <button
                onClick={() => {
                  onRemoveCover()
                  toast.info('Portada eliminada')
                  onClose()
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Quitar</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
          <button
            onClick={() => setActiveTab('typography')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition ${
              activeTab === 'typography'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white bg-white dark:bg-[#18181b]'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Tipográfico (Estilo Imagen)</span>
          </button>
          <button
            onClick={() => setActiveTab('gradient')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition ${
              activeTab === 'gradient'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white bg-white dark:bg-[#18181b]'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Colores & Gradientes</span>
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition ${
              activeTab === 'image'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white bg-white dark:bg-[#18181b]'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Imágenes</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* TAB 1: TYPOGRAPHY (MATCHES USER IMAGE) */}
          {activeTab === 'typography' && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-medium text-neutral-500 block mb-2">
                  Estilos predeterminados (Inspirados en la captura)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {TYPOGRAPHY_PRESETS.map((preset) => {
                    const isSelected =
                      currentConfig?.coverType === 'bannerText' &&
                      currentConfig.coverBannerTitle === preset.title &&
                      currentConfig.coverBannerSubtitle === preset.subtitle &&
                      currentConfig.coverColor === preset.bg

                    return (
                      <button
                        key={preset.id}
                        onClick={() => handleApplyPreset(preset)}
                        className={`relative p-3.5 rounded-xl border text-left transition hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between h-24 ${
                          isSelected
                            ? 'ring-2 ring-neutral-900 dark:ring-white border-transparent shadow-md'
                            : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400'
                        }`}
                        style={{ backgroundColor: preset.bg }}
                      >
                        <div className="flex flex-col items-center justify-center w-full flex-1">
                          <span
                            className="font-serif italic tracking-[0.25em] text-xs uppercase font-light"
                            style={{ color: preset.textColor }}
                          >
                            {preset.title}
                          </span>
                          <span
                            className="font-serif italic tracking-[0.25em] text-xs uppercase font-light"
                            style={{ color: preset.textColor }}
                          >
                            {preset.subtitle}
                          </span>
                        </div>
                        <div className="flex items-center justify-between w-full pt-1">
                          <span className="text-[10px] text-neutral-500 truncate">{preset.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Custom Banner Editor */}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Personalizar texto del banner
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Línea 1 (Superior)</label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="PROJECTS &"
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs uppercase tracking-wider outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Línea 2 (Inferior)</label>
                    <input
                      type="text"
                      value={customSubtitle}
                      onChange={(e) => setCustomSubtitle(e.target.value)}
                      placeholder="SUB-PROJECTS"
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs uppercase tracking-wider outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1.5">Color de fondo del banner</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { hex: '#ffffff', label: 'Blanco' },
                      { hex: '#faf8f5', label: 'Crema' },
                      { hex: '#f3f4f6', label: 'Gris perla' },
                      { hex: '#f0fdf4', label: 'Menta' },
                      { hex: '#fef3c7', label: 'Arena' },
                      { hex: '#18181b', label: 'Noir' }
                    ].map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => setCustomBg(c.hex)}
                        className={`w-7 h-7 rounded-full border transition flex items-center justify-center ${
                          customBg === c.hex ? 'ring-2 ring-neutral-900 dark:ring-white scale-110' : 'border-neutral-300 dark:border-neutral-700'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      >
                        {customBg === c.hex && (
                          <Check className={`w-3 h-3 ${c.hex === '#18181b' ? 'text-white' : 'text-neutral-900'}`} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview Box */}
                <div
                  className="w-full h-20 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center p-2 transition shadow-xs"
                  style={{ backgroundColor: customBg }}
                >
                  <span
                    className="font-serif italic tracking-[0.25em] text-sm uppercase font-light"
                    style={{ color: customBg === '#18181b' ? '#f4f4f5' : '#18181b' }}
                  >
                    {customTitle || 'PROJECTS &'}
                  </span>
                  <span
                    className="font-serif italic tracking-[0.25em] text-sm uppercase font-light"
                    style={{ color: customBg === '#18181b' ? '#f4f4f5' : '#18181b' }}
                  >
                    {customSubtitle || 'SUB-PROJECTS'}
                  </span>
                </div>

                <button
                  onClick={handleApplyCustomTypography}
                  className="w-full py-2 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold shadow-md transition"
                >
                  Aplicar este banner personalizado
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: GRADIENTS / SOLID COLORS */}
          {activeTab === 'gradient' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {GRADIENT_PRESETS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleApplyGradient(g.gradient)}
                  className="group relative h-20 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-xs hover:shadow-md transition hover:scale-[1.02] flex items-end p-2"
                  style={{ background: g.gradient }}
                >
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-xs text-white">
                    {g.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* TAB 3: IMAGES */}
          {activeTab === 'image' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                {AESTHETIC_IMAGES.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => handleApplyImage(img.url)}
                    className="group relative h-24 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-xs hover:shadow-md transition hover:scale-[1.02] text-left"
                  >
                    <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-2">
                      <span className="text-[11px] text-white font-medium drop-shadow-xs">{img.label}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Upload or Custom URL */}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <span className="text-xs font-medium text-neutral-500 block">Imagen propia</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs outline-none"
                  />
                  <button
                    onClick={() => {
                      if (customImageUrl.trim()) handleApplyImage(customImageUrl.trim())
                    }}
                    disabled={!customImageUrl.trim()}
                    className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold disabled:opacity-40"
                  >
                    Usar URL
                  </button>
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-500 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploading ? 'Subiendo imagen...' : 'Subir archivo de imagen desde tu equipo'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
