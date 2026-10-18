import { describe, expect, it } from 'vitest'
import { ageFrom } from './age'
import { emptyDraft, validateBasics } from './profileValidation'
import { filterDiscover } from '../data/discoverFilter'
import { demoProfiles } from '../fixtures/demoProfiles'
import type { Profile } from '../types'

const today = new Date('2026-10-17T12:00:00')

describe('ageFrom', () => {
  it('counts birthdays correctly', () => {
    expect(ageFrom('2008-10-17', today)).toBe(18)
    expect(ageFrom('2008-10-18', today)).toBe(17)
    expect(ageFrom('not-a-date', today)).toBeNull()
  })
})

describe('validateBasics', () => {
  const draft = { ...emptyDraft, displayName: 'Alex', age: 26, gender: 'woman', interestedIn: ['men'], city: 'Seattle' }

  it('accepts a complete adult profile', () => {
    expect(validateBasics(draft)).toBeNull()
  })

  it('rejects anyone under 18', () => {
    expect(validateBasics({ ...draft, age: 17 })).toMatch(/18/)
  })

  it('requires a name', () => {
    expect(validateBasics({ ...draft, displayName: '  ' })).not.toBeNull()
  })
})

describe('filterDiscover', () => {
  const me: Profile = { ...demoProfiles[0], uid: 'me', gender: 'man', interestedIn: ['women'] }

  it('removes yourself, seen, blocked, hidden, and unwanted genders', () => {
    const hidden = { ...demoProfiles[1], uid: 'hidden', gender: 'woman', discoverable: false }
    const result = filterDiscover(me, [me, hidden, ...demoProfiles], new Set([demoProfiles[0].uid]), new Set([demoProfiles[1].uid]))
    expect(result.some((profile) => ['me', 'hidden', demoProfiles[0].uid, demoProfiles[1].uid].includes(profile.uid))).toBe(false)
    expect(result.every((profile) => profile.gender === 'woman')).toBe(true)
  })

  it('shows everyone discoverable when no preference is set', () => {
    const open = { ...me, interestedIn: [] }
    expect(filterDiscover(open, demoProfiles, new Set(), new Set())).toHaveLength(demoProfiles.filter((profile) => profile.discoverable).length)
  })
})
