import type { HTMLAttributes } from 'react'

interface ArcadeCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Kept for call-site compatibility; cards are flat now. */
  tilt?: boolean
}

export function ArcadeCard({ tilt: _tilt, className = '', children, ...rest }: ArcadeCardProps) {
  return (
    <div className={`gloss-card ${className}`} {...rest}>
      {children}
    </div>
  )
}
