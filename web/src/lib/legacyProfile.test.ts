import { describe, expect, it } from 'vitest'
import { legacyNameAndAge } from './legacyProfile'
import { ageFrom } from './age'

const today = new Date(2026, 9, 17)

describe('legacyNameAndAge', () => {
  it('fills firstName and birthdate from old displayName/age profiles', () => {
    const patch = legacyNameAndAge({ displayName: 'Jordan Lee', age: 29 }, today)
    expect(patch).toMatchObject({ firstName: 'Jordan', lastName: 'Lee' })
    expect(ageFrom(patch.birthdate!, today)).toBe(29)
  })

  it('leaves new-style profiles untouched', () => {
    expect(legacyNameAndAge({ firstName: 'Maya', lastName: 'Torres', birthdate: '1999-06-15' }, today)).toEqual({})
  })

  it('handles a profile with no name or age', () => {
    expect(legacyNameAndAge({}, today)).toEqual({ firstName: '', lastName: '' })
  })
})
