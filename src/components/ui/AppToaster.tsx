import { Toaster } from 'sonner'
import {
  CheckCircle,
  Info,
  SpinnerGap,
  WarningCircle,
  X,
  XCircle,
} from '@phosphor-icons/react'

interface AppToasterProps {
  theme?: 'light' | 'dark' | 'system'
  position?:
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'top-center'
    | 'bottom-center'
}

export function AppToaster({
  theme = 'system',
  position = 'bottom-right',
}: AppToasterProps) {
  return (
    <Toaster
      theme={theme}
      position={position}
      closeButton
      gap={10}
      visibleToasts={4}
      offset={20}
      toastOptions={{
        className: 'seven-toast',
      }}
      icons={{
        success: (
          <span className="seven-toast-badge seven-toast-badge--success">
            <CheckCircle size={16} weight="fill" />
          </span>
        ),
        info: (
          <span className="seven-toast-badge seven-toast-badge--info">
            <Info size={16} weight="fill" />
          </span>
        ),
        warning: (
          <span className="seven-toast-badge seven-toast-badge--warning">
            <WarningCircle size={16} weight="fill" />
          </span>
        ),
        error: (
          <span className="seven-toast-badge seven-toast-badge--error">
            <XCircle size={16} weight="fill" />
          </span>
        ),
        loading: (
          <span className="seven-toast-badge seven-toast-badge--loading">
            <SpinnerGap size={16} weight="bold" className="animate-spin" />
          </span>
        ),
        close: <X size={13} weight="bold" />,
      }}
    />
  )
}
