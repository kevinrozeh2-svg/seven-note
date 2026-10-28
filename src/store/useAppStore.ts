import { create } from 'zustand'

export type RightSidebarTab = 'properties' | 'outline' | 'ai' | 'history'

interface AppState {
  // Theme
  darkMode: boolean
  toggleDarkMode: () => void
  setDarkMode: (val: boolean) => void

  // Layout & Sidebars
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  toggleSidebar: () => void

  rightSidebarOpen: boolean
  setRightSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  toggleRightSidebar: () => void

  rightSidebarTab: RightSidebarTab
  setRightSidebarTab: (tab: RightSidebarTab) => void

  // Presentation Mode
  isPresentationMode: boolean
  presentationFrameId?: string
  startPresentation: (frameId?: string) => void
  exitPresentation: () => void

  // Modals
  isCommandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void

  isSettingsOpen: boolean
  setSettingsOpen: (open: boolean) => void

  isTrashOpen: boolean
  setTrashOpen: (open: boolean) => void

  isShareOpen: boolean
  setShareOpen: (open: boolean) => void

  isTemplatesOpen: boolean
  setTemplatesOpen: (open: boolean) => void

  isAIOpen: boolean
  setAIOpen: (open: boolean) => void

  isAllDocsOpen: boolean
  setAllDocsOpen: (open: boolean) => void

  isImportOpen: boolean
  setImportOpen: (open: boolean) => void

  isShortcutsOpen: boolean
  setShortcutsOpen: (open: boolean) => void

  isCreateWorkspaceOpen: boolean
  setCreateWorkspaceOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Theme
  darkMode: localStorage.getItem('seven_note_theme') !== 'light',
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.darkMode
      localStorage.setItem('seven_note_theme', next ? 'dark' : 'light')
      if (next) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      return { darkMode: next }
    }),
  setDarkMode: (val: boolean) => {
    localStorage.setItem('seven_note_theme', val ? 'dark' : 'light')
    if (val) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    set({ darkMode: val })
  },

  // Layout
  sidebarOpen: false,
  setSidebarOpen: (open) =>
    set((state) => ({
      sidebarOpen: typeof open === 'function' ? open(state.sidebarOpen) : open
    })),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  rightSidebarOpen: false,
  setRightSidebarOpen: (open) =>
    set((state) => ({
      rightSidebarOpen: typeof open === 'function' ? open(state.rightSidebarOpen) : open
    })),
  toggleRightSidebar: () => set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),

  rightSidebarTab: 'properties',
  setRightSidebarTab: (tab) => set({ rightSidebarTab: tab }),

  // Presentation
  isPresentationMode: false,
  presentationFrameId: undefined,
  startPresentation: (frameId) =>
    set({ isPresentationMode: true, presentationFrameId: frameId }),
  exitPresentation: () =>
    set({ isPresentationMode: false, presentationFrameId: undefined }),

  // Modals
  isCommandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),

  isSettingsOpen: false,
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  isTrashOpen: false,
  setTrashOpen: (open) => set({ isTrashOpen: open }),

  isShareOpen: false,
  setShareOpen: (open) => set({ isShareOpen: open }),

  isTemplatesOpen: false,
  setTemplatesOpen: (open) => set({ isTemplatesOpen: open }),

  isAIOpen: false,
  setAIOpen: (open) => set({ isAIOpen: open }),

  isAllDocsOpen: false,
  setAllDocsOpen: (open) => set({ isAllDocsOpen: open }),

  isImportOpen: false,
  setImportOpen: (open) => set({ isImportOpen: open }),

  isShortcutsOpen: false,
  setShortcutsOpen: (open) => set({ isShortcutsOpen: open }),

  isCreateWorkspaceOpen: false,
  setCreateWorkspaceOpen: (open) => set({ isCreateWorkspaceOpen: open })
}))
