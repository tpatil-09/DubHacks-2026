import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { Capsule } from '../../components/ui/Capsule'
import { Mascot } from '../../components/ui/Mascot'
import { PersonaBadge } from '../../components/ui/Badges'
import { backend } from '../../data'
import { wyrPrompts } from '../../games/wouldYouRather/prompts'
import { arcadeVars, type PastelColor } from '../../lib/colors'
import { useSession } from '../../store/session'

export default function ArcadeHub() {
  const uid = useSession((state) => state.user?.uid)
  const profile = useSession((state) => state.profile)
  const [wyrCount, setWyrCount] = useState<number | null>(null)

  useEffect(() => {
    if (!uid) return
    backend().getWyrAnswers(uid).then((answers) => setWyrCount(Object.keys(answers).length)).catch(() => setWyrCount(0))
  }, [uid])

  return (
    <div className="pb-8">
      <div className="mb-6 flex items-center gap-4">
        <Mascot mood="excited" size={90} />
        <div>
          <span className="eyebrow">Optional</span>
          <h1 className="text-4xl">Fun match</h1>
          <p className="text-ink-soft">Play a quick game to find people on your wavelength, or just keep swiping.</p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <GameCard
          to="/arcade/quiz"
          color="lilac"
          emoji="🧩"
          title="Compatibility Quiz"
          subtitle="What’s your co-op player type? 10 questions, 8 personas."
          cta={profile?.quiz ? 'Retake quiz' : 'Play'}
          footer={profile?.quiz ? <PersonaBadge personaId={profile.quiz.personaId} /> : <span className="text-sm text-ink-soft">Unlocks vibe % on every profile</span>}
        />
        <GameCard
          to="/arcade/would-you-rather"
          color="bubblegum"
          emoji="🎰"
          title="Would You Rather"
          subtitle="Crank the capsule machine, pick a side, and see which matches agree."
          cta="Play"
          footer={<span className="text-sm text-ink-soft">{wyrCount === null ? '…' : `${wyrCount} of ${wyrPrompts.length} capsules opened`}</span>}
        />
      </div>
    </div>
  )
}

interface GameCardProps {
  to: string
  color: PastelColor
  emoji: string
  title: string
  subtitle: string
  cta: string
  footer: ReactNode
}

function GameCard({ to, color, emoji, title, subtitle, cta, footer }: GameCardProps) {
  return (
    <motion.div whileHover={{ y: -4, rotate: -0.5 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
      <Link to={to} className="gloss-card group flex h-full flex-col gap-4 p-6">
        <div className="flex items-start justify-between">
          <span className="text-6xl drop-shadow-[0_6px_6px_rgba(59,47,74,.15)]" aria-hidden>{emoji}</span>
          <Capsule color={color} size={44} className="transition-transform group-hover:rotate-12" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="mt-1 text-ink-soft">{subtitle}</p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3">
          {footer}
          <span className="btn-arcade h-11 shrink-0 px-5" style={arcadeVars(color)}>{cta} ▶</span>
        </div>
      </Link>
    </motion.div>
  )
}
