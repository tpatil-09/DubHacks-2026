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
        className="relative inline-flex flex-col items-center gap-2 overflow-hidden rounded-[28px] border-4 border-white px-8 py-6 text-center shadow-[0_16px_40px_rgba(157,140,240,.35)]"
        style={{ background: `linear-gradient(135deg, ${color.soft}, ${color.bg} 60%, #fff 120%)` }}
      >
        <span className="holo-sheen" aria-hidden />
        <span className="text-6xl" aria-hidden>{persona.emoji}</span>
        <span className="font-display text-2xl font-semibold">{persona.name}</span>
        <span className="max-w-[16rem] text-sm text-ink-soft">{persona.tagline}</span>
      </div>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border-2 border-white px-2.5 py-0.5 font-display text-xs font-semibold shadow-sm"
      style={{ background: color.bg }}
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
      <div className="h-3 w-24 overflow-hidden rounded-full border-2 border-white bg-blush shadow-inner">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-lilac via-bubblegum to-peach"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      <span className="font-display text-sm font-semibold">{percent}% vibe</span>
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
      className="inline-flex items-center gap-1.5 rounded-full border-[3px] border-white bg-butter px-3 py-1 font-display font-semibold shadow-[inset_0_2px_3px_rgba(255,255,255,.8),0_3px_0_#e8c34a]"
      aria-label={`${count} arcade tokens`}
    >
      <span aria-hidden>🪙</span>
      {count}
    </motion.span>
  )
}
