import type { Profile } from '../types'
import { ageFrom } from '../lib/age'

const genderGroup: Record<string, string> = { woman: 'women', man: 'men', nonbinary: 'nonbinary' }

function matchesRange(age: number | null, range: { min: number; max: number } | undefined, allowUnknown: boolean): boolean {
  if (!range) return true
  if (age === null) return allowUnknown
  return age >= range.min && age <= range.max
}

/** Removes yourself, people you've already liked/passed, blocked users, and genders you're not looking for. */
export function filterDiscover(
  me: Profile | null,
  candidates: Profile[],
  seen: Set<string>,
  blocked: Set<string>,
): Profile[] {
  const wants = new Set(me?.interestedIn ?? [])
  return candidates.filter(
    (profile) =>
      profile.uid !== me?.uid &&
      profile.discoverable &&
      !seen.has(profile.uid) &&
      !blocked.has(profile.uid) &&
      (wants.size === 0 || wants.has(genderGroup[profile.gender] ?? profile.gender)) &&
      matchesRange(ageFrom(profile.birthdate), me?.ageRange, false) &&
      matchesRange(me?.birthdate ? ageFrom(me.birthdate) : null, profile.ageRange, true) &&
      (!me?.relationshipIntent || !profile.relationshipIntent || me.relationshipIntent === profile.relationshipIntent || me.relationshipIntent === 'open' || profile.relationshipIntent === 'open'),
  )
}
