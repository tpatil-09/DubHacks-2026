import { describe, expect, it } from 'vitest'
import {
  PUZZLE_KEY,
  answerSimilarity,
  buzzQuizzes,
  funGames,
  isComplete,
  matchPuzzles,
  rankTwins,
  scoreBuzzQuiz,
  seededAnswers,
} from './games'

describe('buzz quizzes', () => {
  it('every option scores real results and every result is reachable', () => {
    for (const quiz of buzzQuizzes) {
      const ids = new Set(quiz.results.map((result) => result.id))
      const reached = new Set<string>()
      for (const question of quiz.questions) {
        expect(question.options.length, `${quiz.id}/${question.id}`).toBeGreaterThanOrEqual(3)
        for (const option of question.options) {
          for (const id of Object.keys(option.points)) {
            expect(ids.has(id), `${quiz.id}/${option.id}->${id}`).toBe(true)
            reached.add(id)
          }
        }
      }
      expect([...ids].every((id) => reached.has(id)), quiz.id).toBe(true)
    }
  })

  it('scoring follows the points and is deterministic', () => {
    const quiz = buzzQuizzes[0]
    // Always pick the option giving the most "time" points.
    const answers = Object.fromEntries(
      quiz.questions.map((q) => [q.id, [[...q.options].sort((a, b) => (b.points.time ?? 0) - (a.points.time ?? 0))[0].id]]),
    )
    expect(scoreBuzzQuiz(quiz, answers).id).toBe('time')
    expect(scoreBuzzQuiz(quiz, answers)).toEqual(scoreBuzzQuiz(quiz, answers))
  })
})

describe('match puzzles', () => {
  it('have unique options and enough choices', () => {
    for (const puzzle of matchPuzzles) {
      expect(new Set(puzzle.options.map((o) => o.id)).size).toBe(puzzle.options.length)
      expect(puzzle.options.length).toBeGreaterThan(puzzle.pick * 2)
    }
  })

  it('are complete only with exactly the required number of picks', () => {
    const puzzle = matchPuzzles[0]
    const ids = puzzle.options.map((o) => o.id)
    expect(isComplete(puzzle, { [PUZZLE_KEY]: ids.slice(0, puzzle.pick - 1) })).toBe(false)
    expect(isComplete(puzzle, { [PUZZLE_KEY]: ids.slice(0, puzzle.pick) })).toBe(true)
  })
})

describe('similarity', () => {
  it('is 100 for identical, 0 for disjoint, and symmetric', () => {
    expect(answerSimilarity({ picks: ['a', 'b', 'c'] }, { picks: ['c', 'b', 'a'] })).toBe(100)
    expect(answerSimilarity({ picks: ['a', 'b'] }, { picks: ['c', 'd'] })).toBe(0)
    const x = { q1: ['a'], q2: ['b'] }
    const y = { q1: ['a'], q2: ['c'] }
    expect(answerSimilarity(x, y)).toBe(50)
    expect(answerSimilarity(y, x)).toBe(50)
  })

  it('ranks twins most similar first and drops zero matches', () => {
    const twins = rankTwins({ picks: ['a', 'b', 'c'] }, { low: { picks: ['a', 'x', 'y'] }, high: { picks: ['a', 'b', 'c'] }, none: { picks: ['x', 'y', 'z'] } })
    expect(twins.map((t) => t.uid)).toEqual(['high', 'low'])
  })
})

describe('seeded demo answers', () => {
  it('are deterministic and complete for every game', () => {
    for (const game of funGames) {
      const answers = seededAnswers('demo-maya', game)
      expect(answers).toEqual(seededAnswers('demo-maya', game))
      expect(isComplete(game, answers), game.id).toBe(true)
    }
  })
})

describe('demo twins', () => {
  it('demo members give every player some twins to see', async () => {
    const { demoProfiles } = await import('../../fixtures/demoProfiles')
    for (const game of funGames) {
      const others = Object.fromEntries(demoProfiles.map((p) => [p.uid, seededAnswers(p.uid, game)]))
      for (const seed of ['player-a', 'player-b', 'player-c']) {
        expect(rankTwins(seededAnswers(seed, game), others).length, `${game.id}/${seed}`).toBeGreaterThan(0)
      }
    }
  })
})
