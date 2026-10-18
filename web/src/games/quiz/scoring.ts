import type { QuizAxes, QuizAxis } from '../../types'
import { quizQuestions, type QuizQuestion } from './questions'

export const quizAxes: QuizAxis[] = ['cozyAdventurous', 'plannerSpontaneous', 'chattyChill', 'nightEarly']

export const axisLabels: Record<QuizAxis, [string, string]> = {
  cozyAdventurous: ['Cozy', 'Adventurous'],
  plannerSpontaneous: ['Planner', 'Spontaneous'],
  chattyChill: ['Chatty', 'Chill'],
  nightEarly: ['Night owl', 'Early bird'],
}

/** Converts answers into 0–100 scores per axis (50 = neutral). */
export function scoreQuiz(answers: Record<string, string>, questions: QuizQuestion[] = quizQuestions): QuizAxes {
  const axes = {} as QuizAxes
  for (const axis of quizAxes) {
    let total = 0
    let maxAbs = 0
    for (const question of questions) {
      maxAbs += Math.max(0, ...question.options.map((option) => Math.abs(option.scores[axis] ?? 0)))
      const chosen = question.options.find((option) => option.id === answers[question.id])
      total += chosen?.scores[axis] ?? 0
    }
    axes[axis] = maxAbs === 0 ? 50 : Math.round(50 + (50 * total) / maxAbs)
  }
  return axes
}
