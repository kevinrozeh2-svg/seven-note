import React, { useEffect, useState } from 'react'
import {
  type AppThemeId,
  getThemeById,
  getThemeEffectsEnabled,
  subscribeThemeChanges
} from '../../lib/themes'

interface ThemeEffectsOverlayProps {
  themeId: AppThemeId
}

const PETALS = [
  { left: '8%', delay: '0s', duration: '14s', size: 11, opacity: 0.48 },
  { left: '19%', delay: '-4s', duration: '17s', size: 9, opacity: 0.4 },
  { left: '31%', delay: '-9s', duration: '15s', size: 12, opacity: 0.45 },
  { left: '44%', delay: '-2s', duration: '19s', size: 10, opacity: 0.36 },
  { left: '58%', delay: '-7s', duration: '16s', size: 12, opacity: 0.5 },
  { left: '71%', delay: '-11s', duration: '18s', size: 9, opacity: 0.4 },
  { left: '83%', delay: '-5s', duration: '14.5s', size: 11, opacity: 0.46 },
  { left: '92%', delay: '-12s', duration: '16.5s', size: 10, opacity: 0.38 }
]

const GOLD_MOTES = [
  { left: '10%', top: '18%', delay: '0s', duration: '9s', size: 3 },
  { left: '24%', top: '72%', delay: '-3s', duration: '11s', size: 2.5 },
  { left: '40%', top: '12%', delay: '-6s', duration: '10s', size: 2 },
  { left: '56%', top: '84%', delay: '-2s', duration: '12s', size: 3 },
  { left: '72%', top: '26%', delay: '-5s', duration: '9.5s', size: 2.5 },
  { left: '86%', top: '65%', delay: '-8s', duration: '11.5s', size: 3 },
  { left: '93%', top: '15%', delay: '-4s', duration: '10.5s', size: 2 },
  { left: '15%', top: '48%', delay: '-7s', duration: '13s', size: 2 }
]

const MATRIX_COLS = [
  { left: '0.8%', delay: '0s', duration: '11s', text: '01A7F9C2E4B801' },
  { left: '2.2%', delay: '-5s', duration: '14s', text: '7N_SYS//409F1' },
  { left: '3.6%', delay: '-8s', duration: '12.5s', text: '1011001011101' },
  { right: '0.8%', delay: '-2s', duration: '13s', text: 'AF92C04E17D83' },
  { right: '2.2%', delay: '-7s', duration: '10.5s', text: '0100111001011' },
  { right: '3.6%', delay: '-4s', duration: '15s', text: 'NODE::77_SYNC' }
]

export const ThemeEffectsOverlay: React.FC<ThemeEffectsOverlayProps> = ({ themeId }) => {
  const [effectsEnabled, setEffectsEnabled] = useState<boolean>(() => getThemeEffectsEnabled())

  useEffect(() => {
    return subscribeThemeChanges((detail) => {
      setEffectsEnabled(detail.effectsEnabled)
    })
  }, [])

  const theme = getThemeById(themeId)
  if (!effectsEnabled || theme.fx === 'none') {
    return null
  }

  return (
    <div
      aria-hidden="true"
      data-theme-fx-layer={theme.fx}
      className="sn-theme-fx-overlay pointer-events-none fixed inset-0 z-[25] overflow-hidden select-none"
    >
      {theme.fx === 'cyberpunk' && (
        <>
          {/* Subtle CRT horizontal scanlines */}
          <div
            className="absolute inset-0 opacity-[0.055]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(0,240,255,0.45) 0px, rgba(0,240,255,0.45) 1px, transparent 1px, transparent 4px)'
            }}
          />
          {/* Corner HUD brackets */}
          <span className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#00f0ff]/75 shadow-[0_0_8px_rgba(0,240,255,0.5)]" />
          <span className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-[#ff2a85]/75 shadow-[0_0_8px_rgba(255,42,133,0.45)]" />
          <span className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-[#ff2a85]/75 shadow-[0_0_8px_rgba(255,42,133,0.45)]" />
          <span className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#00f0ff]/75 shadow-[0_0_8px_rgba(0,240,255,0.5)]" />
          {/* Tiny HUD telemetry pill */}
          <div className="absolute bottom-2.5 right-7 flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] bg-[#070610]/75 border border-[#00f0ff]/35 text-[9px] font-mono tracking-[0.18em] text-[#00f0ff]/85">
            <span className="sn-fx-cyber-pulse w-1.5 h-1.5 rounded-full bg-[#00f0ff]" />
            <span>NET//7N</span>
          </div>
        </>
      )}

      {theme.fx === 'synthwave' && (
        <>
          {/* Horizon sunset glow */}
          <div
            className="absolute inset-x-0 bottom-0 h-44 opacity-25"
            style={{
              background:
                'radial-gradient(ellipse 65% 70% at 50% 100%, rgba(255,79,216,0.55) 0%, rgba(255,158,100,0.28) 45%, transparent 78%)'
            }}
          />
          {/* Perspective retro laser grid at bottom viewport edge */}
          <div
            className="absolute inset-x-[-10%] bottom-0 h-36 opacity-35"
            style={{
              perspective: '240px',
              maskImage: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)'
            }}
          >
            <div
              className="w-full h-full"
              style={{
                transform: 'rotateX(58deg)',
                transformOrigin: 'bottom center',
                backgroundImage:
                  'linear-gradient(to right, rgba(54,249,246,0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,79,216,0.5) 1px, transparent 1px)',
                backgroundSize: '44px 26px'
              }}
            />
          </div>
        </>
      )}

      {theme.fx === 'matrix' && (
        <>
          {/* Subtle CRT phosphor scanlines */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(0,255,102,0.5) 0px, rgba(0,255,102,0.5) 1px, transparent 1px, transparent 3px)'
            }}
          />
          {/* Edge-only falling binary columns */}
          {MATRIX_COLS.map((col, idx) => (
            <div
              key={idx}
              className="sn-fx-matrix-col absolute top-0 font-mono text-[10px] leading-[1.15] tracking-widest text-[#00ff66] opacity-[0.14] whitespace-pre"
              style={{
                left: col.left,
                right: col.right,
                writingMode: 'vertical-rl',
                animationDelay: col.delay,
                animationDuration: col.duration
              }}
            >
              {col.text}
            </div>
          ))}
        </>
      )}

      {theme.fx === 'aurora' && (
        <>
          <div
            className="sn-fx-aurora absolute -top-28 -left-[10%] w-[65%] h-64 rounded-full blur-3xl opacity-20"
            style={{
              background:
                'linear-gradient(120deg, rgba(45,212,191,0.7), rgba(56,189,248,0.5), rgba(167,139,250,0.45))'
            }}
          />
          <div
            className="sn-fx-aurora absolute -top-24 right-[-8%] w-[55%] h-56 rounded-full blur-3xl opacity-15"
            style={{
              animationDelay: '-7s',
              animationDuration: '24s',
              background:
                'linear-gradient(210deg, rgba(167,139,250,0.65), rgba(52,211,153,0.45), rgba(56,189,248,0.4))'
            }}
          />
          <div
            className="sn-fx-aurora absolute -bottom-28 left-[18%] w-[64%] h-60 rounded-full blur-3xl opacity-20"
            style={{
              animationDelay: '-12s',
              animationDuration: '28s',
              background:
                'linear-gradient(90deg, rgba(56,189,248,0.5), rgba(45,212,191,0.65), rgba(167,139,250,0.5))'
            }}
          />
        </>
      )}

      {theme.fx === 'zen-petals' && (
        <>
          {PETALS.map((petal, idx) => (
            <svg
              key={idx}
              viewBox="0 0 20 20"
              className="sn-fx-petal absolute -top-6"
              style={{
                left: petal.left,
                width: petal.size,
                height: petal.size,
                opacity: petal.opacity,
                animationDelay: petal.delay,
                animationDuration: petal.duration
              }}
            >
              <path
                d="M10 1 C14 4, 17 9, 13 15 C11 18, 9 18, 7 15 C3 9, 6 4, 10 1 Z"
                fill={idx % 2 === 0 ? '#f472b6' : '#fb7185'}
              />
            </svg>
          ))}
        </>
      )}

      {theme.fx === 'blueprint' && (
        <>
          {/* Outer drafting border frame */}
          <div className="absolute inset-2 border border-[#7dd3fc]/20" />
          {/* 4 corner crosshairs */}
          <div className="absolute top-3 left-3 text-[10px] font-mono text-[#7dd3fc]/55 leading-none">
            + X:000 Y:000
          </div>
          <div className="absolute top-3 right-3 text-[10px] font-mono text-[#7dd3fc]/55 leading-none">
            REV.07 +
          </div>
          <div className="absolute bottom-3 left-3 text-[10px] font-mono text-[#7dd3fc]/45 leading-none">
            + SCALE 1:1
          </div>
          <div className="absolute bottom-3 right-3 text-[10px] font-mono text-[#7dd3fc]/55 leading-none">
            CAD//7N +
          </div>
        </>
      )}

      {theme.fx === 'art-deco' && (
        <>
          {/* Outer hairline gold frame */}
          <div className="absolute inset-2.5 border border-[#d4af37]/18 pointer-events-none" />
          {/* 4 geometric Art Déco corner ornaments */}
          {[
            'top-2.5 left-2.5',
            'top-2.5 right-2.5 scale-x-[-1]',
            'bottom-2.5 left-2.5 scale-y-[-1]',
            'bottom-2.5 right-2.5 scale-[-1]'
          ].map((pos, idx) => (
            <svg
              key={idx}
              viewBox="0 0 40 40"
              className={`absolute ${pos} w-8 h-8 text-[#d4af37]/40`}
              fill="none"
            >
              <path d="M1 39 V1 H39" stroke="currentColor" strokeWidth="1.2" />
              <path d="M1 22 A21 21 0 0 1 22 1" stroke="currentColor" strokeWidth="1" />
              <path d="M1 12 A11 11 0 0 1 12 1" stroke="currentColor" strokeWidth="1" />
              <path d="M1 1 L15 15" stroke="currentColor" strokeWidth="0.9" />
            </svg>
          ))}
          {/* Subtle floating gold dust motes */}
          {GOLD_MOTES.map((mote, idx) => (
            <span
              key={idx}
              className="sn-fx-gold-mote absolute rounded-full bg-[#e6c65a]"
              style={{
                left: mote.left,
                top: mote.top,
                width: mote.size,
                height: mote.size,
                animationDelay: mote.delay,
                animationDuration: mote.duration
              }}
            />
          ))}
        </>
      )}
    </div>
  )
}
