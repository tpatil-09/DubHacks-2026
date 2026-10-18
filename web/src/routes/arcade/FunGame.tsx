import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArcadeButton } from '../../components/ui/ArcadeButton'
import { Capsule } from '../../components/ui/Capsule'
import { PageLoader } from '../../components/ui/States'
import { TwinList } from '../../components/games/TwinList'
import { backend } from '../../data'
import {
  PUZZLE_KEY,
  gameById,
  isComplete,
  scoreBuzzQuiz,
  type BuzzQuiz,
  type MatchPuzzle,
} from '../../games/fun/games'
import { pastel } from '../../lib/colors'
import { useSession } from '../../store/session'
import { useTokens } from '../../store/tokens'
import { toast } from '../../store/toast'
import type { GameAnswers } from '../../types'
import NotFound from '../NotFound'

const tileColors = ['bg-blush', 'bg-sky/60', 'bg-mint/50', 'bg-butter/70', 'bg-lilac/60']
const TOKENS_PER_GAME = 5

export default function FunGame() {
  const { gameId } = useParams()
  const game = gameById(gameId)
  const uid = useSession((state) => state.user?.uid)
  const [saved, setSaved] = useState<GameAnswers | null | undefined>(undefined)

  useEffect(() => {
    if (!uid || !game) return
    backend()
      .getGameAnswers(uid)
      .then((all) => setSaved(isComplete(game, all[game.id]) ? all[game.id] : null))
      .catch(() => setSaved(null))
  }, [uid, game])

  if (!game) return <NotFound />
  if (!uid || saved === undefined) return <PageLoader />
  return game.kind === 'quiz' ? <QuizGame key={game.id} uid={uid} quiz={game} saved={saved} /> : <PuzzleGame key={game.id} uid={uid} puzzle={game} saved={saved} />
}

function useFinish(uid: string, gameId: string) {
  const addTokens = useTokens((state) => state.add)
  const [saving, setSaving] = useState(false)
  async function finish(answers: GameAnswers, firstTime: boolean) {
    setSaving(true)
    try {
      await backend().saveGameAnswers(uid, gameId, answers)
      if (firstTime) addTokens(uid, TOKENS_PER_GAME)
      return true
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Could not save your answers.', 'error')
      return false
    } finally {
      setSaving(false)
    }
  }
  return { finish, saving }
}

function GameHeader({ title, color }: { title: string; color: keyof typeof pastel }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <Link to="/arcade" className="shrink-0 font-display font-semibold text-ink-soft hover:text-ink">← All games</Link>
      <span className="flex min-w-0 items-center gap-2 font-display font-semibold text-ink-soft">
        <Capsule color={color} size={20} />
        <span className="truncate">{title}</span>
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ quiz */

function QuizGame({ uid, quiz, saved }: { uid: string; quiz: BuzzQuiz; saved: GameAnswers | null }) {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<GameAnswers>(saved ?? {})
  const [phase, setPhase] = useState<'play' | 'cracking' | 'result'>(saved ? 'result' : 'play')
  const [popped, setPopped] = useState<string | null>(null)
  const { finish, saving } = useFinish(uid, quiz.id)
  const question = quiz.questions[index]

  function choose(optionId: string) {
    if (saving || popped) return
    const next = { ...answers, [question.id]: [optionId] }
    setAnswers(next)
    setPopped(optionId)
    // Let the tile pop before moving on.
    setTimeout(async () => {
      setPopped(null)
      if (index < quiz.questions.length - 1) {
        setIndex(index + 1)
        return
      }
      if (await finish(next, !saved)) {
        setPhase('cracking')
        setTimeout(() => setPhase('result'), reduceMotion ? 0 : 1100)
      }
    }, reduceMotion ? 0 : 280)
  }

  function restart() {
    setAnswers({})
    setIndex(0)
    setPhase('play')
  }

  if (phase !== 'play') {
    const result = scoreBuzzQuiz(quiz, answers)
    return (
      <div className="mx-auto max-w-xl pb-10">
        <GameHeader title={quiz.title} color={quiz.color} />
        <AnimatePresence mode="wait">
          {phase === 'cracking' ? (
            <motion.div key="crack" className="flex flex-col items-center py-12" exit={{ scale: 1.6, opacity: 0 }}>
              <motion.div animate={{ rotate: [0, -12, 12, -12, 12, 0], y: [0, -8, 0] }} transition={{ duration: 1 }}>
                <Capsule color={quiz.color} size={140} />
              </motion.div>
              <p className="mt-4 font-display text-xl font-semibold">Cracking your capsule…</p>
            </motion.div>
          ) : (
            <motion.div key="result" className="grid gap-6" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 16 }}>
              <div className="gloss-card relative overflow-hidden p-6 text-center">
                <motion.span
                  className="inline-block text-7xl"
                  animate={reduceMotion ? undefined : { y: [0, -14, 0], rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.6 }}
                  aria-hidden
                >
                  {result.emoji}
                </motion.span>
                <p className="mt-3 font-display text-sm font-bold uppercase tracking-widest text-ink-soft">You got</p>
                <h1 className="mt-1 text-4xl">{result.title}</h1>
                <p className="mx-auto mt-3 max-w-md text-lg text-ink-soft">{result.blurb}</p>
                <div className="mt-5 flex justify-center gap-3">
                  <ArcadeButton color="white" onClick={restart}>Retake</ArcadeButton>
                </div>
              </div>
              <section aria-label="Your quiz twins">
                <h2 className="mb-3 text-2xl font-bold">Your quiz twins</h2>
                <TwinList uid={uid} game={quiz} answers={answers} />
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl pb-10">
      <GameHeader title={quiz.title} color={quiz.color} />
      {/* Progress: a row of little capsules that fill in. */}
      <div className="mb-6 flex justify-center gap-2" aria-label={`Question ${index + 1} of ${quiz.questions.length}`}>
        {quiz.questions.map((entry, position) => (
          <motion.span key={entry.id} animate={{ scale: position === index ? 1.25 : 1, opacity: position <= index ? 1 : 0.35 }}>
            <Capsule color={position < index ? quiz.color : position === index ? 'bubblegum' : 'blush'} size={26} />
          </motion.span>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ x: 60, opacity: 0, rotate: 3 }}
          animate={{ x: 0, opacity: 1, rotate: 0 }}
          exit={{ x: -60, opacity: 0, rotate: -3 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        >
          <h1 className="mb-5 text-center text-3xl font-bold">{question.prompt}</h1>
          <div className={`grid gap-3 ${question.options.every((option) => !option.label) ? 'grid-cols-4' : 'grid-cols-2'}`}>
            {question.options.map((option, position) => (
              <motion.button
                key={option.id}
                type="button"
                onClick={() => choose(option.id)}
                disabled={saving}
                aria-label={option.label || option.emoji}
                whileHover={reduceMotion ? undefined : { y: -4, rotate: position % 2 ? 2 : -2 }}
                whileTap={{ scale: 0.92 }}
                animate={popped === option.id ? { scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] } : popped ? { opacity: 0.4, scale: 0.95 } : { opacity: 1, scale: 1 }}
                className={`gloss-card flex flex-col items-center justify-center gap-2 p-4 text-center ${popped === option.id ? 'ring-4 ring-bubblegum' : ''}`}
              >
                <span className={`grid size-16 place-items-center rounded-2xl text-4xl ${tileColors[position % tileColors.length]}`} aria-hidden>
                  {option.emoji}
                </span>
                {option.label && <span className="font-display text-base font-medium leading-snug">{option.label}</span>}
              </motion.button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
      {index > 0 && (
        <button type="button" className="mt-5 font-display font-semibold text-ink-soft hover:text-ink" onClick={() => setIndex(index - 1)}>
          ← Previous question
        </button>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- puzzle */

function PuzzleGame({ uid, puzzle, saved }: { uid: string; puzzle: MatchPuzzle; saved: GameAnswers | null }) {
  const reduceMotion = useReducedMotion()
  const [picks, setPicks] = useState<string[]>(saved?.[PUZZLE_KEY] ?? [])
  const [locked, setLocked] = useState(!!saved)
  const { finish, saving } = useFinish(uid, puzzle.id)
  const full = picks.length === puzzle.pick
  const byId = new Map(puzzle.options.map((option) => [option.id, option]))

  function toggle(id: string) {
    if (locked) return
    setPicks((current) => (current.includes(id) ? current.filter((x) => x !== id) : current.length < puzzle.pick ? [...current, id] : current))
  }

  async function lockIn() {
    if (await finish({ [PUZZLE_KEY]: picks }, !saved)) setLocked(true)
  }

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <GameHeader title={puzzle.title} color={puzzle.color} />
      <h1 className="text-center text-3xl font-bold sm:text-4xl">{puzzle.prompt}</h1>
      <p className="mt-2 text-center text-ink-soft">There’s no wrong answer. Pick the same things as someone else and you’re puzzle twins.</p>

      {/* Slots: picks drop into capsules. */}
      <div className="my-6 flex justify-center gap-3" aria-live="polite">
        {Array.from({ length: puzzle.pick }, (_, slot) => {
          const option = picks[slot] ? byId.get(picks[slot]) : undefined
          return (
            <div key={slot} className="grid size-20 place-items-center rounded-full border-[3px] border-dashed border-[var(--color-line)] bg-white/60 sm:size-24">
              <AnimatePresence>
                {option && (
                  <motion.button
                    type="button"
                    key={option.id}
                    onClick={() => toggle(option.id)}
                    disabled={locked}
                    aria-label={`Remove ${option.label}`}
                    initial={reduceMotion ? false : { y: -60, scale: 0.4, opacity: 0 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                    className="grid size-16 place-items-center rounded-full text-4xl shadow sm:size-20"
                    style={{ background: pastel[puzzle.color].bg }}
                  >
                    {option.emoji}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {!locked ? (
        <>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {puzzle.options.map((option, position) => {
              const chosen = picks.includes(option.id)
              return (
                <motion.button
                  key={option.id}
                  type="button"
                  onClick={() => toggle(option.id)}
                  aria-pressed={chosen}
                  disabled={!chosen && full}
                  whileHover={reduceMotion || (!chosen && full) ? undefined : { y: -3, rotate: position % 2 ? 2 : -2 }}
                  whileTap={{ scale: 0.9 }}
                  animate={{ opacity: !chosen && full ? 0.45 : 1 }}
                  className={`gloss-card flex flex-col items-center gap-1.5 p-3 text-center ${chosen ? 'ring-4 ring-bubblegum' : ''}`}
                >
                  <span className="text-4xl" aria-hidden>{option.emoji}</span>
                  <span className="font-display text-sm font-medium leading-tight">{option.label}</span>
                </motion.button>
              )
            })}
          </div>
          <div className="mt-6 flex items-center justify-center gap-3">
            <span className="font-display font-semibold text-ink-soft">{picks.length} / {puzzle.pick} picked</span>
            <ArcadeButton color={puzzle.color} disabled={!full} loading={saving} onClick={lockIn}>Lock it in ▶</ArcadeButton>
          </div>
        </>
      ) : (
        <motion.section aria-label="Your puzzle twins" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Your puzzle twins</h2>
            <ArcadeButton color="white" size="sm" onClick={() => setLocked(false)}>Change picks</ArcadeButton>
          </div>
          <TwinList uid={uid} game={puzzle} answers={{ [PUZZLE_KEY]: picks }} />
        </motion.section>
      )}
    </div>
  )
}
