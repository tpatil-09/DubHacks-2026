import type { QuizAxes } from '../types'
import { quizAxes } from '../games/quiz/scoring'

/** Just-for-fun compatibility: 100 minus the average axis distance. */
export function vibePercent(a: QuizAxes, b: QuizAxes): number {
  const totalDiff = quizAxes.reduce((sum, axis) => sum + Math.abs(a[axis] - b[axis]), 0)
  return Math.max(0, Math.min(100, Math.round(100 - totalDiff / quizAxes.length)))
}
