import type { CSSProperties } from 'react'
import { pastel, type PastelColor } from '../../lib/colors'

interface CapsuleProps {
  color?: PastelColor
  size?: number
  className?: string
  open?: boolean
  style?: CSSProperties
}

/** Glossy two-tone gachapon capsule. */
export function Capsule({ color = 'bubblegum', size = 64, className = '', open = false, style }: CapsuleProps) {
  const half = size / 2
  const gloss = 'inset 0 4px 8px rgb(255 255 255 / .8), inset 0 -4px 8px rgb(35 26 27 / .12)'
  return (
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} ${className}`} style={{ width: size, height: size, ...style }} aria-hidden>
      <div
        className="absolute inset-x-0 top-0 transition-transform duration-300"
        style={{
          height: half,
          borderRadius: `${half}px ${half}px 0 0`,
          background: pastel[color].bg,
          boxShadow: gloss,
          border: '3px solid #fff',
          borderBottom: 'none',
          transform: open ? `translateY(-${size * 0.35}px) rotate(-18deg)` : undefined,
        }}
      >
        <span className="absolute left-[18%] top-[18%] h-[30%] w-[30%] rounded-full bg-white/70" />
      </div>
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: half,
          borderRadius: `0 0 ${half}px ${half}px`,
          background: '#fff',
          boxShadow: gloss,
          border: '3px solid #fff',
          borderTop: `3px solid ${pastel[color].deep}`,
        }}
      />
    </div>
  )
}
