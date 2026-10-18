import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { backend } from '../../data'
import { wyrPrompts } from '../../games/wouldYouRather/prompts'
import { personaById } from '../../games/quiz/personas'
import { buzzQuizzes, isComplete, matchPuzzles, scoreBuzzQuiz, type FunGame } from '../../games/fun/games'
import { useAirplanes } from '../../hooks/data'
import type { GameAnswers } from '../../types'
import { pastel, type PastelColor } from '../../lib/colors'
import { useSession } from '../../store/session'

export default function ArcadeHub() {
  const uid = useSession((state) => state.user?.uid)
  const profile = useSession((state) => state.profile)
  const [wyrCount, setWyrCount] = useState<number | null>(null)
  const [played, setPlayed] = useState<Record<string, GameAnswers>>({})
  const { inbox } = useAirplanes(uid)
  const planesWaiting = inbox.filter((plane) => !plane.reply).length

  useEffect(() => {
    if (!uid) return
    backend().getWyrAnswers(uid).then((answers) => setWyrCount(Object.keys(answers).length)).catch(() => setWyrCount(0))
    backend().getGameAnswers(uid).then(setPlayed).catch(() => setPlayed({}))
  }, [uid])

  const persona = personaById(profile?.quiz?.personaId)

  return (
    <div className="pb-12">
      <header className="mb-10 max-w-2xl">
        <span className="eyebrow">Totally optional</span>
        <h1 className="mt-4 text-[2.6rem] sm:text-6xl">Find a fun match.</h1>
        <p className="mt-4 text-lg text-ink-soft">Play a quick game to find people on your wavelength, or just keep swiping.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <FeaturedGame
          to="/arcade/quiz"
          color="lilac"
          kicker="Compatibility quiz"
          title={persona ? `You’re ${persona.name}` : 'What’s your co\u2011op player type?'}
          body="Ten questions about how you spend your time. Your result adds a vibe % to every profile you see."
          meta={persona ? 'Retake' : '10 questions'}
        />
        <FeaturedGame
          to="/arcade/would-you-rather"
          color="peach"
          kicker="Would you rather"
          title="Pick a side, see who agrees"
          body="Crank the capsule machine for a dilemma, then see which of your matches picked the same."
          meta={wyrCount === null ? '…' : `${wyrCount} of ${wyrPrompts.length} answered`}
        />
        <FeaturedGame
          to="/arcade/paper-airplane"
          color="sky"
          className="md:col-span-2"
          kicker="Paper airplane"
          title="Throw a paper airplane"
          body="Pick a sheet, write a note, and send it to someone random. You only learn who caught it if they write back."
          meta={planesWaiting > 0 ? `${planesWaiting} landed for you` : 'A note for a stranger'}
        />
      </div>

      <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-10">
        <GameList
          title="Quizzes"
          blurb="Six questions, one result. See who got the same."
          games={buzzQuizzes}
          played={played}
        />
        <GameList
          title="Match puzzles"
          blurb="No wrong answers. Pick the same things as someone and you’re twins."
          games={matchPuzzles}
          played={played}
        />
      </div>
    </div>
  )
}

interface FeaturedGameProps {
  to: string
  color: PastelColor
  kicker: string
  title: string
  body: string
  meta: ReactNode
  className?: string
}

function FeaturedGame({ to, color, kicker, title, body, meta, className = '' }: FeaturedGameProps) {
  return (
    <Link
      to={to}
      className={`group flex flex-col rounded-[var(--radius-card)] p-6 transition-colors sm:p-7 ${className}`}
      style={{ background: pastel[color].soft }}
    >
      <span className="text-sm font-semibold" style={{ color: pastel[color].deep }}>{kicker}</span>
      <h2 className="mt-2 text-[1.75rem] leading-tight">{title}</h2>
      <p className="mt-2 max-w-md text-ink-soft">{body}</p>
      <div className="mt-6 flex items-center justify-between text-sm">
        <span className="text-ink-soft">{meta}</span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
          Play
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  )
}

function GameList({ title, blurb, games, played }: { title: string; blurb: string; games: FunGame[]; played: Record<string, GameAnswers> }) {
  return (
    <section aria-label={title}>
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-[var(--color-line)] pb-3">
        <h2 className="text-2xl">{title}</h2>
        <span className="text-sm text-ink-soft">{games.length} games</span>
      </div>
      <p className="mb-2 text-sm text-ink-soft">{blurb}</p>
      <ul className="divide-y divide-[var(--color-line)]">
        {games.map((game) => (
          <li key={game.id}>
            <GameRow game={game} answers={played[game.id]} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function GameRow({ game, answers }: { game: FunGame; answers: GameAnswers | undefined }) {
  const done = isComplete(game, answers)
  const detail = game.kind === 'quiz' ? `${game.questions.length} questions` : `Pick ${game.pick} of ${game.options.length}`
  const status = done && answers ? (game.kind === 'quiz' ? `You got ${scoreBuzzQuiz(game, answers).title}` : 'Picks saved') : null

  return (
    <Link to={`/arcade/play/${game.id}`} className="group -mx-3 flex items-center gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-white">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl text-[22px]" style={{ background: pastel[game.color].soft }} aria-hidden>
        {game.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-balance font-semibold leading-snug">{game.title}</span>
        <span className="mt-0.5 block truncate text-sm text-ink-soft">{status ?? detail}</span>
      </span>
      {done && <span className="hidden text-xs font-semibold text-ink-soft sm:inline">See twins</span>}
      <ChevronRight className="size-5 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}
