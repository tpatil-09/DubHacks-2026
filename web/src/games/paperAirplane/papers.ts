import type { CSSProperties } from 'react'
import type { PaperDesign, PaperPattern } from '../../types'

export const PAPER_NOTE_MAX = 180

export const paperPatterns: PaperPattern[] = ['solid', 'dots', 'stripes', 'grid', 'stars', 'waves', 'plaid', 'confetti']

const palette: Array<Pick<PaperDesign, 'color' | 'ink' | 'accent'>> = [
  { color: '#fff4c8', ink: '#3a2a14', accent: '#e07a3d' },
  { color: '#fde4e2', ink: '#4a2030', accent: '#e5484d' },
  { color: '#d8f3ee', ink: '#143832', accent: '#1f8c7f' },
  { color: '#efe8ff', ink: '#2c2450', accent: '#7c6bb8' },
  { color: '#e5f3fc', ink: '#163044', accent: '#3d88c2' },
  { color: '#ffe3f1', ink: '#4a1840', accent: '#d63d88' },
  { color: '#e7f6d4', ink: '#243816', accent: '#5a8f2e' },
  { color: '#fff1e4', ink: '#3d2918', accent: '#d9805f' },
]

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.min(index, Math.floor(random() * (index + 1)))
    const current = copy[index]
    copy[index] = copy[swap]
    copy[swap] = current
  }
  return copy
}

/** Three sheets with different colors and patterns. */
export function rollPapers(count = 3, random: () => number = Math.random): PaperDesign[] {
  const colors = shuffle(palette, random).slice(0, count)
  const patterns = shuffle(paperPatterns, random)
  return colors.map((swatch, index) => ({ ...swatch, pattern: patterns[index % patterns.length] }))
}

export function cleanNote(text: string): string {
  const note = text.trim()
  if (note.length < 1 || note.length > PAPER_NOTE_MAX) {
    throw new Error(`Write a note between 1 and ${PAPER_NOTE_MAX} characters.`)
  }
  return note
}

export function assertDesign(design: PaperDesign): void {
  const hex = /^#[0-9a-fA-F]{6}$/
  if (!paperPatterns.includes(design.pattern) || !hex.test(design.color) || !hex.test(design.ink) || !hex.test(design.accent)) {
    throw new Error('Pick one of the paper sheets.')
  }
}

function svg(body: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(body)}")`
}

/** Repeating pattern painted over the sheet color. */
export function paperBackground(design: PaperDesign): CSSProperties {
  const accent = design.accent
  switch (design.pattern) {
    case 'solid':
      return {}
    case 'dots':
      return { backgroundImage: `radial-gradient(${accent} 1.4px, transparent 1.5px)`, backgroundSize: '16px 16px' }
    case 'stripes':
      return { backgroundImage: `repeating-linear-gradient(-32deg, transparent 0 10px, ${accent}33 10px 15px)` }
    case 'grid':
      return {
        backgroundImage: `linear-gradient(${accent}33 1px, transparent 1px), linear-gradient(90deg, ${accent}33 1px, transparent 1px)`,
        backgroundSize: '18px 18px',
      }
    case 'plaid':
      return {
        backgroundImage: `repeating-linear-gradient(${accent}22 0 10px, transparent 10px 22px), repeating-linear-gradient(90deg, ${accent}22 0 10px, transparent 10px 22px)`,
      }
    case 'waves':
      return {
        backgroundImage: svg(`<svg xmlns="http://www.w3.org/2000/svg" width="88" height="22" fill="none"><path d="M0 12 Q11 2 22 12 T44 12 T66 12 T88 12" stroke="${accent}" stroke-width="2"/></svg>`),
        backgroundSize: '88px 22px',
      }
    case 'stars':
      return {
        backgroundImage: svg(`<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52"><path fill="${accent}" d="M26 8l2.2 6.6H35l-5.4 4 2 6.4L26 21.2 20.4 25l2-6.4-5.4-4h6.8z"/></svg>`),
        backgroundSize: '52px 52px',
      }
    case 'confetti':
      return {
        backgroundImage: svg(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="${accent}"><circle cx="8" cy="14" r="3"/><rect x="40" y="8" width="6" height="6" rx="1" transform="rotate(18 43 11)"/><circle cx="50" cy="40" r="2.5"/><rect x="14" y="42" width="5" height="5" transform="rotate(30 16 44)"/></svg>`),
        backgroundSize: '64px 64px',
      }
  }
}
