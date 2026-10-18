import type { QuizAxes } from '../../types'

// Axis convention: negative = left pole, positive = right pole.
//   cozyAdventurous:    cozy (-)        ↔ adventurous (+)
//   plannerSpontaneous: planner (-)     ↔ spontaneous (+)
//   chattyChill:        chatty (-)      ↔ chill (+)
//   nightEarly:         night owl (-)   ↔ early bird (+)

export interface QuizOption {
  id: string
  emoji: string
  label: string
  scores: Partial<QuizAxes>
}

export interface QuizQuestion {
  id: string
  prompt: string
  options: QuizOption[]
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'friday',
    prompt: "It's Friday night. You're most likely…",
    options: [
      { id: 'fort', emoji: '🛋️', label: 'In a blanket fort with snacks and a movie', scores: { cozyAdventurous: -2, nightEarly: -1 } },
      { id: 'roadtrip', emoji: '🚗', label: 'On a surprise road trip', scores: { cozyAdventurous: 2, plannerSpontaneous: 2 } },
      { id: 'reservation', emoji: '🍝', label: 'At the dinner spot I booked last week', scores: { plannerSpontaneous: -2, chattyChill: -1 } },
      { id: 'sleep', emoji: '😴', label: 'Asleep by 10 so I can catch the sunrise', scores: { nightEarly: 2, cozyAdventurous: -1 } },
    ],
  },
  {
    id: 'firstdate',
    prompt: 'Pick a first date:',
    options: [
      { id: 'arcade', emoji: '🕹️', label: 'Retro arcade and a slushie', scores: { cozyAdventurous: 1, nightEarly: -1 } },
      { id: 'hike', emoji: '🥾', label: 'Sunrise hike with a view', scores: { cozyAdventurous: 2, nightEarly: 2 } },
      { id: 'cafe', emoji: '☕', label: 'Cozy café and a long chat', scores: { cozyAdventurous: -2, chattyChill: -2 } },
      { id: 'museum', emoji: '🖼️', label: 'Museum with a planned route', scores: { plannerSpontaneous: -2, chattyChill: 1 } },
    ],
  },
  {
    id: 'vacation',
    prompt: 'Vacation planning looks like…',
    options: [
      { id: 'spreadsheet', emoji: '📊', label: 'A color-coded spreadsheet', scores: { plannerSpontaneous: -2 } },
      { id: 'vibes', emoji: '🎲', label: 'Book a flight, figure out the rest there', scores: { plannerSpontaneous: 2, cozyAdventurous: 1 } },
      { id: 'cabin', emoji: '🏡', label: 'Same cozy cabin every year', scores: { cozyAdventurous: -2, plannerSpontaneous: -1 } },
    ],
  },
  {
    id: 'party',
    prompt: "At a party, you're…",
    options: [
      { id: 'host', emoji: '🎤', label: 'Starting the karaoke', scores: { chattyChill: -2, cozyAdventurous: 1 } },
      { id: 'dog', emoji: '🐶', label: "Hanging out with the host's dog", scores: { chattyChill: 2, cozyAdventurous: -1 } },
      { id: 'deep', emoji: '🌙', label: 'In one deep 2am conversation', scores: { chattyChill: -1, nightEarly: -2 } },
      { id: 'early', emoji: '👋', label: 'Leaving early, happily', scores: { nightEarly: 2, chattyChill: 1 } },
    ],
  },
  {
    id: 'snack',
    prompt: 'Midnight snack of choice:',
    options: [
      { id: 'ramen', emoji: '🍜', label: 'Instant ramen, obviously', scores: { nightEarly: -2 } },
      { id: 'tea', emoji: '🍵', label: "Tea — I'm asleep at midnight", scores: { nightEarly: 2, cozyAdventurous: -1 } },
      { id: 'taco', emoji: '🌮', label: 'Late-night taco truck run', scores: { nightEarly: -2, cozyAdventurous: 2 } },
    ],
  },
  {
    id: 'conflict',
    prompt: 'When something bugs you, you…',
    options: [
      { id: 'talk', emoji: '💬', label: 'Talk it out right away', scores: { chattyChill: -2 } },
      { id: 'walk', emoji: '🚶', label: 'Take a walk, then talk', scores: { chattyChill: 1, cozyAdventurous: 1 } },
      { id: 'letter', emoji: '✉️', label: 'Write down my thoughts first', scores: { plannerSpontaneous: -1, chattyChill: 1 } },
    ],
  },
  {
    id: 'superpower',
    prompt: 'Pick a tiny superpower:',
    options: [
      { id: 'teleport', emoji: '✨', label: 'Teleport anywhere for 5 minutes', scores: { cozyAdventurous: 2, plannerSpontaneous: 1 } },
      { id: 'perfectnap', emoji: '💤', label: 'Perfect 20-minute naps', scores: { cozyAdventurous: -2, nightEarly: -1 } },
      { id: 'languages', emoji: '🗣️', label: 'Speak every language', scores: { chattyChill: -2 } },
      { id: 'schedule', emoji: '📅', label: 'Always know the best plan', scores: { plannerSpontaneous: -2, nightEarly: 1 } },
    ],
  },
  {
    id: 'ducks',
    prompt: 'What would you do with an army of 100 ducks?',
    options: [
      { id: 'snuggle', emoji: '🤗', label: 'Snuggle them', scores: { cozyAdventurous: -2, chattyChill: 1 } },
      { id: 'driveway', emoji: '😈', label: "Inconvenience my enemies by blocking their driveway", scores: { cozyAdventurous: 2, plannerSpontaneous: 1 } },
      { id: 'trenchcoat', emoji: '🥸', label: 'Buy a trench coat and sneak them into the movies', scores: { plannerSpontaneous: 2, cozyAdventurous: 1 } },
    ],
  },
]
