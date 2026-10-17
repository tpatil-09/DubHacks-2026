import type { ReactNode } from 'react'
import { Mascot, type MascotMood } from './Mascot'
import { ArcadeButton } from './ArcadeButton'

interface StateProps {
  title: string
  body?: ReactNode
  mood?: MascotMood
  action?: ReactNode
}

export function EmptyState({ title, body, mood = 'sleepy', action }: StateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Mascot mood={mood} size={110} />
      <h2 className="text-2xl font-semibold">{title}</h2>
      {body && <p className="max-w-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ title = 'Oops, a glitch in the arcade', body, onRetry }: { title?: string; body?: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Mascot mood="thinking" size={100} />
      <h2 className="text-2xl font-semibold">{title}</h2>
      {body && <p className="max-w-sm break-words text-ink-soft">{body}</p>}
      {onRetry && (
        <ArcadeButton color="lilac" onClick={onRetry} className="mt-2">
          Try again
        </ArcadeButton>
      )}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3" role="status">
      <Mascot mood="thinking" size={90} />
      <p className="font-display text-lg text-ink-soft">{label}</p>
    </div>
  )
}
