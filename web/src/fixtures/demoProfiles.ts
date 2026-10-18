import type { Profile, QuizAxes, WyrChoice } from '../types'
import { personaFor } from '../games/quiz/personas'
import { wyrPrompts } from '../games/wouldYouRather/prompts'

// Fictional, clearly labeled demo profiles. Never use real people here: demo photos are AI-generated faces.

interface DemoSeed {
  uid: string
  firstName: string
  lastName: string
  birthdate: string
  gender: 'woman' | 'man' | 'nonbinary'
  city: string
  avatar: [emoji: string, color: string]
  bio: string
  interests: string[]
  prompts: [string, string][]
  axes: QuizAxes
  generatedAvatar?: boolean
}

const seeds: DemoSeed[] = [
  {
    uid: 'demo-maya', firstName: 'Maya', lastName: 'Torres', birthdate: '1999-06-15', gender: 'woman', city: 'Seattle, WA', avatar: ['🦊', 'peach'],
    bio: 'Ceramics on Tuesdays, ramen on Thursdays, Mario Kart champion every day.',
    interests: ['ceramics', 'ramen', 'mariokart', 'plants'],
    prompts: [['My perfect Sunday…', 'Farmers market, a nap, then a pottery wheel.'], ["I'll beat you at…", 'Rainbow Road. No items.']],
    axes: { cozyAdventurous: 40, plannerSpontaneous: 62, chattyChill: 35, nightEarly: 30 },
  },
  {
    uid: 'demo-jules', firstName: 'Jules', lastName: 'Bennett', birthdate: '1997-06-15', gender: 'nonbinary', city: 'Tacoma, WA', avatar: ['🐻', 'lilac'],
    bio: 'Board game collector and bad-pun enthusiast. Will teach you Wingspan.',
    interests: ['boardgames', 'coffee', 'reading', 'puzzles'],
    prompts: [['A green flag I look for…', 'You read the rules before the game night.'], ["I'm weirdly good at…", 'Parallel parking.']],
    axes: { cozyAdventurous: 25, plannerSpontaneous: 20, chattyChill: 55, nightEarly: 60 },
  },
  {
    uid: 'demo-sam', firstName: 'Sam', lastName: 'Okafor', birthdate: '2000-06-15', gender: 'man', city: 'Seattle, WA', avatar: ['🐸', 'mint'],
    bio: 'Trail runner, terrible baker, great dog-sitter.',
    interests: ['running', 'hiking', 'baking', 'dogs'],
    prompts: [['The way to my heart is…', 'Trail mix with extra chocolate.'], ['My go-to karaoke song…', 'Mr. Brightside, every time.']],
    axes: { cozyAdventurous: 80, plannerSpontaneous: 55, chattyChill: 40, nightEarly: 78 },
  },
  {
    uid: 'demo-priya', firstName: 'Priya', lastName: 'Nair', birthdate: '1998-06-15', gender: 'woman', city: 'Bellevue, WA', avatar: ['🐱', 'blush'],
    bio: 'Anime rewatcher, boba ranker, and amateur astronomer.',
    interests: ['anime', 'boba', 'astronomy', 'cats'],
    prompts: [['My perfect Sunday…', 'Telescope on the roof, snacks on the blanket.'], ['A green flag I look for…', 'You have a favorite constellation.']],
    axes: { cozyAdventurous: 35, plannerSpontaneous: 45, chattyChill: 30, nightEarly: 15 },
  },
  {
    uid: 'demo-leo', firstName: 'Leo', lastName: 'Marchetti', birthdate: '1996-06-15', gender: 'man', city: 'Redmond, WA', avatar: ['🐼', 'sky'],
    bio: 'Indie game dev by day, karaoke menace by night.',
    interests: ['indiegames', 'karaoke', 'concerts', 'movies'],
    prompts: [["I'll beat you at…", 'Any rhythm game.'], ['My go-to karaoke song…', 'Dancing Queen.']],
    axes: { cozyAdventurous: 60, plannerSpontaneous: 70, chattyChill: 20, nightEarly: 20 },
  },
  {
    uid: 'demo-noor', firstName: 'Noor', lastName: 'Hassan', birthdate: '2001-06-15', gender: 'woman', city: 'Seattle, WA', avatar: ['🦋', 'butter'],
    bio: 'Plant mom of 34. Yes, they all have names.',
    interests: ['plants', 'gardening', 'yoga', 'thrifting'],
    prompts: [['The way to my heart is…', 'A cutting from your favorite plant.'], ["I'm weirdly good at…", 'Finding vintage jackets for $5.']],
    axes: { cozyAdventurous: 30, plannerSpontaneous: 35, chattyChill: 60, nightEarly: 85 },
  },
  {
    uid: 'demo-kai', firstName: 'Kai', lastName: 'Nakamura', birthdate: '1995-06-15', gender: 'man', city: 'Seattle, WA', avatar: ['🐙', 'lilac'],
    bio: 'Climber, cyclist, and a surprisingly good cook.',
    interests: ['climbing', 'cycling', 'cooking', 'travel'],
    prompts: [['My perfect Sunday…', 'Bouldering, then a giant brunch.'], ['A green flag I look for…', 'You like trying new food.']],
    axes: { cozyAdventurous: 88, plannerSpontaneous: 40, chattyChill: 50, nightEarly: 65 },
  },
  {
    uid: 'demo-ivy', firstName: 'Ivy', lastName: 'Donnelly', birthdate: '1999-06-15', gender: 'woman', city: 'Kirkland, WA', avatar: ['🌷', 'blush'],
    bio: 'Painter, dancer, and professional overthinker.',
    interests: ['art', 'dancing', 'photography', 'coffee'],
    prompts: [["I'll beat you at…", 'Pictionary. Easily.'], ['The way to my heart is…', 'A good playlist and a better croissant.']],
    axes: { cozyAdventurous: 55, plannerSpontaneous: 75, chattyChill: 25, nightEarly: 40 },
  },
  {
    uid: 'demo-theo', firstName: 'Theo', lastName: 'Papadakis', birthdate: '1998-06-15', gender: 'man', city: 'Seattle, WA', avatar: ['🐧', 'sky'],
    bio: 'Puzzle hunter, sci-fi reader, and always down for a night market.',
    interests: ['puzzles', 'reading', 'ramen', 'movies'],
    prompts: [['My perfect Sunday…', 'Crossword, coffee, and a long walk.'], ["I'm weirdly good at…", 'Escape rooms.']],
    axes: { cozyAdventurous: 45, plannerSpontaneous: 30, chattyChill: 45, nightEarly: 25 },
  },
  {
    uid: 'demo-river', firstName: 'River', lastName: 'Whitfield', birthdate: '2000-06-15', gender: 'nonbinary', city: 'Seattle, WA', avatar: ['🦦', 'mint'],
    bio: 'Kayaks, cozy sweaters, and the best hot chocolate recipe.',
    interests: ['travel', 'baking', 'photography', 'cats'],
    prompts: [['A green flag I look for…', 'You text back the same day.'], ['The way to my heart is…', 'Hot chocolate with too many marshmallows.']],
    axes: { cozyAdventurous: 65, plannerSpontaneous: 50, chattyChill: 55, nightEarly: 55 },
  },
  {
    uid: 'demo-alex', displayName: 'Alex', age: 27, gender: 'nonbinary', city: 'Seattle, WA', avatar: ['🐝', 'butter'], generatedAvatar: true,
    bio: 'Bookstore wanderer, amateur bread baker, and loyal ferry-window seat defender.',
    interests: ['baking', 'reading', 'ferries', 'coffee'],
    prompts: [['A perfect first date…', 'Coffee, then getting pleasantly lost in a bookstore.'], ['A tiny hill I will die on…', 'The ferry ride counts as part of the vacation.']],
    axes: { cozyAdventurous: 42, plannerSpontaneous: 38, chattyChill: 48, nightEarly: 58 },
  },
  {
    uid: 'demo-jamie', displayName: 'Jamie', age: 25, gender: 'woman', city: 'Seattle, WA', avatar: ['🦝', 'peach'], generatedAvatar: true,
    bio: 'Thrift-store treasure hunter who always orders one more side for the table.',
    interests: ['thrifting', 'food', 'live music', 'walking'],
    prompts: [['My ideal Saturday…', 'A vintage shop, dumplings, and a small venue show.'], ['Teach me about…', 'Your very specific favorite neighborhood snack.']],
    axes: { cozyAdventurous: 68, plannerSpontaneous: 73, chattyChill: 35, nightEarly: 28 },
  },
  {
    uid: 'demo-morgan', displayName: 'Morgan', age: 29, gender: 'man', city: 'Seattle, WA', avatar: ['🐢', 'mint'], generatedAvatar: true,
    bio: 'Parks-and-rec trivia enthusiast, casual kayaker, serious breakfast person.',
    interests: ['trivia', 'kayaking', 'brunch', 'podcasts'],
    prompts: [['We will get along if…', 'You enjoy a low-stakes trivia rematch.'], ['My comfort food…', 'A big breakfast after a rainy walk.']],
    axes: { cozyAdventurous: 52, plannerSpontaneous: 32, chattyChill: 62, nightEarly: 70 },
  },
  {
    uid: 'demo-taylor', displayName: 'Taylor', age: 28, gender: 'woman', city: 'Seattle, WA', avatar: ['🦜', 'lilac'], generatedAvatar: true,
    bio: 'Ceramics beginner, playlist maker, and enthusiastic supporter of patio season.',
    interests: ['ceramics', 'music', 'picnics', 'plants'],
    prompts: [['My most used app…', 'The one with all my extremely specific playlists.'], ['Let’s make a plan to…', 'Find a sunny park bench and split a pastry.']],
    axes: { cozyAdventurous: 48, plannerSpontaneous: 66, chattyChill: 30, nightEarly: 45 },
  },
  {
    uid: 'demo-casey', displayName: 'Casey', age: 30, gender: 'man', city: 'Seattle, WA', avatar: ['🦈', 'sky'], generatedAvatar: true,
    bio: 'Home cook, mountain-view chaser, and owner of too many houseplants.',
    interests: ['cooking', 'hiking', 'plants', 'movies'],
    prompts: [['A green flag I look for…', 'Kindness to servers and curiosity about the menu.'], ['My perfect Sunday…', 'A trail, a new recipe, and a comfort movie.']],
    axes: { cozyAdventurous: 74, plannerSpontaneous: 46, chattyChill: 42, nightEarly: 62 },
  },
]

export const demoProfiles: Profile[] = seeds.map((seed) => ({
  uid: seed.uid,
  firstName: seed.firstName,
  lastName: seed.lastName,
  birthdate: seed.birthdate,
  gender: seed.gender,
  interestedIn: ['women', 'men', 'nonbinary'],
  city: seed.city,
  bio: seed.bio,
  prompts: seed.prompts.map(([question, answer]) => ({ question, answer })),
  // AI-generated faces (thispersondoesnotexist.com, StyleGAN): no real person is depicted.
  photos: [seed.generatedAvatar ? `avatar:${seed.avatar[0]}:${seed.avatar[1]}` : `/demo-photos/${seed.uid.replace('demo-', '')}.jpg`],
  interests: seed.interests,
  quiz: { personaId: personaFor(seed.axes).id, axes: seed.axes },
  discoverable: true,
  isDemo: true,
  updatedAt: 0,
}))

export const demoLikeRows = [
  { person: 'demo-maya', likes: true },
  { person: 'demo-jules', likes: false },
  { person: 'demo-sam', likes: true },
  { person: 'demo-priya', likes: true },
  { person: 'demo-leo', likes: false },
  { person: 'demo-noor', likes: true },
  { person: 'demo-kai', likes: false },
  { person: 'demo-ivy', likes: true },
  { person: 'demo-theo', likes: true },
  { person: 'demo-river', likes: false },
] as const

export const demoLikesYou = new Set<string>(demoLikeRows.filter((row) => row.likes).map((row) => row.person))

/** Deterministic pseudo-random Would You Rather answers per demo profile. */
export function demoWyrAnswers(uid: string): Record<string, WyrChoice> {
  const answers: Record<string, WyrChoice> = {}
  let hash = 0
  for (const char of uid) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  for (const prompt of wyrPrompts) {
    hash = (hash * 1103515245 + 12345) >>> 0
    answers[prompt.id] = hash % 2 === 0 ? 'a' : 'b'
  }
  return answers
}

export const demoReplies = [
  'Haha I love that 😄',
  'Okay that is a very good point.',
  'Wait, tell me more!',
  'Same energy honestly.',
  "You'd get along with my cat.",
  'Ooh, have you tried the night market downtown?',
  "I'm down! When are you free?",
  'That made me laugh out loud on the bus 😂',
]
