import React from 'react'
import { sileo, type SileoOptions, type SileoPosition, type SileoState } from 'sileo'
import {
  ArrowRight,
  CheckCircle,
  Info,
  SpinnerGap,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react'

export { sileo }
export type { SileoOptions, SileoPosition, SileoState }

const PERSISTENT_TIMEOUT_MS = 2_147_483_647
const MAX_PILL_TITLE_LENGTH = 40

let toastSeq = 0

function nextToastId(prefix: string): string {
  toastSeq += 1
  return `${prefix}-${toastSeq}-${Date.now().toString(36)}`
}

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  id?: string | number
  description?: React.ReactNode
  duration?: number | null
  position?: SileoPosition
  icon?: React.ReactNode | null
  action?: ToastAction
  cancel?: ToastAction
  fill?: string
  roundness?: number
  autopilot?: SileoOptions['autopilot']
}

type SileoInternalOptions = SileoOptions & { id?: string }

const DEFAULT_TITLES: Record<SileoState, string> = {
  success: 'Completado',
  error: 'Error',
  warning: 'Aviso',
  info: 'Información',
  action: 'Acción',
  loading: 'Cargando...',
}

function getStateIcon(state: SileoState): React.ReactNode {
  switch (state) {
    case 'success':
      return React.createElement(CheckCircle, { size: 15, weight: 'fill' })
    case 'error':
      return React.createElement(XCircle, { size: 15, weight: 'fill' })
    case 'warning':
      return React.createElement(WarningCircle, { size: 15, weight: 'fill' })
    case 'loading':
      return React.createElement(SpinnerGap, {
        size: 15,
        weight: 'bold',
        className: 'animate-spin',
      })
    case 'action':
      return React.createElement(ArrowRight, { size: 14, weight: 'bold' })
    case 'info':
    default:
      return React.createElement(Info, { size: 15, weight: 'fill' })
  }
}

function splitLongMessage(
  rawMessage: React.ReactNode,
  state: SileoState,
  existingDescription?: React.ReactNode
): { title: string; description?: React.ReactNode } {
  if (typeof rawMessage !== 'string') {
    return {
      title: DEFAULT_TITLES[state],
      description: existingDescription ?? rawMessage,
    }
  }

  const trimmed = rawMessage.trim()
  if (existingDescription !== undefined || trimmed.length <= MAX_PILL_TITLE_LENGTH) {
    return { title: trimmed, description: existingDescription }
  }

  // If the sentence has a concise leading label before ":", split cleanly there
  const colonIdx = trimmed.indexOf(':')
  if (colonIdx > 2 && colonIdx <= 34) {
    const head = trimmed.slice(0, colonIdx).trim()
    const tail = trimmed.slice(colonIdx + 1).trim()
    if (tail) {
      return { title: head, description: tail }
    }
  }

  // Otherwise use a clean pill title and place the full text in Sileo's expandable body
  return {
    title: DEFAULT_TITLES[state],
    description: trimmed,
  }
}

function dispatchSileo(
  state: SileoState,
  message: React.ReactNode,
  options?: ToastOptions
): string {
  const resolvedId =
    options?.id !== undefined ? String(options.id) : nextToastId(`sn-${state}`)

  const { title, description } = splitLongMessage(
    message,
    state,
    options?.description
  )

  const hasExpandableBody = Boolean(description) || Boolean(options?.action)
  const isInfinite =
    options?.duration === Infinity ||
    (options?.duration === null && state !== 'loading')

  let resolvedDuration: number | null | undefined = options?.duration
  let resolvedAutopilot: SileoOptions['autopilot'] = options?.autopilot

  if (state === 'loading') {
    resolvedDuration = null
    resolvedAutopilot = false
  } else if (isInfinite) {
    if (hasExpandableBody) {
      // Sileo skips auto-expand when duration is null; use max 32-bit timeout so
      // persistent alerts (like app updates) smoothly spring open and remain expanded.
      resolvedDuration = PERSISTENT_TIMEOUT_MS
      resolvedAutopilot = resolvedAutopilot ?? {
        expand: 150,
        collapse: PERSISTENT_TIMEOUT_MS,
      }
    } else {
      resolvedDuration = null
    }
  } else if (hasExpandableBody) {
    const dur = typeof resolvedDuration === 'number' && resolvedDuration > 0 ? resolvedDuration : 5500
    resolvedDuration = dur
    if (resolvedAutopilot === undefined) {
      resolvedAutopilot = {
        expand: 140,
        collapse: Math.max(1200, dur - 700),
      }
    }
  } else if (resolvedDuration === undefined) {
    resolvedDuration = 3600
  }

  const sileoOpts: SileoInternalOptions = {
    id: resolvedId,
    type: state,
    title,
    description,
    duration: resolvedDuration,
    position: options?.position,
    icon: options?.icon !== undefined ? options.icon : getStateIcon(state),
    fill: options?.fill,
    roundness: options?.roundness,
    autopilot: resolvedAutopilot,
    button: options?.action
      ? {
          title: options.action.label,
          onClick: () => {
            options.action!.onClick()
            sileo.dismiss(resolvedId)
          },
        }
      : undefined,
  }

  return sileo.show(sileoOpts)
}

interface ToastFunction {
  (message: React.ReactNode, options?: ToastOptions): string
  success: (message: React.ReactNode, options?: ToastOptions) => string
  error: (message: React.ReactNode, options?: ToastOptions) => string
  warning: (message: React.ReactNode, options?: ToastOptions) => string
  info: (message: React.ReactNode, options?: ToastOptions) => string
  action: (message: React.ReactNode, options?: ToastOptions) => string
  loading: (message: React.ReactNode, options?: ToastOptions) => string
  dismiss: (id?: string | number) => void
  clear: (position?: SileoPosition) => void
  promise: typeof sileo.promise
}

const baseToast = (message: React.ReactNode, options?: ToastOptions): string =>
  dispatchSileo(options?.action ? 'action' : 'info', message, options)

export const toast: ToastFunction = Object.assign(baseToast, {
  success: (message: React.ReactNode, options?: ToastOptions) =>
    dispatchSileo('success', message, options),
  error: (message: React.ReactNode, options?: ToastOptions) =>
    dispatchSileo('error', message, options),
  warning: (message: React.ReactNode, options?: ToastOptions) =>
    dispatchSileo('warning', message, options),
  info: (message: React.ReactNode, options?: ToastOptions) =>
    dispatchSileo('info', message, options),
  action: (message: React.ReactNode, options?: ToastOptions) =>
    dispatchSileo('action', message, options),
  loading: (message: React.ReactNode, options?: ToastOptions) =>
    dispatchSileo('loading', message, options),
  dismiss: (id?: string | number) => {
    if (id === undefined) {
      sileo.clear()
    } else {
      sileo.dismiss(String(id))
    }
  },
  clear: (position?: SileoPosition) => sileo.clear(position),
  promise: sileo.promise,
})
