import { describe, expect, it } from 'vitest'
import { filterDiscover } from './discoverFilter'
import { demoProfiles } from '../fixtures/demoProfiles'
import { ageFrom } from '../lib/age'

const me = { ...demoProfiles[0], uid: 'me', interestedIn: [], ageRange: undefined }

describe('filterDiscover age ranges', () => {
  it('keeps only people inside my age range', () => {
    const shown = filterDiscover({ ...me, ageRange: { min: 26, max: 28 } }, demoProfiles, new Set(), new Set())
    expect(shown.length).toBeGreaterThan(0)
    for (const p of shown) {
      const age = ageFrom(p.birthdate)!
      expect(age).toBeGreaterThanOrEqual(26)
      expect(age).toBeLessThanOrEqual(28)
    }
  })

  it('hides people whose own age range excludes me', () => {
    const picky = { ...demoProfiles[1], ageRange: { min: 90, max: 99 } }
    expect(filterDiscover(me, [picky], new Set(), new Set())).toHaveLength(0)
  })

  it('every demo profile has a valid birthdate and first name', () => {
    for (const p of demoProfiles) {
      expect(ageFrom(p.birthdate), p.uid).not.toBeNull()
      expect(p.firstName, p.uid).toBeTruthy()
    }
  })
})
