import type { Profile } from '../types'

const genderGroup: Record<string, string> = { woman: 'women', man: 'men', nonbinary: 'nonbinary' }

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
      (!me?.ageRange || (profile.age >= me.ageRange.min && profile.age <= me.ageRange.max)) &&
      (!profile.ageRange || !me?.age || (me.age >= profile.ageRange.min && me.age <= profile.ageRange.max)) &&
      (!me?.relationshipIntent || !profile.relationshipIntent || me.relationshipIntent === profile.relationshipIntent || me.relationshipIntent === 'open' || profile.relationshipIntent === 'open'),
  )
}
