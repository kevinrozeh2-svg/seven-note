import { useState, useEffect } from 'react'
import { db, type WorkspaceItem, type SpaceItem } from '../db'
import { type TeamMember, getCurrentMember } from './teamAuth'

export const UNREAD_CHANGED_EVENT = 'seven_note_unread_changed'

/**
 * Returns a set of IDs viewed locally by the given member/user.
 */
export function getLocalViewedIds(type: 'workspace' | 'space', identifier?: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  const key = `seven_note_viewed_${type}_${(identifier || 'guest').toLowerCase().trim()}`
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return new Set(arr)
    }
  } catch (e) {
    // ignore
  }
  return new Set()
}

/**
 * Persists an item ID into the user's local viewed storage.
 */
export function saveLocalViewedId(type: 'workspace' | 'space', id: string, identifier?: string) {
  if (typeof window === 'undefined' || !id) return
  const key = `seven_note_viewed_${type}_${(identifier || 'guest').toLowerCase().trim()}`
  try {
    const set = getLocalViewedIds(type, identifier)
    if (!set.has(id)) {
      set.add(id)
      localStorage.setItem(key, JSON.stringify(Array.from(set)))
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Checks whether an item (note or workspace space) is unread ("New") for the given user.
 * 
 * Rules:
 * 1. The creator of the item NEVER sees "New".
 * 2. Pre-existing legacy items created before tracking do NOT show "New".
 * 3. Any item created by other users shows "New" until the user enters it.
 */
export function isItemUnread(
  item: WorkspaceItem | SpaceItem | undefined | null,
  type: 'workspace' | 'space',
  currentMember?: TeamMember | null,
  authUserId?: string | null
): boolean {
  if (!item) return false

  // Deleted items do not show as new
  if (item.isDeleted) return false

  // Ignore default static demo workspaces/pages
  if (item.id === 'default-workspace' || item.id === 'ws-feature-priorities') return false

  // Must be marked as new or have viewedBy list
  if (!item.isNewItem && (!item.viewedBy || item.viewedBy.length === 0)) {
    return false
  }

  const member = currentMember || getCurrentMember()
  const memberId = (member?.id || '').toLowerCase().trim()
  const memberName = (member?.name || member?.fullName || '').toLowerCase().trim()
  const memberEmail = (member?.email || '').toLowerCase().trim()
  const authId = (authUserId || '').toLowerCase().trim()

  // 1. Is the current user the creator?
  const itemOwner = (item.ownerMember || '').toLowerCase().trim()
  const itemCreatedBy = (item.createdBy || '').toLowerCase().trim()
  const itemUserId = (item.userId || '').toLowerCase().trim()

  const isCreator =
    (itemOwner && (itemOwner === memberId || (memberEmail && itemOwner === memberEmail))) ||
    (itemCreatedBy && (itemCreatedBy === memberId || itemCreatedBy === memberName || (memberEmail && itemCreatedBy === memberEmail))) ||
    (itemUserId && (itemUserId === authId || itemUserId === memberId))

  if (isCreator) {
    return false
  }

  // 2. Has the user already marked it as viewed in local storage?
  if (memberId && getLocalViewedIds(type, memberId).has(item.id)) return false
  if (memberEmail && getLocalViewedIds(type, memberEmail).has(item.id)) return false
  if (authId && getLocalViewedIds(type, authId).has(item.id)) return false

  // 3. Is the user present in the item's viewedBy array?
  if (Array.isArray(item.viewedBy) && item.viewedBy.length > 0) {
    const list = item.viewedBy.map((v: string) => (v || '').toLowerCase().trim())
    if (
      (memberId && list.includes(memberId)) ||
      (memberName && list.includes(memberName)) ||
      (memberEmail && list.includes(memberEmail)) ||
      (authId && list.includes(authId))
    ) {
      return false
    }
  }

  // Item is unread for this user!
  return true
}

/**
 * Marks an item as viewed/entered by the current user.
 */
export async function markItemAsRead(
  itemId: string,
  type: 'workspace' | 'space',
  currentMember?: TeamMember | null,
  authUserId?: string | null
): Promise<void> {
  if (!itemId) return

  const member = currentMember || getCurrentMember()
  const memberId = member?.id || 'kevin'
  const memberEmail = member?.email
  const authId = authUserId

  // 1. Save locally for fast synchronous response
  saveLocalViewedId(type, itemId, memberId)
  if (memberEmail) saveLocalViewedId(type, itemId, memberEmail)
  if (authId) saveLocalViewedId(type, itemId, authId)

  // 2. Dispatch custom event to notify all listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(UNREAD_CHANGED_EVENT, { detail: { id: itemId, type, memberId } })
    )
  }

  // 3. Update database
  try {
    const toAdd = [memberId, memberEmail, authId].filter(Boolean) as string[]

    if (type === 'workspace') {
      const ws = await db.workspaces.get(itemId)
      if (ws) {
        const existingViewed = Array.isArray(ws.viewedBy) ? ws.viewedBy : []
        const combined = Array.from(new Set([...existingViewed, ...toAdd]))
        if (combined.length !== existingViewed.length) {
          await (db.workspaces as any).update(itemId, {
            viewedBy: combined,
            updatedAt: Date.now(),
            syncStatus: 'pending'
          })
        }
      }
    } else {
      const sp = await db.spaces.get(itemId)
      if (sp) {
        const existingViewed = Array.isArray(sp.viewedBy) ? sp.viewedBy : []
        const combined = Array.from(new Set([...existingViewed, ...toAdd]))
        if (combined.length !== existingViewed.length) {
          await (db.spaces as any).update(itemId, {
            viewedBy: combined,
            updatedAt: Date.now(),
            syncStatus: 'pending'
          })
        }
      }
    }
  } catch (err) {
    console.warn('Error marking item as read in database', err)
  }
}

/**
 * Hook to force component re-render when unread status changes.
 */
export function useUnreadTrigger(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => setTick((t) => t + 1)
    window.addEventListener(UNREAD_CHANGED_EVENT, handler)
    return () => window.removeEventListener(UNREAD_CHANGED_EVENT, handler)
  }, [])
  return tick
}

/**
 * Check if any item in a list is unread for the current user.
 */
export function hasUnreadInList(
  items: (WorkspaceItem | SpaceItem)[],
  type: 'workspace' | 'space',
  currentMember?: TeamMember | null,
  authUserId?: string | null
): boolean {
  return items.some((item) => isItemUnread(item, type, currentMember, authUserId))
}

/**
 * Visual badge for "New" items.
 */
export function NewBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0 shadow-2xs select-none ${className}`}
      title="Nuevo contenido sin leer"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0" />
      New
    </span>
  )
}

/**
 * Visual glowing dot for headers or compact spaces.
 */
export function NewDot({ className = '', title = 'Tiene elementos nuevos' }: { className?: string; title?: string }) {
  return (
    <span
      className={`relative flex h-2 w-2 shrink-0 ${className}`}
      title={title}
    >
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  )
}
