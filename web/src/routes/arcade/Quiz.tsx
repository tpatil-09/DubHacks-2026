import { useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArcadeButton } from '../../components/ui/ArcadeButton'
import { Capsule } from '../../components/ui/Capsule'
import { PersonaBadge } from '../../components/ui/Badges'
import { backend } from '../../data'
import { quizQuestions } from '../../games/quiz/questions'
import { axisLabels, quizAxes, scoreQuiz } from '../../games/quiz/scoring'
import { personaFor } from '../../games/quiz/personas'
import { arcadeVars } from '../../lib/colors'
import { celebrate } from '../../lib/confetti'
import { useSession } from '../../store/session'
import { useTokens } from '../../store/tokens'
import { toast } from '../../store/toast'
import type { QuizAxes } from '../../types'

const optionColors = ['bg-blush', 'bg-sky/60', 'bg-mint/60', 'bg-butter/70']

export default function Quiz() {
  const uid = useSession((state) => state.user?.uid)
  const saveProfile = useSession((state) => state.saveProfile)
  const addTokens = useTokens((state) => state.add)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ axes: QuizAxes; personaId: string } | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [saving, setSaving] = useState(false)

  const question = quizQuestions[index]

  async function choose(optionId: string) {
    const next = { ...answers, [question.id]: optionId }
    setAnswers(next)
    if (index < quizQuestions.length - 1) {
      setIndex(index + 1)
      return
    }
    if (!uid) return
    const axes = scoreQuiz(next)
    const persona = personaFor(axes)
    setSaving(true)
    try {
      await backend().saveQuizResult(uid, { personaId: persona.id, axes, answers: next, completedAt: Date.now() })
      await saveProfile({ quiz: { personaId: persona.id, axes } })
      addTokens(uid, 10)
      setResult({ axes, personaId: persona.id })
      setTimeout(() => {
        setRevealed(true)
        celebrate()
      }, 900)
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Could not save your result.', 'error')
    } finally {
      setSaving(false)
    }
  }

  function restart() {
    setIndex(0)
    setAnswers({})
    setResult(null)
    setRevealed(false)
  }

  if (result) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-6 pb-10 pt-4 text-center">
        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.div key="capsule" exit={{ scale: 1.6, opacity: 0 }} animate={{ rotate: [0, -10, 10, -10, 10, 0] }} transition={{ duration: 0.8 }}>
              <Capsule color="lilac" size={140} />
              <p className="mt-4 font-display text-xl font-semibold">Cracking your capsule…</p>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              className="flex flex-col items-center gap-6"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            >
              <p className="font-display font-bold tracking-widest text-lilac-deep">YOUR CO-OP PLAYER TYPE</p>
              <PersonaBadge personaId={result.personaId} size="lg" />
              <div className="gloss-card w-full p-5 text-left">
                {quizAxes.map((axis) => (
                  <div key={axis} className="mb-3 last:mb-0">
                    <div className="mb-1 flex justify-between font-display text-sm font-semibold">
                      <span>{axisLabels[axis][0]}</span>
                      <span>{axisLabels[axis][1]}</span>
                    </div>
                    <div className="relative h-3 rounded-full bg-blush">
                      <motion.span
                        className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-bubblegum shadow"
                        initial={{ left: '50%' }}
                        animate={{ left: `${result.axes[axis]}%` }}
                        transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.2 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-ink-soft">+10 tokens! Your vibe % now shows on every profile. It’s just for fun, not a science.</p>
              <div className="flex gap-3">
                <ArcadeButton color="white" onClick={restart}>Retake</ArcadeButton>
                <Link to="/discover" className="btn-arcade h-12 px-6" style={arcadeVars('bubblegum')}>Find my player two</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl pb-10">
      <div className="mb-5">
        <p className="font-display font-semibold text-ink-soft">Compatibility Quiz</p>
        <div className="mt-2 flex gap-1.5" aria-label={`Question ${index + 1} of ${quizQuestions.length}`}>
          {quizQuestions.map((entry, position) => (
            <span key={entry.id} className={`h-2.5 flex-1 rounded-full border border-white ${position < index ? 'bg-lilac' : position === index ? 'bg-bubblegum' : 'bg-white/80'}`} />
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ x: 50, opacity: 0, rotate: 2 }}
          animate={{ x: 0, opacity: 1, rotate: 0 }}
          exit={{ x: -50, opacity: 0, rotate: -2 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <h1 className="mb-5 text-3xl font-bold">{question.prompt}</h1>
          <div className="grid gap-3 sm:grid-cols-2">
            {question.options.map((option, position) => (
              <motion.button
                key={option.id}
                type="button"
                disabled={saving}
                onClick={() => choose(option.id)}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.96 }}
                className={`gloss-card flex items-center gap-3 p-4 text-left ${answers[question.id] === option.id ? 'ring-4 ring-bubblegum' : ''}`}
              >
                <span className={`grid size-14 shrink-0 place-items-center rounded-2xl text-3xl ${optionColors[position % optionColors.length]}`} aria-hidden>
                  {option.emoji}
                </span>
                <span className="font-display text-lg font-medium leading-snug">{option.label}</span>
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
