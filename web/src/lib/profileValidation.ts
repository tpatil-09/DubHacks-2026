import type { Profile } from '../types'
import { ageFrom } from './age'

export type ProfileDraft = Pick<
  Profile,
  'firstName' | 'lastName' | 'birthdate' | 'gender' | 'genderOther' | 'interestedIn' | 'interestedInOther' | 'pronouns'
  | 'relationshipIntent' | 'ageRange' | 'city' | 'bio' | 'prompts' | 'photos' | 'interests'
> & Required<Pick<Profile, 'interestedIn'>>

export const emptyDraft: ProfileDraft = {
  firstName: '',
  lastName: '',
  birthdate: '',
  gender: '',
  genderOther: '',
  interestedIn: [],
  interestedInOther: '',
  pronouns: '',
  relationshipIntent: undefined,
  ageRange: { min: 18, max: 99 },
  city: '',
  bio: '',
  prompts: [],
  photos: [],
  interests: [],
}

export const LIMITS = { name: 30, city: 40, bio: 300, promptAnswer: 120, minInterests: 3, maxInterests: 10, maxPhotos: 6 }

export function validateBasics(draft: ProfileDraft, today: Date = new Date()): string | null {
  if (!draft.firstName.trim()) return 'Add your first name.'
  if (!draft.lastName.trim()) return 'Add your last name.'
  if (draft.firstName.trim().length > LIMITS.name || draft.lastName.trim().length > LIMITS.name) return `Names can be up to ${LIMITS.name} characters.`
  const age = ageFrom(draft.birthdate, today)
  if (age === null) return 'Add your date of birth.'
  if (age < 18) return 'You need to be 18 or older to use Havenly.'
  if (age > 120) return 'Please double-check your date of birth.'
  if (!draft.gender) return 'Pick the gender that fits you best.'
  if (draft.gender === 'other' && !draft.genderOther?.trim()) return 'Add a short description for the “Other” gender option.'
  if (draft.interestedIn.length === 0) return 'Pick who you’d like to meet.'
  if (draft.interestedIn.includes('other') && !draft.interestedInOther?.trim()) return 'Add a short description for the “Other” option.'
  if (draft.pronouns && draft.pronouns.length > 40) return 'Pronouns can be up to 40 characters.'
  if (draft.city.trim().length < 2) return 'Add the city or region where you live.'
  if (draft.city.trim().length > LIMITS.city) return `Location can be up to ${LIMITS.city} characters.`
  return null
}

export function validatePreferences(draft: ProfileDraft): string | null {
  const range = draft.ageRange
  if (!range || !Number.isInteger(range.min) || !Number.isInteger(range.max) || range.min < 18 || range.max > 120 || range.min > range.max) {
    return 'Choose a valid preferred age range from 18 to 120.'
  }
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
    firstName: profile.firstName,
    lastName: profile.lastName,
    birthdate: profile.birthdate,
    gender: profile.gender,
    genderOther: profile.genderOther ?? '',
    interestedIn: profile.interestedIn ?? [],
    interestedInOther: profile.interestedInOther ?? '',
    pronouns: profile.pronouns ?? '',
    relationshipIntent: profile.relationshipIntent,
    ageRange: profile.ageRange ?? { min: 18, max: 99 },
    city: profile.city,
    bio: profile.bio,
    prompts: profile.prompts,
    photos: profile.photos,
    interests: profile.interests,
  }
}
