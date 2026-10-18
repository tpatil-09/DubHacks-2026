import type { Profile } from '../types'
import { interestById } from './interests'

/** Interest ids both profiles picked, in `b`'s order, capped at 3 — plenty for one date idea. */
export function sharedInterestIds(a: Profile | null, b: Profile | null): string[] {
  if (!a || !b) return []
  const mine = new Set(a.interests)
  return b.interests.filter((id) => mine.has(id)).slice(0, 3)
}

/** A short, concrete activity for each catalog interest, written to slot into "Let's do {A} and then {B}…". */
const ACTIVITY_PHRASES: Record<string, string> = {
  ramen: 'an instant ramen eating contest',
  mariokart: 'a Mario Kart rematch',
  ceramics: 'a pottery class',
  hiking: 'a scenic hike',
  boba: 'a boba run',
  cats: 'a cat café visit',
  dogs: 'a trip to the dog park',
  baking: 'a baking showdown',
  anime: 'an anime marathon',
  boardgames: 'a board game night',
  indiegames: 'an indie game co-op session',
  climbing: 'a climbing gym session',
  thrifting: 'a thrift store treasure hunt',
  plants: 'a plant nursery wander',
  karaoke: 'a karaoke session',
  reading: 'a cozy bookstore browse',
  coffee: 'a coffee shop crawl',
  running: 'a sunrise run',
  photography: 'a photo walk',
  cooking: 'a cook-together night',
  concerts: 'a live music show',
  travel: 'a day-trip planning session',
  yoga: 'a yoga class',
  art: 'an art gallery visit',
  movies: 'a movie night',
  cycling: 'a bike ride',
  astronomy: 'a stargazing night',
  dancing: 'a dance class',
  gardening: 'a garden stroll',
  puzzles: 'a puzzle-solving session',
}

function activityFor(id: string): string {
  return ACTIVITY_PHRASES[id] ?? `some ${(interestById(id)?.label ?? id).toLowerCase()}`
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

const CLOSERS = ['and make it the perfect first date!', 'and call it a date!', '— the perfect first date!']
const SOLO_SECOND_LINES = [
  "It's exactly the kind of thing that makes for a great first date.",
  'Simple, fun, and a good excuse to talk for hours.',
]
const FALLBACK_LINES = [
  'Grab coffee and see where the conversation goes.',
  "Sometimes the best dates start with the easiest plans — let's keep it low-key.",
]

/** Zero-infra fallback used when there's no live AI call available (offline, demo mode, or the live call failed). */
export function templatedDateIdea(sharedIds: string[], city?: string | null): string {
  const activities = sharedIds.map(activityFor)
  let idea: string
  if (activities.length >= 2) {
    idea = `Let's have ${activities[0]} and then ${activities[1]}, ${pick(CLOSERS)}`
    if (activities[2]) idea += ` We could even squeeze in ${activities[2]} if we're having a good time.`
  } else if (activities.length === 1) {
    idea = `Let's do ${activities[0]}! ${pick(SOLO_SECOND_LINES)}`
  } else {
    idea = `Let's keep it simple: ${pick(FALLBACK_LINES)}`
  }
  if (city) idea += ` Bonus points if we can find a good spot in ${city}.`
  return idea
}
