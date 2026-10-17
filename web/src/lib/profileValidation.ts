import type { Profile } from '../types'
import { ageFrom } from './age'

export type ProfileDraft = Pick<
  Profile,
  'displayName' | 'birthdate' | 'gender' | 'interestedIn' | 'city' | 'bio' | 'prompts' | 'photos' | 'interests'
>

export const emptyDraft: ProfileDraft = {
  displayName: '',
  birthdate: '',
  gender: '',
  interestedIn: [],
  city: '',
  bio: '',
  prompts: [],
  photos: [],
  interests: [],
}

export const LIMITS = { name: 30, city: 40, bio: 300, promptAnswer: 120, minInterests: 3, maxInterests: 10, maxPhotos: 6 }

export function validateBasics(draft: ProfileDraft, today?: Date): string | null {
  if (!draft.displayName.trim()) return 'Add the name you want people to see.'
  if (draft.displayName.trim().length > LIMITS.name) return `Names can be up to ${LIMITS.name} characters.`
  const age = ageFrom(draft.birthdate, today)
  if (age === null) return 'Add a valid birthdate.'
  if (age < 18) return 'You need to be 18 or older to use Vetted.'
  if (age > 120) return 'Please double-check your birthdate.'
  if (!draft.gender) return 'Pick the gender that fits you best.'
  if (draft.interestedIn.length === 0) return 'Pick who you’d like to meet.'
  if (draft.city.trim().length > LIMITS.city) return `City can be up to ${LIMITS.city} characters.`
  return null
}

export function validatePhotos(draft: ProfileDraft): string | null {
  if (draft.photos.length === 0) return 'Add at least one photo or pick an avatar.'
  if (draft.photos.length > LIMITS.maxPhotos) return `You can add up to ${LIMITS.maxPhotos} photos.`
  return null
}

export function validateAbout(draft: ProfileDraft): string | null {
  if (draft.bio.trim().length === 0) return 'Write a short bio.'
  if (draft.bio.length > LIMITS.bio) return `Bios can be up to ${LIMITS.bio} characters.`
  if (draft.interests.length < LIMITS.minInterests) return `Pick at least ${LIMITS.minInterests} interest stickers.`
  if (draft.interests.length > LIMITS.maxInterests) return `Pick up to ${LIMITS.maxInterests} interest stickers.`
  if (draft.prompts.some((prompt) => prompt.answer.length > LIMITS.promptAnswer)) return `Prompt answers can be up to ${LIMITS.promptAnswer} characters.`
  return null
}

export function draftFromProfile(profile: Profile | null): ProfileDraft {
  if (!profile) return { ...emptyDraft }
  return {
    displayName: profile.displayName,
    birthdate: profile.birthdate,
    gender: profile.gender,
    interestedIn: profile.interestedIn,
    city: profile.city,
    bio: profile.bio,
    prompts: profile.prompts,
    photos: profile.photos,
    interests: profile.interests,
  }
}
