import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { Heart } from 'lucide-react'
import { Avatar } from '../ui/ProfilePhoto'
import { Capsule } from '../ui/Capsule'
import { EmptyState } from '../ui/States'
import { backend } from '../../data'
import { rankTwins, sharedPicks, type FunGame, type Twin } from '../../games/fun/games'
import { toast } from '../../store/toast'
import type { GameAnswers, Profile } from '../../types'

/** A sync percent at or above this counts as a fun match. */
export const FUN_MATCH_PERCENT = 50

interface TwinListProps {
  uid: string
  game: FunGame
  answers: GameAnswers
}

/** "Your twins": the members whose answers are most like yours. Just for fun; never creates a match on its own. */
export function TwinList({ uid, game, answers }: TwinListProps) {
  const [players, setPlayers] = useState<{ profile: Profile; answers: GameAnswers }[] | null>(null)
  const [liked, setLiked] = useState<Set<string>>(new Set())

  useEffect(() => {
    let active = true
    backend()
      .listGamePlayers(uid, game.id)
      .then((list) => active && setPlayers(list))
      .catch(() => active && setPlayers([]))
    return () => {
      active = false
    }
  }, [uid, game.id])

  if (!players) {
    return (
      <div className="flex flex-col items-center gap-3 py-8" role="status">
        <motion.div animate={{ rotate: [0, -12, 12, 0] }} transition={{ duration: 0.9, repeat: Infinity }}>
          <Capsule color={game.color} size={56} />
        </motion.div>
        <p className="font-display text-lg font-semibold text-ink-soft">Finding your twins…</p>
      </div>
    )
  }

  const byUid = Object.fromEntries(players.map((entry) => [entry.profile.uid, entry]))
  const twins = rankTwins(answers, Object.fromEntries(players.map((entry) => [entry.profile.uid, entry.answers]))).slice(0, 5)

  if (twins.length === 0) {
    return <EmptyState title="No twins yet" body="Nobody has answered quite like you so far. Check back after more people play!" />
  }

  async function like(target: string) {
    try {
      const { matchId } = await backend().setLike(uid, target, 'like')
      setLiked((previous) => new Set(previous).add(target))
      toast(matchId ? "It's a match! Say hi in Matches." : 'Like sent 💌', 'success')
    } catch {
      toast('Could not send that like. Try again.', 'error')
    }
  }

  const top = twins[0]
  return (
    <div className="grid gap-5">
      <SyncMeter percent={top.percent} name={byUid[top.uid].profile.firstName} />
      <ul className="grid gap-3">
        {twins.map((twin, position) => (
          <TwinRow
            key={twin.uid}
            twin={twin}
            profile={byUid[twin.uid].profile}
            shared={sharedLabels(game, answers, byUid[twin.uid].answers)}
            delay={0.15 * position}
            liked={liked.has(twin.uid)}
            onLike={() => like(twin.uid)}
          />
        ))}
      </ul>
      <p className="text-center text-sm text-ink-soft">Just for fun. Liking someone here works like liking them on Discover.</p>
    </div>
  )
}

function sharedLabels(game: FunGame, mine: GameAnswers, theirs: GameAnswers): string[] {
  const options = game.kind === 'puzzle' ? game.options : game.questions.flatMap((question) => question.options)
  const label = new Map(options.map((option) => [option.id, `${option.emoji} ${option.label}`.trim()]))
  return [...new Set(sharedPicks(mine, theirs))].map((id) => label.get(id) ?? id).slice(0, 4)
}

function SyncMeter({ percent, name }: { percent: number; name: string }) {
  const reduceMotion = useReducedMotion()
  const isMatch = percent >= FUN_MATCH_PERCENT
  return (
    <div className="gloss-card relative overflow-hidden p-5 text-center">
      {isMatch && !reduceMotion && <FloatingHearts />}
      <p className="font-display text-sm font-bold uppercase tracking-widest text-ink-soft">{isMatch ? 'It’s a fun match!' : 'Closest twin'}</p>
      <p className="mt-1 font-display text-2xl font-semibold">
        You and {name} are <span className="text-bubblegum">{percent}%</span> in sync
      </p>
      <div className="mx-auto mt-4 h-4 max-w-sm overflow-hidden rounded-full bg-blush">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-peach via-bubblegum to-lilac-deep"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 14, delay: 0.2 }}
        />
      </div>
    </div>
  )
}

function FloatingHearts() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute bottom-0 text-xl"
          style={{ left: `${8 + i * 12}%` }}
          initial={{ y: 20, opacity: 0, scale: 0.6 }}
          animate={{ y: -140, opacity: [0, 1, 0], scale: 1.1, rotate: i % 2 ? 15 : -15 }}
          transition={{ duration: 2.2, delay: 0.3 + i * 0.18, repeat: Infinity, repeatDelay: 1.5 }}
        >
          {i % 3 === 0 ? '💖' : i % 3 === 1 ? '✨' : '💕'}
        </motion.span>
      ))}
    </div>
  )
}

interface TwinRowProps {
  twin: Twin
  profile: Profile
  shared: string[]
  delay: number
  liked: boolean
  onLike: () => void
}

function TwinRow({ twin, profile, shared, delay, liked, onLike }: TwinRowProps) {
  return (
    <motion.li
      className="gloss-card flex flex-wrap items-center gap-3 p-3"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, delay }}
    >
      <Link to={`/profile/${profile.uid}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar src={profile.photos[0]} alt={profile.firstName} size={48} />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">{profile.firstName}</p>
          {shared.length > 0 && <p className="truncate text-sm text-ink-soft">Both picked {shared.join(', ')}</p>}
        </div>
      </Link>
      <span className={`rounded-full px-3 py-1 text-sm font-bold ${twin.percent >= FUN_MATCH_PERCENT ? 'bg-bubblegum text-white' : 'bg-blush text-ink'}`}>
        {twin.percent}%
      </span>
      <motion.button
        type="button"
        onClick={onLike}
        disabled={liked}
        whileTap={{ scale: 0.85 }}
        aria-label={liked ? `Liked ${profile.firstName}` : `Like ${profile.firstName}`}
        className={`grid size-10 place-items-center rounded-full border-2 transition-colors ${liked ? 'border-bubblegum bg-bubblegum text-white' : 'border-[var(--color-line)] bg-white text-bubblegum hover:border-bubblegum'}`}
      >
        <Heart className="size-5" fill={liked ? 'currentColor' : 'none'} aria-hidden />
      </motion.button>
    </motion.li>
  )
}
