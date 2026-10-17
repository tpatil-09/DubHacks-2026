import type { CSSProperties } from 'react'

export type PastelColor = 'bubblegum' | 'peach' | 'mint' | 'lilac' | 'butter' | 'sky' | 'blush' | 'white'

export const pastel: Record<PastelColor, { bg: string; deep: string; soft: string }> = {
  bubblegum: { bg: '#ff7eb6', deep: '#e05a97', soft: '#ffe4ee' },
  peach: { bg: '#ffb39b', deep: '#e47c5a', soft: '#ffece4' },
  mint: { bg: '#8ef0c7', deep: '#3fbf8f', soft: '#e3fbf1' },
  lilac: { bg: '#cfc3ff', deep: '#9d8cf0', soft: '#f0ecff' },
  butter: { bg: '#fde68a', deep: '#e8c34a', soft: '#fff8dc' },
  sky: { bg: '#b5dfff', deep: '#74b4e8', soft: '#e8f5ff' },
  blush: { bg: '#ffd2e3', deep: '#f0a3c2', soft: '#fff1f6' },
  white: { bg: '#ffffff', deep: '#ead7e1', soft: '#ffffff' },
}

export function isPastel(value: string): value is PastelColor {
  return value in pastel
}

/** Style for elements (like links) that use the `.btn-arcade` class directly. */
export function arcadeVars(color: PastelColor): CSSProperties {
  return { '--btn-bg': pastel[color].bg, '--btn-lip': pastel[color].deep } as CSSProperties
}
