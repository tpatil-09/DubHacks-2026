import { motion } from 'motion/react'
import { personaById } from '../../games/quiz/personas'
import { pastel } from '../../lib/colors'
import { useSession } from '../../store/session'
import { useTokens } from '../../store/tokens'

export function PersonaBadge({ personaId, size = 'sm' }: { personaId: string | undefined; size?: 'sm' | 'lg' }) {
  const persona = personaById(personaId)
  if (!persona) return null
  const color = pastel[persona.color]
  if (size === 'lg') {
    return (
      <div
        className="relative inline-flex flex-col items-center gap-2 overflow-hidden rounded-2xl px-8 py-6 text-center"
        style={{ background: color.soft }}
      >
        <span className="text-6xl" aria-hidden>{persona.emoji}</span>
        <span className="text-2xl font-extrabold tracking-tight">{persona.name}</span>
        <span className="max-w-[16rem] text-sm text-ink-soft">{persona.tagline}</span>
      </div>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold"
      style={{ background: color.soft }}
      title={persona.tagline}
    >
      <span aria-hidden>{persona.emoji}</span>
      {persona.name}
    </span>
  )
}

export function VibeMeter({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`${percent}% vibe match, just for fun`}>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-blush">
        <motion.div
          className="h-full rounded-full bg-bubblegum"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      <span className="text-sm font-semibold">{percent}% vibe</span>
    </div>
  )
}

export function TokenCounter() {
  const uid = useSession((state) => state.user?.uid)
  const count = useTokens((state) => (uid ? state.byUser[uid] ?? 0 : 0))
  return (
    <motion.span
      key={count}
      initial={{ scale: 1.3 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      className="inline-flex items-center gap-1.5 rounded-full bg-butter px-3 py-1 text-sm font-bold"
      aria-label={`${count} arcade tokens`}
    >
      <span aria-hidden>🪙</span>
      {count}
    </motion.span>
  )
}
