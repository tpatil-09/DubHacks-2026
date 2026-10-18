import { describe, expect, it } from 'vitest'
import { quizQuestions } from './quiz/questions'
import { scoreQuiz, quizAxes } from './quiz/scoring'
import { personaFor, personas } from './quiz/personas'
import { nextWyrPrompt, wyrPrompts } from './wouldYouRather/prompts'
import { cleanNote, paperPatterns, rollPapers } from './paperAirplane/papers'
import { vibePercent } from '../lib/vibe'

const pickEvery = (pick: (options: (typeof quizQuestions)[number]['options']) => string) =>
  Object.fromEntries(quizQuestions.map((question) => [question.id, pick(question.options)]))

describe('scoreQuiz', () => {
  it('keeps every axis within 0–100', () => {
    for (const index of [0, 1, 2, 3]) {
      const axes = scoreQuiz(pickEvery((options) => options[index % options.length].id))
      for (const axis of quizAxes) {
        expect(axes[axis]).toBeGreaterThanOrEqual(0)
        expect(axes[axis]).toBeLessThanOrEqual(100)
      }
    }
  })

  it('scores 50 on every axis when nothing is answered', () => {
    const axes = scoreQuiz({})
    for (const axis of quizAxes) expect(axes[axis]).toBe(50)
  })

  it('leans adventurous when picking the most adventurous option each time', () => {
    const axes = scoreQuiz(
      pickEvery((options) => [...options].sort((a, b) => (b.scores.cozyAdventurous ?? 0) - (a.scores.cozyAdventurous ?? 0))[0].id),
    )
    expect(axes.cozyAdventurous).toBeGreaterThan(50)
  })
})

describe('personaFor', () => {
  it('maps all 8 corners to 8 distinct personas', () => {
    const ids = new Set<string>()
    for (const a of [0, 100]) for (const p of [0, 100]) for (const n of [0, 100]) {
      ids.add(personaFor({ cozyAdventurous: a, plannerSpontaneous: p, chattyChill: 50, nightEarly: n }).id)
    }
    expect(ids.size).toBe(8)
    expect(personas).toHaveLength(8)
  })
})

describe('vibePercent', () => {
  const base = { cozyAdventurous: 20, plannerSpontaneous: 80, chattyChill: 50, nightEarly: 10 }

  it('is 100 for identical results and symmetric', () => {
    const other = { cozyAdventurous: 70, plannerSpontaneous: 30, chattyChill: 90, nightEarly: 60 }
    expect(vibePercent(base, base)).toBe(100)
    expect(vibePercent(base, other)).toBe(vibePercent(other, base))
  })

  it('is 0 for complete opposites', () => {
    expect(vibePercent(
      { cozyAdventurous: 0, plannerSpontaneous: 0, chattyChill: 0, nightEarly: 0 },
      { cozyAdventurous: 100, plannerSpontaneous: 100, chattyChill: 100, nightEarly: 100 },
    )).toBe(0)
  })
})

describe('paper airplanes', () => {
  it('deals three sheets with different colors and patterns', () => {
    const sheets = rollPapers()
    expect(sheets).toHaveLength(3)
    expect(new Set(sheets.map((sheet) => sheet.color)).size).toBe(3)
    expect(new Set(sheets.map((sheet) => sheet.pattern)).size).toBe(3)
    for (const sheet of sheets) expect(paperPatterns).toContain(sheet.pattern)
  })

  it('rejects a blank note and keeps a real one', () => {
    expect(() => cleanNote('   ')).toThrow()
    expect(cleanNote('  hi there  ')).toBe('hi there')
  })
})

describe('Would You Rather prompts', () => {
  it('has unique ids', () => {
    expect(new Set(wyrPrompts.map((prompt) => prompt.id)).size).toBe(wyrPrompts.length)
  })

  it('prefers unanswered prompts', () => {
    const answered = new Set(wyrPrompts.slice(1).map((prompt) => prompt.id))
    expect(nextWyrPrompt(answered, () => 0.99).id).toBe(wyrPrompts[0].id)
  })
})
