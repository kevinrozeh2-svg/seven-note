import { useMemo } from 'react'
import { Toaster, type SileoPosition } from 'sileo'

interface AppToasterProps {
  theme?: 'light' | 'dark' | 'system'
  position?: SileoPosition
}

export function AppToaster({
  theme = 'system',
  position = 'bottom-right',
}: AppToasterProps) {
  const options = useMemo(
    () => ({
      fill: theme === 'light' ? '#17171b' : '#131317',
      roundness: 18,
      styles: {
        title: 'sn-sileo-title',
        description: 'sn-sileo-description',
        badge: 'sn-sileo-badge',
        button: 'sn-sileo-button',
      },
    }),
    [theme]
  )

  return (
    <Toaster
      theme={theme}
      position={position}
      offset={16}
      options={options}
    />
  )
}
