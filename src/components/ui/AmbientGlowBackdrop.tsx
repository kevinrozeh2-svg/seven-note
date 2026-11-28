import React from 'react'

export interface AmbientGlowBackdropProps {
  /**
   * - `hero`: Full home-page Obsidian Prism optical horizon aura driven by the active theme's
   *   `--prism-1..4` CSS variables, with bottom caustic rim.
   * - `subtle`: Soft theme-adaptive prismatic bottom horizon aura for the folders sidebar and secondary views.
   */
  variant?: 'hero' | 'subtle'
  className?: string
}

export const AmbientGlowBackdrop: React.FC<AmbientGlowBackdropProps> = ({
  variant = 'subtle',
  className = ''
}) => {
  if (variant === 'subtle') {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 overflow-hidden select-none z-0 ${className}`}
      >
        {/* Theme-adaptive 4-stop Obsidian Prism optical horizon aura */}
        <div
          className="absolute inset-x-[-22%] -bottom-24 h-72 transition-opacity duration-300"
          style={{
            opacity: 'var(--prism-subtle-opacity, 0.22)',
            background: [
              'radial-gradient(ellipse 52% 58% at 20% 100%, var(--prism-1) 0%, transparent 76%)',
              'radial-gradient(ellipse 54% 62% at 48% 100%, var(--prism-2) 0%, transparent 78%)',
              'radial-gradient(ellipse 46% 52% at 74% 100%, var(--prism-3) 0%, transparent 74%)',
              'radial-gradient(ellipse 42% 48% at 92% 100%, var(--prism-4) 0%, transparent 72%)'
            ].join(', ')
          }}
        />
        {/* Crisp 1px theme-adaptive prismatic bottom caustic hairline */}
        <div
          className="absolute inset-x-0 bottom-0 h-px opacity-45 dark:opacity-55"
          style={{
            background:
              'linear-gradient(90deg, transparent 4%, var(--prism-1) 26%, var(--prism-2) 50%, var(--prism-3) 74%, var(--prism-4) 90%, transparent 98%)'
          }}
        />
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none z-0 ${className}`}
    >
      {/* Top subtle theme-tinted optical sheen */}
      <div
        className="absolute inset-x-0 top-0 h-56 opacity-25 dark:opacity-20"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% -12%, var(--prism-1) 0%, transparent 72%)'
        }}
      />

      {/* Primary Theme-Adaptive 4-Stop Optical Horizon Aura */}
      <div
        className="absolute inset-x-[-14%] -bottom-28 h-[72%]"
        style={{
          opacity: 'var(--prism-aura-opacity, 0.34)',
          background: [
            'radial-gradient(ellipse 48% 54% at 18% 98%, var(--prism-1) 0%, transparent 74%)',
            'radial-gradient(ellipse 52% 58% at 46% 100%, var(--prism-2) 0%, transparent 76%)',
            'radial-gradient(ellipse 44% 52% at 70% 98%, var(--prism-3) 0%, transparent 72%)',
            'radial-gradient(ellipse 42% 48% at 88% 100%, var(--prism-4) 0%, transparent 70%)'
          ].join(', ')
        }}
      />

      {/* Specular luminous prism core directly behind the bottom composer */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -bottom-16 w-[74%] h-60 blur-3xl opacity-22 dark:opacity-30"
        style={{
          background:
            'linear-gradient(90deg, var(--prism-1) 0%, var(--prism-2) 34%, var(--prism-3) 68%, var(--prism-4) 100%)'
        }}
      />

      {/* Crisp optical horizon refraction line at the very bottom */}
      <div
        className="absolute inset-x-0 bottom-0 h-[1.5px] opacity-60 dark:opacity-80"
        style={{
          background:
            'linear-gradient(90deg, transparent 5%, var(--prism-1) 24%, var(--prism-2) 48%, var(--prism-3) 72%, var(--prism-4) 88%, transparent 97%)'
        }}
      />
    </div>
  )
}
