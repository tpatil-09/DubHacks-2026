import type { PastelColor } from '../../lib/colors'
import type { GameAnswers } from '../../types'

// BuzzFeed-style quizzes (one pick per question, you get a result type) and
// "match puzzles" (pick N of many, any combination is valid). Both are only for
// fun: answers are compared with other members to find people on your wavelength.

export interface GameOption {
  id: string
  emoji: string
  label: string
}

export interface BuzzOption extends GameOption {
  /** Points toward result ids. */
  points: Record<string, number>
}

export interface BuzzQuestion {
  id: string
  prompt: string
  options: BuzzOption[]
}

export interface BuzzResult {
  id: string
  emoji: string
  title: string
  blurb: string
}

export interface BuzzQuiz {
  kind: 'quiz'
  id: string
  title: string
  tagline: string
  emoji: string
  color: PastelColor
  questions: BuzzQuestion[]
  results: BuzzResult[]
}

export interface MatchPuzzle {
  kind: 'puzzle'
  id: string
  title: string
  prompt: string
  emoji: string
  color: PastelColor
  pick: number
  options: GameOption[]
}

export type FunGame = BuzzQuiz | MatchPuzzle

/** Answer key used for a puzzle's picks. */
export const PUZZLE_KEY = 'picks'

const o = (id: string, emoji: string, label: string, points: Record<string, number>): BuzzOption => ({ id, emoji, label, points })

export const buzzQuizzes: BuzzQuiz[] = [
  {
    kind: 'quiz',
    id: 'dream-date',
    title: 'Build your dream date and we’ll reveal your love language',
    tagline: '6 questions · 5 love languages',
    emoji: '💌',
    color: 'bubblegum',
    results: [
      { id: 'words', emoji: '💬', title: 'Words of Affirmation', blurb: 'A sweet text can make your whole week. You notice the little compliments and you give the best ones.' },
      { id: 'time', emoji: '⏳', title: 'Quality Time', blurb: 'Phones down, full attention. A long walk where you talk about everything is your idea of romance.' },
      { id: 'gifts', emoji: '🎁', title: 'Thoughtful Gifts', blurb: 'It’s not the price, it’s the “I saw this and thought of you.” You keep every ticket stub.' },
      { id: 'acts', emoji: '🧺', title: 'Acts of Service', blurb: 'Making someone coffee just how they like it? That’s love in your book.' },
      { id: 'touch', emoji: '🫶', title: 'Physical Touch', blurb: 'Hand-holding, hugs, leaning on shoulders at the movies. Closeness says it all.' },
    ],
    questions: [
      {
        id: 'setting',
        prompt: 'Pick the setting',
        options: [
          o('picnic', '🧺', 'Sunny picnic in the park', { acts: 2, time: 1 }),
          o('rooftop', '🌃', 'Rooftop with city lights', { words: 2, touch: 1 }),
          o('market', '🛍️', 'Wandering a weekend market', { gifts: 2, time: 1 }),
          o('couch', '🛋️', 'Cozy couch, blanket, movie', { touch: 2, time: 1 }),
        ],
      },
      {
        id: 'food',
        prompt: 'What are you eating?',
        options: [
          o('homemade', '🍝', 'Pasta I made from scratch', { acts: 2 }),
          o('share', '🥟', 'Dumplings to share', { touch: 1, time: 1 }),
          o('fancy', '🦞', 'Tasting menu, dressed up', { words: 1, gifts: 1 }),
          o('street', '🌮', 'Street tacos while we walk', { time: 2 }),
        ],
      },
      {
        id: 'activity',
        prompt: 'Then you…',
        options: [
          o('pottery', '🏺', 'Make matching pottery mugs', { gifts: 2 }),
          o('walk', '🌙', 'Take a long walk and talk for hours', { time: 2, words: 1 }),
          o('dance', '💃', 'Slow dance in the kitchen', { touch: 2 }),
          o('help', '🔧', 'Build their IKEA shelf together', { acts: 2 }),
        ],
      },
      {
        id: 'song',
        prompt: 'The song playing in the background',
        options: [
          o('ballad', '🎤', 'A big romantic ballad', { words: 2 }),
          o('indie', '🎧', 'An indie song they’ve never heard', { gifts: 1, time: 1 }),
          o('rnb', '🎷', 'Smooth R&B', { touch: 2 }),
          o('lofi', '☕', 'Lo-fi beats, very chill', { acts: 1, time: 1 }),
        ],
      },
      {
        id: 'after',
        prompt: 'The next morning, the best thing would be…',
        options: [
          o('text', '📱', 'A “last night was perfect” text', { words: 2 }),
          o('coffee', '☕', 'They bring you coffee', { acts: 2 }),
          o('photo', '📸', 'A photo from the night, printed', { gifts: 2 }),
          o('plans', '📅', 'Making plans for the next date', { time: 2 }),
        ],
      },
      {
        id: 'emoji',
        prompt: 'Pick an emoji to describe it',
        options: [
          o('heart', '🥰', '', { words: 1, touch: 1 }),
          o('sparkle', '✨', '', { gifts: 1, time: 1 }),
          o('hug', '🤗', '', { touch: 2 }),
          o('chef', '🧑‍🍳', '', { acts: 2 }),
        ],
      },
    ],
  },
  {
    kind: 'quiz',
    id: 'dessert',
    title: 'Plan a perfect year and we’ll tell you which dessert you are',
    tagline: '6 questions · 5 desserts',
    emoji: '🍰',
    color: 'butter',
    results: [
      { id: 'cake', emoji: '🎂', title: 'Birthday Cake', blurb: 'The life of every party. You bring the sprinkles and the people.' },
      { id: 'mochi', emoji: '🍡', title: 'Mochi', blurb: 'Soft, sweet and a little mysterious. People who get you, really get you.' },
      { id: 'churro', emoji: '🥖', title: 'Churro', blurb: 'Warm, spontaneous, always down for a late-night adventure.' },
      { id: 'tiramisu', emoji: '☕', title: 'Tiramisu', blurb: 'Classy, layered and deep. You make the best 2am conversations.' },
      { id: 'sundae', emoji: '🍨', title: 'Ice Cream Sundae', blurb: 'Playful and endlessly customizable. You never order the same thing twice.' },
    ],
    questions: [
      {
        id: 'spring',
        prompt: 'Spring plans?',
        options: [
          o('festival', '🎪', 'Music festival with the whole crew', { cake: 2, churro: 1 }),
          o('garden', '🌸', 'Cherry blossom walk', { mochi: 2 }),
          o('museum', '🖼️', 'New museum exhibit', { tiramisu: 2 }),
          o('random', '🎲', 'Whatever comes up!', { sundae: 2, churro: 1 }),
        ],
      },
      {
        id: 'summer',
        prompt: 'Summer is for…',
        options: [
          o('beach', '🏖️', 'Beach days', { sundae: 2 }),
          o('roadtrip', '🚐', 'A road trip with no plan', { churro: 2 }),
          o('bbq', '🍔', 'Hosting the BBQ', { cake: 2 }),
          o('reading', '📚', 'Reading in a hammock', { mochi: 1, tiramisu: 1 }),
        ],
      },
      {
        id: 'fall',
        prompt: 'Fall vibe',
        options: [
          o('cafe', '🍂', 'Sweater weather café hopping', { tiramisu: 2 }),
          o('haunted', '🎃', 'Haunted house dare', { churro: 2 }),
          o('pumpkin', '🥧', 'Baking pies for friends', { cake: 1, mochi: 1 }),
          o('apple', '🍎', 'Apple picking + photos', { sundae: 2 }),
        ],
      },
      {
        id: 'winter',
        prompt: 'Winter weekend',
        options: [
          o('ski', '⛷️', 'Ski trip', { churro: 1, sundae: 1 }),
          o('cocoa', '🫖', 'Cocoa and a puzzle', { mochi: 2 }),
          o('party', '🎉', 'Throwing a holiday party', { cake: 2 }),
          o('jazz', '🎷', 'Jazz bar downtown', { tiramisu: 2 }),
        ],
      },
      {
        id: 'superpower',
        prompt: 'Pick a tiny superpower',
        options: [
          o('parking', '🅿️', 'Always find parking', { cake: 1, sundae: 1 }),
          o('nap', '😴', 'Perfect 20-minute naps', { mochi: 2 }),
          o('playlist', '🎶', 'Read the room’s playlist', { tiramisu: 1, churro: 1 }),
          o('nevercold', '🧣', 'Never cold, ever', { churro: 2 }),
        ],
      },
      {
        id: 'motto',
        prompt: 'Your motto',
        options: [
          o('more', '🥳', 'The more the merrier', { cake: 2 }),
          o('slow', '🐢', 'Slow and sweet', { mochi: 2 }),
          o('yes', '✅', 'Say yes, figure it out later', { churro: 2 }),
          o('depth', '🌊', 'Go deep or go home', { tiramisu: 2 }),
          o('both', '🤷', 'Why not both?', { sundae: 2 }),
        ],
      },
    ],
  },
  {
    kind: 'quiz',
    id: 'road-trip',
    title: 'Pack road-trip snacks and we’ll guess your green flag',
    tagline: '6 questions · 5 green flags',
    emoji: '🚗',
    color: 'mint',
    results: [
      { id: 'listener', emoji: '👂', title: 'The Great Listener', blurb: 'You remember the name of their childhood dog. People feel heard around you.' },
      { id: 'planner', emoji: '🗺️', title: 'The Thoughtful Planner', blurb: 'Snacks packed, playlist ready, backup route saved. You take care of people.' },
      { id: 'funny', emoji: '😂', title: 'The One Who Makes Everyone Laugh', blurb: 'Any delay becomes a bit. Your road trips are the stories people retell.' },
      { id: 'calm', emoji: '🧘', title: 'The Calm Co-pilot', blurb: 'Flat tire? Wrong exit? You’re unbothered, and it’s contagious.' },
      { id: 'curious', emoji: '🔭', title: 'The Curious Explorer', blurb: 'Every roadside sign is a reason to stop. You make ordinary days feel new.' },
    ],
    questions: [
      {
        id: 'snack',
        prompt: 'First snack in the bag',
        options: [
          o('gummies', '🐻', 'Gummy bears', { funny: 2 }),
          o('trailmix', '🥜', 'Homemade trail mix', { planner: 2 }),
          o('chips', '🥔', 'Whatever chips they like', { listener: 2 }),
          o('local', '🥨', 'Something weird from a gas station', { curious: 2 }),
        ],
      },
      {
        id: 'drink',
        prompt: 'Drink of choice',
        options: [
          o('coffee', '☕', 'Big iced coffee', { planner: 1, funny: 1 }),
          o('tea', '🍵', 'Calming tea', { calm: 2 }),
          o('soda', '🥤', 'Fizzy soda', { funny: 2 }),
          o('kombucha', '🧉', 'A kombucha flavor I’ve never tried', { curious: 2 }),
        ],
      },
      {
        id: 'seat',
        prompt: 'Where do you sit?',
        options: [
          o('driver', '🚘', 'Driver, obviously', { planner: 2 }),
          o('dj', '🎛️', 'Passenger seat DJ', { funny: 1, listener: 1 }),
          o('nap', '💤', 'Back seat nap spot', { calm: 2 }),
          o('nav', '🧭', 'Navigator with the paper map', { curious: 2 }),
        ],
      },
      {
        id: 'detour',
        prompt: 'A sign says “World’s Largest Ball of Yarn, 20 miles.”',
        options: [
          o('go', '🧶', 'We’re going, no question', { curious: 2, funny: 1 }),
          o('vote', '🙋', 'Let’s vote', { listener: 2 }),
          o('schedule', '⏱️', 'Only if we’re ahead of schedule', { planner: 2 }),
          o('whatever', '🤙', 'Whatever everyone wants', { calm: 2 }),
        ],
      },
      {
        id: 'game',
        prompt: 'Car game',
        options: [
          o('20q', '❓', '20 Questions', { listener: 2 }),
          o('karaoke', '🎤', 'Karaoke at full volume', { funny: 2 }),
          o('license', '🚙', 'License plate bingo', { planner: 1, curious: 1 }),
          o('quiet', '🌄', 'Just enjoying the view', { calm: 2 }),
        ],
      },
      {
        id: 'flat',
        prompt: 'Flat tire! You…',
        options: [
          o('fix', '🛞', 'Already have the spare out', { planner: 2 }),
          o('joke', '🤣', 'Make it a photoshoot', { funny: 2 }),
          o('breathe', '😌', '“It’s fine, we’ve got time”', { calm: 2 }),
          o('check', '🫂', 'Check that everyone’s okay first', { listener: 2 }),
        ],
      },
    ],
  },
]

export const matchPuzzles: MatchPuzzle[] = [
  {
    kind: 'puzzle',
    id: 'desert-island',
    title: 'Desert Island Pack',
    prompt: 'You’re stranded for a month. Pack exactly 3 things.',
    emoji: '🏝️',
    color: 'sky',
    pick: 3,
    options: [
      { id: 'guitar', emoji: '🎸', label: 'Guitar' },
      { id: 'books', emoji: '📚', label: 'Stack of books' },
      { id: 'hammock', emoji: '🪢', label: 'Hammock' },
      { id: 'snorkel', emoji: '🤿', label: 'Snorkel gear' },
      { id: 'hotsauce', emoji: '🌶️', label: 'Hot sauce' },
      { id: 'camera', emoji: '📷', label: 'Camera' },
      { id: 'journal', emoji: '📓', label: 'Journal' },
      { id: 'dog', emoji: '🐶', label: 'My dog' },
      { id: 'speaker', emoji: '🔊', label: 'Solar speaker' },
      { id: 'cards', emoji: '🃏', label: 'Deck of cards' },
      { id: 'sunscreen', emoji: '🧴', label: 'Sunscreen' },
      { id: 'kite', emoji: '🪁', label: 'Kite' },
    ],
  },
  {
    kind: 'puzzle',
    id: 'first-date-spots',
    title: 'First-Date Bingo',
    prompt: 'Pick your top 3 first-date spots.',
    emoji: '📍',
    color: 'peach',
    pick: 3,
    options: [
      { id: 'arcade', emoji: '🕹️', label: 'Arcade' },
      { id: 'bookstore', emoji: '📖', label: 'Bookstore' },
      { id: 'hike', emoji: '🥾', label: 'Short hike' },
      { id: 'karaoke', emoji: '🎤', label: 'Karaoke' },
      { id: 'cafe', emoji: '☕', label: 'Coffee shop' },
      { id: 'museum', emoji: '🏛️', label: 'Museum' },
      { id: 'minigolf', emoji: '⛳', label: 'Mini golf' },
      { id: 'market', emoji: '🧺', label: 'Farmers market' },
      { id: 'comedy', emoji: '🎭', label: 'Comedy show' },
      { id: 'aquarium', emoji: '🐠', label: 'Aquarium' },
      { id: 'cooking', emoji: '🍳', label: 'Cooking class' },
    ],
  },
  {
    kind: 'puzzle',
    id: 'dream-pizza',
    title: 'Dream Pizza',
    prompt: 'Build a pizza with exactly 4 toppings.',
    emoji: '🍕',
    color: 'butter',
    pick: 4,
    options: [
      { id: 'pepperoni', emoji: '🍕', label: 'Pepperoni' },
      { id: 'mushroom', emoji: '🍄', label: 'Mushrooms' },
      { id: 'pineapple', emoji: '🍍', label: 'Pineapple' },
      { id: 'olive', emoji: '🫒', label: 'Olives' },
      { id: 'basil', emoji: '🌿', label: 'Fresh basil' },
      { id: 'jalapeno', emoji: '🌶️', label: 'Jalapeños' },
      { id: 'onion', emoji: '🧅', label: 'Onions' },
      { id: 'corn', emoji: '🌽', label: 'Corn' },
      { id: 'bacon', emoji: '🥓', label: 'Bacon' },
      { id: 'pepper', emoji: '🫑', label: 'Bell peppers' },
      { id: 'garlic', emoji: '🧄', label: 'Roasted garlic' },
      { id: 'honey', emoji: '🍯', label: 'Hot honey' },
    ],
  },
  {
    kind: 'puzzle',
    id: 'road-trip-playlist',
    title: 'Road-Trip Playlist',
    prompt: 'Pick 3 genres for the aux.',
    emoji: '🎶',
    color: 'lilac',
    pick: 3,
    options: [
      { id: 'pop', emoji: '🪩', label: 'Pop' },
      { id: 'hiphop', emoji: '🎤', label: 'Hip-hop' },
      { id: 'indie', emoji: '🎸', label: 'Indie rock' },
      { id: 'country', emoji: '🤠', label: 'Country' },
      { id: 'kpop', emoji: '💜', label: 'K-pop' },
      { id: 'rnb', emoji: '🎷', label: 'R&B' },
      { id: 'edm', emoji: '🎛️', label: 'EDM' },
      { id: 'musicals', emoji: '🎭', label: 'Musicals' },
      { id: 'latin', emoji: '💃', label: 'Latin' },
      { id: 'classical', emoji: '🎻', label: 'Classical' },
      { id: 'throwbacks', emoji: '📼', label: '2000s throwbacks' },
    ],
  },
]

export const funGames: FunGame[] = [...buzzQuizzes, ...matchPuzzles]

export function gameById(id: string | undefined): FunGame | undefined {
  return funGames.find((game) => game.id === id)
}

/** Highest-scoring result; ties go to the result listed first. */
export function scoreBuzzQuiz(quiz: BuzzQuiz, answers: GameAnswers): BuzzResult {
  const totals = new Map(quiz.results.map((result) => [result.id, 0]))
  for (const question of quiz.questions) {
    const option = question.options.find((candidate) => candidate.id === answers[question.id]?.[0])
    for (const [id, value] of Object.entries(option?.points ?? {})) totals.set(id, (totals.get(id) ?? 0) + value)
  }
  return quiz.results.reduce((best, result) => ((totals.get(result.id) ?? 0) > (totals.get(best.id) ?? 0) ? result : best))
}

export function isComplete(game: FunGame, answers: GameAnswers | undefined): boolean {
  if (!answers) return false
  if (game.kind === 'puzzle') return new Set(answers[PUZZLE_KEY] ?? []).size === game.pick
  return game.questions.every((question) => answers[question.id]?.length === 1)
}

/** 0–100: average overlap (Jaccard) across the questions both people answered. */
export function answerSimilarity(a: GameAnswers, b: GameAnswers): number {
  const keys = Object.keys(a).filter((key) => a[key]?.length && b[key]?.length)
  if (keys.length === 0) return 0
  const total = keys.reduce((sum, key) => {
    const left = new Set(a[key])
    const right = new Set(b[key])
    const shared = [...left].filter((id) => right.has(id)).length
    return sum + shared / new Set([...left, ...right]).size
  }, 0)
  return Math.round((100 * total) / keys.length)
}

/** Shared picks, for showing what you have in common. */
export function sharedPicks(a: GameAnswers, b: GameAnswers): string[] {
  return Object.keys(a).flatMap((key) => (a[key] ?? []).filter((id) => b[key]?.includes(id)))
}

export interface Twin {
  uid: string
  percent: number
}

/** People whose answers are at least `minPercent` similar, most similar first. */
export function rankTwins(mine: GameAnswers, others: Record<string, GameAnswers>, minPercent = 1): Twin[] {
  return Object.entries(others)
    .map(([uid, answers]) => ({ uid, percent: answerSimilarity(mine, answers) }))
    .filter((twin) => twin.percent >= minPercent)
    .sort((x, y) => y.percent - x.percent || x.uid.localeCompare(y.uid))
}

/** Deterministic pseudo-random answers so demo members always have something to compare against. */
export function seededAnswers(seed: string, game: FunGame): GameAnswers {
  let hash = 0
  for (const char of `${seed}:${game.id}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const next = (n: number) => {
    hash = (hash * 1103515245 + 12345) >>> 0
    return (hash >>> 8) % n
  }
  if (game.kind === 'quiz') {
    return Object.fromEntries(game.questions.map((question) => [question.id, [question.options[next(question.options.length)].id]]))
  }
  const pool = game.options.map((option) => option.id)
  const picks: string[] = []
  while (picks.length < game.pick) picks.push(pool.splice(next(pool.length), 1)[0])
  return { [PUZZLE_KEY]: picks }
}
