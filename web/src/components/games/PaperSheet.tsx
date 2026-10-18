import type { ReactNode } from 'react'
import { paperBackground } from '../../games/paperAirplane/papers'
import type { PaperDesign } from '../../types'

export function PaperFace({ design, children, className = '' }: { design: PaperDesign; children?: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden shadow-[0_16px_30px_-18px_rgba(35,26,27,.55)] ${className}`}
      style={{ backgroundColor: design.color, color: design.ink, ...paperBackground(design) }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 size-8 bg-cream [clip-path:polygon(100%_0,0_0,100%_100%)]"
      />
      <div className="relative h-full">{children}</div>
    </div>
  )
}
