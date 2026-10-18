import type { QuizAxes } from '../../types'

export interface Persona {
  id: string
  name: string
  emoji: string
  tagline: string
  color: 'bubblegum' | 'peach' | 'mint' | 'lilac' | 'butter' | 'sky'
}

// Indexed by [adventurous][spontaneous][earlyBird] (each 0 or 1).
export const personas: Persona[] = [
  { id: 'midnight-puzzle-master', name: 'Midnight Puzzle Master', emoji: '🧩', tagline: 'Cozy plans, late nights, and a 1000-piece puzzle.', color: 'lilac' },
  { id: 'cozy-cafe-strategist', name: 'Cozy Café Strategist', emoji: '☕', tagline: 'Has a favorite table and a backup café.', color: 'peach' },
  { id: 'midnight-arcade-gremlin', name: 'Midnight Arcade Gremlin', emoji: '👾', tagline: 'One more round? Always one more round.', color: 'lilac' },
  { id: 'sunrise-doodler', name: 'Sunrise Doodler', emoji: '🌅', tagline: 'Sketchbook, sunrise, no agenda.', color: 'butter' },
  { id: 'night-market-navigator', name: 'Night Market Navigator', emoji: '🏮', tagline: 'Knows the best stall and the fastest route.', color: 'bubblegum' },
  { id: 'trailhead-captain', name: 'Trailhead Captain', emoji: '🧭', tagline: 'Packed snacks, printed map, 6am start.', color: 'mint' },
  { id: 'neon-side-quest-hero', name: 'Neon Side-Quest Hero', emoji: '🌃', tagline: 'Main quest? Never heard of it.', color: 'sky' },
  { id: 'golden-retriever-adventurer', name: 'Golden Retriever Adventurer', emoji: '🐕', tagline: "Yes to everything. Let's go!", color: 'butter' },
]

export function personaFor(axes: QuizAxes): Persona {
  const adventurous = axes.cozyAdventurous >= 50 ? 1 : 0
  const spontaneous = axes.plannerSpontaneous >= 50 ? 1 : 0
  const early = axes.nightEarly >= 50 ? 1 : 0
  return personas[adventurous * 4 + spontaneous * 2 + early]
}

export function personaById(id: string | undefined): Persona | undefined {
  return personas.find((persona) => persona.id === id)
}
