import type { CSSProperties, ReactNode } from 'react'
import { interestById } from '../../lib/interests'
import { pastel, type PastelColor } from '../../lib/colors'

interface StickerProps {
  children: ReactNode
  color?: PastelColor
  tilt?: number
  className?: string
  as?: 'span' | 'button'
  selected?: boolean
  onClick?: () => void
}

export function Sticker({ children, color = 'blush', tilt = 0, className = '', as = 'span', selected, onClick }: StickerProps) {
  const style = { '--sticker-bg': pastel[color].bg, '--tilt': `${tilt}deg` } as CSSProperties
  if (as === 'button') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`sticker ${selected ? 'ring-4 ring-bubblegum/60' : 'opacity-70 hover:opacity-100'} ${className}`}
        style={style}
      >
        {children}
      </button>
    )
  }
  return (
    <span className={`sticker ${className}`} style={style}>
      {children}
    </span>
  )
}

const tilts = [-4, 3, -2, 5, -5, 2]

export function InterestStickers({ ids, max }: { ids: string[]; max?: number }) {
  const shown = max ? ids.slice(0, max) : ids
  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((id, index) => {
        const interest = interestById(id)
        if (!interest) return null
        return (
          <Sticker key={id} color={interest.color} tilt={tilts[index % tilts.length]}>
            <span aria-hidden>{interest.emoji}</span>
            {interest.label}
          </Sticker>
        )
      })}
    </div>
  )
}

export function DemoTag({ className = '' }: { className?: string }) {
  return (
    <Sticker color="butter" tilt={-3} className={`text-xs ${className}`}>
      🧪 Demo
    </Sticker>
  )
}
