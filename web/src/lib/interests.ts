export interface Interest {
  id: string
  emoji: string
  label: string
  color: 'blush' | 'peach' | 'mint' | 'lilac' | 'butter' | 'sky'
}

export const interests: Interest[] = [
  { id: 'ramen', emoji: '🍜', label: 'Late-night ramen', color: 'peach' },
  { id: 'mariokart', emoji: '🏎️', label: 'Mario Kart', color: 'sky' },
  { id: 'ceramics', emoji: '🏺', label: 'Ceramics', color: 'peach' },
  { id: 'hiking', emoji: '🥾', label: 'Hiking', color: 'mint' },
  { id: 'boba', emoji: '🧋', label: 'Boba runs', color: 'butter' },
  { id: 'cats', emoji: '🐈', label: 'Cats', color: 'lilac' },
  { id: 'dogs', emoji: '🐕', label: 'Dogs', color: 'butter' },
  { id: 'baking', emoji: '🧁', label: 'Baking', color: 'blush' },
  { id: 'anime', emoji: '🌸', label: 'Anime', color: 'blush' },
  { id: 'boardgames', emoji: '🎲', label: 'Board games', color: 'lilac' },
  { id: 'indiegames', emoji: '🕹️', label: 'Indie games', color: 'sky' },
  { id: 'climbing', emoji: '🧗', label: 'Climbing', color: 'mint' },
  { id: 'thrifting', emoji: '🧥', label: 'Thrifting', color: 'peach' },
  { id: 'plants', emoji: '🪴', label: 'Plant parent', color: 'mint' },
  { id: 'karaoke', emoji: '🎤', label: 'Karaoke', color: 'blush' },
  { id: 'reading', emoji: '📚', label: 'Reading', color: 'lilac' },
  { id: 'coffee', emoji: '☕', label: 'Coffee snob', color: 'peach' },
  { id: 'running', emoji: '🏃', label: 'Running', color: 'sky' },
  { id: 'photography', emoji: '📷', label: 'Photography', color: 'sky' },
  { id: 'cooking', emoji: '🍳', label: 'Cooking', color: 'butter' },
  { id: 'concerts', emoji: '🎸', label: 'Live music', color: 'lilac' },
  { id: 'travel', emoji: '✈️', label: 'Travel', color: 'sky' },
  { id: 'yoga', emoji: '🧘', label: 'Yoga', color: 'mint' },
  { id: 'art', emoji: '🎨', label: 'Art', color: 'blush' },
  { id: 'movies', emoji: '🍿', label: 'Movie nights', color: 'butter' },
  { id: 'cycling', emoji: '🚲', label: 'Cycling', color: 'mint' },
  { id: 'astronomy', emoji: '🔭', label: 'Stargazing', color: 'lilac' },
  { id: 'dancing', emoji: '💃', label: 'Dancing', color: 'blush' },
  { id: 'gardening', emoji: '🌻', label: 'Gardening', color: 'butter' },
  { id: 'puzzles', emoji: '🧩', label: 'Puzzles', color: 'lilac' },
]

export function interestById(id: string): Interest | undefined {
  return interests.find((interest) => interest.id === id)
}

export const promptQuestions = [
  'My perfect Sunday…',
  "I'll beat you at…",
  'A green flag I look for…',
  'My go-to karaoke song…',
  'The way to my heart is…',
  "I'm weirdly good at…",
]
