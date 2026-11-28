import React, { useMemo, useState, useEffect, useCallback } from 'react'
import {
  FileText,
  Kanban,
  Eye,
  Lock,
  Star,
  ArrowLeft,
  ArrowSquareOut,
  SlidersHorizontal,
  X,
  Check,
  Plus,
  Trash,
  Sparkle,
  MagnifyingGlass,
  BookmarkSimple,
  CheckCircle
} from '@phosphor-icons/react'
import {
  type WorkspaceItem,
  type SpaceItem,
  DEFAULT_SPACE_ID,
  normalizeFolderPath
} from '../../db'
import { type TeamMember, isUserAdmin, isWorkspaceVisible } from '../../lib/teamAuth'
import { type DocumentReadSummary } from '../../lib/documentReads'
import {
  READING_HUB_CHANGED_EVENT,
  loadReadingHubConfig,
  toggleRecommendedFolder,
  toggleRecommendedNote,
  getFolderRefKey,
  type ReadingHubConfig
} from '../../lib/readingHubConfig'
import { PastelFolderIcon } from '../ui/PastelIcons'
import { AppleEmoji, renderWithAppleEmoji } from '../ui/AppleEmoji'
import { toast } from '../../lib/toast'

export interface PrivateReadingAnnotation {
  id: string
  text: string
  createdAt: number
}

export type PrivateAnnotationsMap = Record<string, PrivateReadingAnnotation[]>

export interface HomeReadHubProps {
  workspaces: WorkspaceItem[]
  spaces: SpaceItem[]
  currentSpaceId: string
  currentMember: TeamMember
  memberIdentityKeys: Set<string>
  readStatsMap: Record<string, DocumentReadSummary>
  privateAnnotations: PrivateAnnotationsMap
  onAddAnnotation: (docId: string, text: string) => void
  onDeleteAnnotation: (docId: string, annotationId: string) => void
  onPromoteAnnotations: (doc: WorkspaceItem, annotations: PrivateReadingAnnotation[]) => Promise<void>
  onSelectWorkspace: (id: string, spaceId?: string, workspaceItem?: WorkspaceItem) => void
}

function stripHtmlToPlainText(html?: string): string {
  if (!html) return ''
  return html
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function formatRelativeTime(ts?: number): string {
  if (!ts) return 'Reciente'
  const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000))
  if (diffSec < 60) return `hace ${diffSec} s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `hace ${diffHours} h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `hace ${diffDays} d`
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

interface FolderBundle {
  key: string
  spaceId: string
  spaceName: string
  folderPath: string
  leafName: string
  colorIndex?: number
  docs: WorkspaceItem[]
  readCount: number
  isAdminPicked: boolean
}

export const HomeReadHub: React.FC<HomeReadHubProps> = ({
  workspaces,
  spaces,
  currentMember,
  memberIdentityKeys,
  readStatsMap,
  privateAnnotations,
  onAddAnnotation,
  onDeleteAnnotation,
  onPromoteAnnotations,
  onSelectWorkspace
}) => {
  const isAdmin = isUserAdmin(currentMember)
  const [hubConfig, setHubConfig] = useState<ReadingHubConfig>(() => loadReadingHubConfig())
  const [openFolderKey, setOpenFolderKey] = useState<string | null>(null)
  const [hoveredFolderKey, setHoveredFolderKey] = useState<string | null>(null)
  const [notesDrawerDocId, setNotesDrawerDocId] = useState<string | null>(null)
  const [annotationDraft, setAnnotationDraft] = useState('')
  const [isPromoting, setIsPromoting] = useState(false)

  // Admin Organizer Modal state
  const [isOrganizerOpen, setIsOrganizerOpen] = useState(false)
  const [organizerTab, setOrganizerTab] = useState<'folders' | 'notes'>('folders')
  const [organizerSearch, setOrganizerSearch] = useState('')

  useEffect(() => {
    const onChange = () => setHubConfig(loadReadingHubConfig())
    window.addEventListener(READING_HUB_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(READING_HUB_CHANGED_EVENT, onChange)
  }, [])

  const spaceMap = useMemo(() => {
    const map = new Map<string, SpaceItem>()
    for (const s of spaces) map.set(s.id, s)
    return map
  }, [spaces])

  // Strictly accessible non-deleted workspaces for the current user
  const accessibleDocs = useMemo(() => {
    return workspaces.filter((w) => !w.isDeleted && isWorkspaceVisible(w, currentMember))
  }, [workspaces, currentMember])

  const hasUserReadDoc = useCallback(
    (doc: WorkspaceItem): boolean => {
      const localReaders = readStatsMap[doc.id]?.readerIds || []
      if (localReaders.some((id) => memberIdentityKeys.has(id))) return true
      if (Array.isArray(doc.viewedBy)) {
        return doc.viewedBy.some((v) =>
          memberIdentityKeys.has(String(v || '').toLowerCase().trim())
        )
      }
      return false
    },
    [readStatsMap, memberIdentityKeys]
  )

  // All accessible folders grouped across spaces
  const allAccessibleFolders = useMemo<FolderBundle[]>(() => {
    const map = new Map<string, FolderBundle>()
    const pickedKeys = new Set(
      hubConfig.recommendedFolders.map((f) => getFolderRefKey(f.spaceId, f.folderPath))
    )

    for (const doc of accessibleDocs) {
      const folderPath = normalizeFolderPath(doc.folder)
      if (!folderPath) continue
      const spaceId = doc.spaceId || DEFAULT_SPACE_ID
      const key = getFolderRefKey(spaceId, folderPath)
      let bundle = map.get(key)
      if (!bundle) {
        const space = spaceMap.get(spaceId)
        bundle = {
          key,
          spaceId,
          spaceName: space?.name || 'Espacio',
          folderPath,
          leafName: folderPath.split('/').pop() || folderPath,
          colorIndex: space?.folderColors?.[folderPath],
          docs: [],
          readCount: 0,
          isAdminPicked: pickedKeys.has(key)
        }
        map.set(key, bundle)
      }
      bundle.docs.push(doc)
      if (hasUserReadDoc(doc)) bundle.readCount++
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.isAdminPicked !== b.isAdminPicked) return a.isAdminPicked ? -1 : 1
      return b.docs.length - a.docs.length
    })
  }, [accessibleDocs, hubConfig.recommendedFolders, spaceMap, hasUserReadDoc])

  // Folders displayed in the big folder grid:
  // If admins configured specific folders, show those (only ones accessible to this user).
  // Otherwise, show top 8 folders with most notes as a smart default.
  const displayedFolders = useMemo(() => {
    const picked = allAccessibleFolders.filter((f) => f.isAdminPicked)
    if (picked.length > 0) return picked
    return allAccessibleFolders.slice(0, 8)
  }, [allAccessibleFolders])

  const hasAdminCuratedFolders = useMemo(
    () => allAccessibleFolders.some((f) => f.isAdminPicked),
    [allAccessibleFolders]
  )

  // Admin-curated individual recommended notes (filtered by user access)
  const adminRecommendedNotes = useMemo(() => {
    if (hubConfig.recommendedNoteIds.length === 0) return []
    const idSet = new Set(hubConfig.recommendedNoteIds)
    return accessibleDocs.filter((d) => idSet.has(d.id))
  }, [accessibleDocs, hubConfig.recommendedNoteIds])

  // Most-read accessible notes (prioritizing real read counts & non-empty content)
  const mostReadNotes = useMemo(() => {
    return accessibleDocs
      .map((doc) => {
        const stat = readStatsMap[doc.id]
        const viewedCount = Array.isArray(doc.viewedBy) ? doc.viewedBy.length : 0
        const totalReads = Math.max(stat?.totalReads || 0, viewedCount)
        const plainText = stripHtmlToPlainText(doc.docContent)
        const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0
        const readingMinutes = Math.max(1, Math.round(words / 200))
        return {
          doc,
          totalReads,
          plainText,
          words,
          readingMinutes,
          isReadByMe: hasUserReadDoc(doc),
          annotationsCount: (privateAnnotations[doc.id] || []).length,
          lastActivity: stat?.lastReadAt || doc.updatedAt || doc.createdAt || 0
        }
      })
      .sort((a, b) => {
        // Favor notes with actual content when read counts tie
        if (b.totalReads !== a.totalReads) return b.totalReads - a.totalReads
        const aHasText = a.words > 10 ? 1 : 0
        const bHasText = b.words > 10 ? 1 : 0
        if (bHasText !== aHasText) return bHasText - aHasText
        if (b.words !== a.words) return b.words - a.words
        return b.lastActivity - a.lastActivity
      })
      .slice(0, 9)
  }, [accessibleDocs, readStatsMap, hasUserReadDoc, privateAnnotations])

  const openFolder = useMemo(
    () => allAccessibleFolders.find((f) => f.key === openFolderKey) || null,
    [allAccessibleFolders, openFolderKey]
  )

  const drawerDoc = useMemo(
    () => accessibleDocs.find((d) => d.id === notesDrawerDocId) || null,
    [accessibleDocs, notesDrawerDocId]
  )

  const drawerAnnotations = useMemo(
    () => (drawerDoc ? privateAnnotations[drawerDoc.id] || [] : []),
    [drawerDoc, privateAnnotations]
  )

  const handleDrawerSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!drawerDoc || !annotationDraft.trim()) return
    onAddAnnotation(drawerDoc.id, annotationDraft.trim())
    setAnnotationDraft('')
  }

  const handleToggleFolderAdmin = (spaceId: string, folderPath: string) => {
    const next = toggleRecommendedFolder(spaceId, folderPath, currentMember.name)
    setHubConfig(next)
  }

  const handleToggleNoteAdmin = (noteId: string) => {
    const next = toggleRecommendedNote(noteId, currentMember.name)
    setHubConfig(next)
  }

  // Filtered lists inside Admin Organizer Modal
  const organizerFilteredFolders = useMemo(() => {
    const q = organizerSearch.trim().toLowerCase()
    if (!q) return allAccessibleFolders
    return allAccessibleFolders.filter(
      (f) =>
        f.leafName.toLowerCase().includes(q) ||
        f.folderPath.toLowerCase().includes(q) ||
        f.spaceName.toLowerCase().includes(q)
    )
  }, [allAccessibleFolders, organizerSearch])

  const organizerFilteredNotes = useMemo(() => {
    const q = organizerSearch.trim().toLowerCase()
    const list = q
      ? accessibleDocs.filter(
          (d) =>
            (d.title || '').toLowerCase().includes(q) ||
            (d.folder || '').toLowerCase().includes(q)
        )
      : accessibleDocs
    return [...list]
      .sort((a, b) => {
        const aPicked = hubConfig.recommendedNoteIds.includes(a.id) ? 1 : 0
        const bPicked = hubConfig.recommendedNoteIds.includes(b.id) ? 1 : 0
        if (bPicked !== aPicked) return bPicked - aPicked
        return (b.updatedAt || 0) - (a.updatedAt || 0)
      })
      .slice(0, 60)
  }, [accessibleDocs, organizerSearch, hubConfig.recommendedNoteIds])

  return (
    <div className="flex flex-col gap-7 pb-8">
      {/* ====================================================================
          SECTION 1: LARGE CURATED FOLDERS (Organized by Admins)
         ==================================================================== */}
      <section className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            {openFolder ? (
              <button
                type="button"
                onClick={() => setOpenFolderKey(null)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] px-2.5 py-1 rounded-lg bg-[var(--app-bg-overlay)]/80 border border-[var(--app-border-strong)] transition cursor-pointer"
              >
                <ArrowLeft size={13} />
                <span>Carpetas</span>
              </button>
            ) : null}

            <div>
              <h2 className="text-sm sm:text-[15px] font-semibold tracking-tight text-[var(--app-text-primary)]">
                {openFolder ? openFolder.leafName : 'Carpetas para leer'}
              </h2>
              <p className="text-[11px] text-[var(--app-text-muted)]">
                {openFolder
                  ? `${openFolder.spaceName} · ${openFolder.readCount} de ${openFolder.docs.length} leídas`
                  : hasAdminCuratedFolders
                  ? 'Seleccionadas por los administradores'
                  : 'Carpetas destacadas a las que tienes acceso'}
              </p>
            </div>
          </div>

          {isAdmin && !openFolder && (
            <button
              type="button"
              onClick={() => setIsOrganizerOpen(true)}
              className="h-8 px-3 rounded-lg bg-[var(--app-bg-overlay)]/88 hover:bg-[var(--app-hover)] border border-[var(--app-border-strong)] text-xs font-medium text-[var(--app-text-primary)] inline-flex items-center gap-1.5 transition cursor-pointer"
              style={{ boxShadow: 'inset 0 1px 0 var(--prism-specular)' }}
            >
              <SlidersHorizontal size={14} className="text-[var(--app-accent)]" />
              <span>Organizar lecturas</span>
            </button>
          )}
        </div>

        {/* Folder Interior View OR Large Folders Grid */}
        {openFolder ? (
          <div
            className="rounded-2xl bg-[var(--app-bg-overlay)]/85 backdrop-blur-xl border border-[var(--app-border-strong)] p-3 sm:p-4 flex flex-col gap-1.5"
            style={{
              backgroundImage: 'var(--prism-sheen)',
              boxShadow: 'inset 0 1px 0 var(--prism-specular), 0 12px 32px -12px rgba(0,0,0,0.3)'
            }}
          >
            {openFolder.docs
              .slice()
              .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
              .map((doc) => {
                const isRead = hasUserReadDoc(doc)
                const annCount = (privateAnnotations[doc.id] || []).length
                const plain = stripHtmlToPlainText(doc.docContent)
                const mins = Math.max(1, Math.round((plain ? plain.split(/\s+/).length : 0) / 200))
                return (
                  <div
                    key={doc.id}
                    onClick={() => onSelectWorkspace(doc.id, doc.spaceId, doc)}
                    className="group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--app-hover)] border border-transparent hover:border-[var(--app-border)] transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="shrink-0 text-[var(--app-text-secondary)] flex items-center">
                        {doc.icon ? (
                          <AppleEmoji emoji={doc.icon} size={16} />
                        ) : doc.viewMode === 'canvas' ? (
                          <Kanban size={16} />
                        ) : (
                          <FileText size={16} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-[13px] font-medium text-[var(--app-text-primary)] truncate">
                            {renderWithAppleEmoji(doc.title || 'Sin título')}
                          </span>
                          {isRead ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-500/90 shrink-0">
                              <CheckCircle size={11} weight="fill" />
                              Leída
                            </span>
                          ) : (
                            <span className="text-[10px] text-[var(--app-text-muted)] shrink-0">
                              Pendiente
                            </span>
                          )}
                        </div>
                        {plain && (
                          <p className="text-[11px] text-[var(--app-text-muted)] truncate mt-0.5">
                            {plain.slice(0, 110)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="hidden sm:inline text-[10.5px] text-[var(--app-text-muted)] tabular-nums">
                        ~{mins} min
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setNotesDrawerDocId(doc.id)
                        }}
                        className={`h-7 px-2 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1 transition cursor-pointer ${
                          annCount > 0
                            ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)]/35 text-[var(--app-accent)]'
                            : 'bg-transparent border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:border-[var(--app-border-strong)]'
                        }`}
                        title="Apuntes privados sobre esta nota"
                      >
                        <Lock size={11} weight={annCount > 0 ? 'fill' : 'regular'} />
                        <span>{annCount > 0 ? annCount : 'Apuntes'}</span>
                      </button>
                    </div>
                  </div>
                )
              })}
          </div>
        ) : displayedFolders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] p-8 text-center text-xs text-[var(--app-text-muted)]">
            No hay carpetas disponibles todavía.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {displayedFolders.map((folder) => {
              const pct =
                folder.docs.length > 0
                  ? Math.round((folder.readCount / folder.docs.length) * 100)
                  : 0
              const isHovered = hoveredFolderKey === folder.key
              return (
                <button
                  key={folder.key}
                  type="button"
                  onClick={() => setOpenFolderKey(folder.key)}
                  onMouseEnter={() => setHoveredFolderKey(folder.key)}
                  onMouseLeave={() => setHoveredFolderKey(null)}
                  className="group relative text-left rounded-2xl bg-[var(--app-bg-overlay)]/82 hover:bg-[var(--app-bg-overlay)]/96 backdrop-blur-xl border border-[var(--app-border)] hover:border-[var(--app-border-strong)] p-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                  style={{
                    backgroundImage: 'var(--prism-sheen)',
                    boxShadow:
                      'inset 0 1px 0 var(--prism-specular), 0 10px 28px -12px rgba(0, 0, 0, 0.28)'
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="transition-transform duration-200 group-hover:scale-105">
                      <PastelFolderIcon
                        name={folder.leafName}
                        colorIndex={folder.colorIndex}
                        size={52}
                        open={isHovered}
                      />
                    </div>
                    <span className="text-[10.5px] font-medium tabular-nums text-[var(--app-text-muted)] px-1.5 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.04]">
                      {folder.docs.length} {folder.docs.length === 1 ? 'nota' : 'notas'}
                    </span>
                  </div>

                  <div className="min-w-0 flex flex-col gap-0.5">
                    <div className="text-[13.5px] font-semibold text-[var(--app-text-primary)] truncate">
                      {folder.leafName}
                    </div>
                    <div className="text-[11px] text-[var(--app-text-muted)] truncate">
                      {folder.spaceName}
                    </div>
                  </div>

                  {/* Subtle reading progress footer */}
                  <div className="flex flex-col gap-1 pt-0.5 mt-auto">
                    <div className="flex items-center justify-between text-[10px] text-[var(--app-text-muted)] tabular-nums">
                      <span>
                        {folder.readCount}/{folder.docs.length} leídas
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-[2px] w-full rounded-full bg-black/[0.08] dark:bg-white/[0.08] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--app-text-primary)]/60 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ====================================================================
          SECTION 2: ADMIN-RECOMMENDED INDIVIDUAL NOTES (if configured)
         ==================================================================== */}
      {adminRecommendedNotes.length > 0 && !openFolder && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-[15px] font-semibold tracking-tight text-[var(--app-text-primary)]">
                Lecturas imprescindibles
              </h2>
              <p className="text-[11px] text-[var(--app-text-muted)]">
                Notas marcadas por los administradores para leer
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {adminRecommendedNotes.map((doc) => {
              const isRead = hasUserReadDoc(doc)
              const annCount = (privateAnnotations[doc.id] || []).length
              const spaceName = spaceMap.get(doc.spaceId || DEFAULT_SPACE_ID)?.name || 'Espacio'
              const plain = stripHtmlToPlainText(doc.docContent)
              return (
                <div
                  key={doc.id}
                  onClick={() => onSelectWorkspace(doc.id, doc.spaceId, doc)}
                  className="group rounded-2xl bg-[var(--app-bg-overlay)]/84 hover:bg-[var(--app-bg-overlay)]/96 backdrop-blur-xl border border-[var(--app-border-strong)] p-3.5 flex flex-col justify-between gap-2.5 transition cursor-pointer"
                  style={{
                    backgroundImage: 'var(--prism-sheen)',
                    boxShadow: 'inset 0 1px 0 var(--prism-specular)'
                  }}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 text-[var(--app-text-secondary)]">
                          {doc.icon ? (
                            <AppleEmoji emoji={doc.icon} size={15} />
                          ) : (
                            <BookmarkSimple size={15} weight="duotone" className="text-[var(--app-accent)]" />
                          )}
                        </span>
                        <span className="text-xs sm:text-[13px] font-semibold text-[var(--app-text-primary)] truncate">
                          {renderWithAppleEmoji(doc.title || 'Sin título')}
                        </span>
                      </div>
                      {isRead ? (
                        <CheckCircle size={13} weight="fill" className="text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-[var(--app-accent)] shrink-0 mt-1.5" />
                      )}
                    </div>
                    {plain && (
                      <p className="text-[11px] text-[var(--app-text-secondary)] line-clamp-2 leading-relaxed">
                        {plain}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--app-border)] text-[10.5px] text-[var(--app-text-muted)]">
                    <span className="truncate">{spaceName}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setNotesDrawerDocId(doc.id)
                      }}
                      className="inline-flex items-center gap-1 hover:text-[var(--app-text-primary)] transition cursor-pointer shrink-0"
                    >
                      <Lock size={11} weight={annCount > 0 ? 'fill' : 'regular'} />
                      <span>{annCount > 0 ? `${annCount} apuntes` : 'Apuntes'}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ====================================================================
          SECTION 3: MOST-READ ACCESSIBLE NOTES
         ==================================================================== */}
      {!openFolder && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-[15px] font-semibold tracking-tight text-[var(--app-text-primary)]">
                Más leídas
              </h2>
              <p className="text-[11px] text-[var(--app-text-muted)]">
                Notas con mayor lectura a las que tienes acceso
              </p>
            </div>
            <span className="text-[11px] text-[var(--app-text-muted)] tabular-nums">
              {mostReadNotes.length} notas
            </span>
          </div>

          {mostReadNotes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] p-8 text-center text-xs text-[var(--app-text-muted)]">
              Todavía no hay lecturas registradas.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {mostReadNotes.map((item) => {
                const spaceName =
                  spaceMap.get(item.doc.spaceId || DEFAULT_SPACE_ID)?.name || 'Espacio'
                const folder = normalizeFolderPath(item.doc.folder)
                return (
                  <div
                    key={item.doc.id}
                    onClick={() => onSelectWorkspace(item.doc.id, item.doc.spaceId, item.doc)}
                    className="group rounded-2xl bg-[var(--app-bg-overlay)]/78 hover:bg-[var(--app-bg-overlay)]/95 backdrop-blur-xl border border-[var(--app-border)] hover:border-[var(--app-border-strong)] p-3.5 flex flex-col justify-between gap-2.5 transition cursor-pointer"
                    style={{
                      backgroundImage: 'var(--prism-sheen)',
                      boxShadow: 'inset 0 1px 0 var(--prism-specular)'
                    }}
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 text-[var(--app-text-secondary)]">
                            {item.doc.icon ? (
                              <AppleEmoji emoji={item.doc.icon} size={15} />
                            ) : item.doc.viewMode === 'canvas' ? (
                              <Kanban size={15} />
                            ) : (
                              <FileText size={15} />
                            )}
                          </span>
                          <span className="text-xs sm:text-[13px] font-semibold text-[var(--app-text-primary)] truncate">
                            {renderWithAppleEmoji(item.doc.title || 'Sin título')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 text-[10.5px] text-[var(--app-text-muted)] tabular-nums">
                          {item.doc.isFavorite && (
                            <Star size={11} weight="fill" className="text-amber-400" />
                          )}
                          <Eye size={12} />
                          <span>{item.totalReads}</span>
                        </div>
                      </div>

                      {item.plainText ? (
                        <p className="text-[11px] text-[var(--app-text-secondary)] line-clamp-2 leading-relaxed">
                          {item.plainText}
                        </p>
                      ) : (
                        <p className="text-[11px] italic text-[var(--app-text-muted)]">
                          Sin vista previa de texto
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--app-border)] text-[10.5px] text-[var(--app-text-muted)]">
                      <span className="truncate">
                        {spaceName}
                        {folder ? ` · ${folder.split('/').pop()}` : ''}
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="tabular-nums">~{item.readingMinutes}m</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setNotesDrawerDocId(item.doc.id)
                          }}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md transition cursor-pointer ${
                            item.annotationsCount > 0
                              ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-medium'
                              : 'hover:bg-[var(--app-hover)] hover:text-[var(--app-text-primary)]'
                          }`}
                          title="Tomar apuntes privados sobre esta nota"
                        >
                          <Lock size={11} weight={item.annotationsCount > 0 ? 'fill' : 'regular'} />
                          {item.annotationsCount > 0 && <span>{item.annotationsCount}</span>}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ====================================================================
          PRIVATE ANNOTATIONS DRAWER / MODAL (clean on-demand overlay)
         ==================================================================== */}
      {drawerDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setNotesDrawerDocId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[520px] rounded-2xl bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] p-5 flex flex-col gap-4 shadow-2xl"
            style={{
              backgroundImage: 'var(--prism-sheen)',
              boxShadow: 'inset 0 1px 0 var(--prism-specular), 0 24px 60px -12px rgba(0,0,0,0.55)'
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Lock size={14} weight="fill" className="text-[var(--app-accent)] shrink-0" />
                  <h3 className="text-sm font-semibold text-[var(--app-text-primary)] truncate">
                    Apuntes privados · {renderWithAppleEmoji(drawerDoc.title || 'Sin título')}
                  </h3>
                </div>
                <p className="text-[11px] text-[var(--app-text-muted)] mt-0.5">
                  Solo tú puedes ver estos apuntes
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const target = drawerDoc
                    setNotesDrawerDocId(null)
                    onSelectWorkspace(target.id, target.spaceId, target)
                  }}
                  className="h-7 px-2.5 rounded-lg bg-[var(--app-hover)] hover:bg-[var(--app-active)] text-[11px] font-medium text-[var(--app-text-primary)] inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowSquareOut size={12} />
                  <span>Abrir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNotesDrawerDocId(null)}
                  aria-label="Cerrar apuntes"
                  className="p-1.5 rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <form onSubmit={handleDrawerSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={annotationDraft}
                onChange={(e) => setAnnotationDraft(e.target.value)}
                placeholder="Escribe un apunte privado..."
                autoFocus
                className="flex-1 h-9 px-3 rounded-xl bg-[var(--app-bg-secondary)] border border-[var(--app-border-strong)] text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] outline-none focus:border-[var(--app-accent)]"
              />
              <button
                type="submit"
                disabled={!annotationDraft.trim()}
                className="h-9 px-3.5 rounded-xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
              >
                <Plus size={13} weight="bold" />
                <span>Guardar</span>
              </button>
            </form>

            <div className="flex flex-col gap-1.5 max-h-[240px] overflow-y-auto custom-scrollbar pr-0.5">
              {drawerAnnotations.length === 0 ? (
                <p className="text-xs text-[var(--app-text-muted)] text-center py-6">
                  Aún no tienes apuntes privados en esta nota.
                </p>
              ) : (
                drawerAnnotations.map((note) => (
                  <div
                    key={note.id}
                    className="group flex items-start justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--app-bg-secondary)]/80 border border-[var(--app-border)] select-text"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[var(--app-text-primary)] leading-relaxed break-words">
                        {note.text}
                      </p>
                      <span className="text-[10px] text-[var(--app-text-muted)]">
                        {formatRelativeTime(note.createdAt)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteAnnotation(drawerDoc.id, note.id)}
                      aria-label="Eliminar apunte"
                      className="p-1 rounded-md text-[var(--app-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {drawerAnnotations.length > 0 && (
              <div className="flex justify-end pt-2 border-t border-[var(--app-border)]">
                <button
                  type="button"
                  disabled={isPromoting}
                  onClick={async () => {
                    setIsPromoting(true)
                    try {
                      await onPromoteAnnotations(drawerDoc, drawerAnnotations)
                      setNotesDrawerDocId(null)
                    } finally {
                      setIsPromoting(false)
                    }
                  }}
                  className="text-xs font-medium text-[var(--app-accent)] hover:underline inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkle size={12} weight="fill" />
                  <span>Convertir en nota privada</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          ADMIN ORGANIZER MODAL (Only accessible to Admins)
         ==================================================================== */}
      {isAdmin && isOrganizerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsOrganizerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[560px] rounded-2xl bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] p-5 flex flex-col gap-4 shadow-2xl"
            style={{
              backgroundImage: 'var(--prism-sheen)',
              boxShadow: 'inset 0 1px 0 var(--prism-specular), 0 24px 60px -12px rgba(0,0,0,0.55)'
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">
                  Organizar lecturas del equipo
                </h3>
                <p className="text-[11px] text-[var(--app-text-muted)] mt-0.5">
                  Elige qué carpetas y notas aparecerán destacadas en el modo Leer. Cada usuario solo verá aquellas a las que tenga acceso.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOrganizerOpen(false)}
                aria-label="Cerrar"
                className="p-1.5 rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Tabs + Search */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)]">
                <button
                  type="button"
                  onClick={() => setOrganizerTab('folders')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                    organizerTab === 'folders'
                      ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]'
                  }`}
                >
                  Carpetas ({hubConfig.recommendedFolders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOrganizerTab('notes')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                    organizerTab === 'notes'
                      ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]'
                  }`}
                >
                  Notas ({hubConfig.recommendedNoteIds.length})
                </button>
              </div>

              <div className="relative flex-1 min-w-[180px]">
                <MagnifyingGlass
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]"
                />
                <input
                  type="text"
                  value={organizerSearch}
                  onChange={(e) => setOrganizerSearch(e.target.value)}
                  placeholder={
                    organizerTab === 'folders' ? 'Buscar carpetas...' : 'Buscar notas...'
                  }
                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border-strong)] text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>
            </div>

            {/* Checklist */}
            <div className="flex flex-col gap-1 max-h-[310px] overflow-y-auto custom-scrollbar pr-0.5">
              {organizerTab === 'folders'
                ? organizerFilteredFolders.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => handleToggleFolderAdmin(f.spaceId, f.folderPath)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-left transition cursor-pointer ${
                        f.isAdminPicked
                          ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)]/40'
                          : 'bg-[var(--app-bg-secondary)]/55 border-[var(--app-border)] hover:bg-[var(--app-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PastelFolderIcon name={f.leafName} colorIndex={f.colorIndex} size={22} />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[var(--app-text-primary)] truncate">
                            {f.leafName}
                          </div>
                          <div className="text-[10.5px] text-[var(--app-text-muted)] truncate">
                            {f.spaceName} · {f.docs.length} notas
                          </div>
                        </div>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                          f.isAdminPicked
                            ? 'bg-[var(--app-accent)] border-[var(--app-accent)] text-white'
                            : 'border-[var(--app-border-strong)]'
                        }`}
                      >
                        {f.isAdminPicked && <Check size={12} weight="bold" />}
                      </span>
                    </button>
                  ))
                : organizerFilteredNotes.map((doc) => {
                    const picked = hubConfig.recommendedNoteIds.includes(doc.id)
                    const spaceName = spaceMap.get(doc.spaceId || DEFAULT_SPACE_ID)?.name || 'Espacio'
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => handleToggleNoteAdmin(doc.id)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-left transition cursor-pointer ${
                          picked
                            ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)]/40'
                            : 'bg-[var(--app-bg-secondary)]/55 border-[var(--app-border)] hover:bg-[var(--app-hover)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="shrink-0 text-[var(--app-text-secondary)]">
                            {doc.icon ? (
                              <AppleEmoji emoji={doc.icon} size={15} />
                            ) : (
                              <FileText size={15} />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-[var(--app-text-primary)] truncate">
                              {renderWithAppleEmoji(doc.title || 'Sin título')}
                            </div>
                            <div className="text-[10.5px] text-[var(--app-text-muted)] truncate">
                              {spaceName}
                              {doc.folder ? ` · ${doc.folder}` : ''}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                            picked
                              ? 'bg-[var(--app-accent)] border-[var(--app-accent)] text-white'
                              : 'border-[var(--app-border-strong)]'
                          }`}
                        >
                          {picked && <Check size={12} weight="bold" />}
                        </span>
                      </button>
                    )
                  })}
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--app-border)]">
              <button
                type="button"
                onClick={() => {
                  setIsOrganizerOpen(false)
                  toast.success('Lecturas recomendadas actualizadas')
                }}
                className="h-8 px-4 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white text-xs font-medium transition cursor-pointer"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
