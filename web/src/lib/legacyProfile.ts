import type { Profile } from '../types'

/**
 * Profiles saved by older app versions and the seed script have `displayName`/`age`
 * instead of `firstName`/`lastName`/`birthdate`. Fill the new fields so they render.
 */
export function legacyNameAndAge(data: Record<string, unknown>, today: Date = new Date()): Partial<Profile> {
  const patch: Partial<Profile> = {}
  if (typeof data.firstName !== 'string' || !data.firstName) {
    const [first = '', ...rest] = typeof data.displayName === 'string' ? data.displayName.trim().split(/\s+/) : []
    patch.firstName = first
    if (typeof data.lastName !== 'string') patch.lastName = rest.join(' ')
  }
  if (typeof data.lastName !== 'string' && !('lastName' in patch)) patch.lastName = ''
  if ((typeof data.birthdate !== 'string' || !data.birthdate) && typeof data.age === 'number' && data.age > 0) {
    // January 1st gives the stored age for the rest of the year.
    patch.birthdate = `${today.getFullYear() - data.age}-01-01`
  }
  return patch
}
