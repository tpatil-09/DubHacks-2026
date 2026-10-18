import type { CSSProperties } from 'react'

export type PastelColor = 'bubblegum' | 'peach' | 'mint' | 'lilac' | 'butter' | 'sky' | 'blush' | 'white'

/** Brand palette: coral accent, sunny yellow, teal, and soft supporting tints. `text` is the readable text color on `bg`. */
export const pastel: Record<PastelColor, { bg: string; deep: string; soft: string; text: string }> = {
  bubblegum: { bg: '#e5484d', deep: '#c9363b', soft: '#fde4e2', text: '#ffffff' },
  peach: { bg: '#f6b9a3', deep: '#d9805f', soft: '#fdede6', text: '#231a1b' },
  mint: { bg: '#5cc4b6', deep: '#1f8c7f', soft: '#e3f5f2', text: '#ffffff' },
  lilac: { bg: '#d9cff5', deep: '#8f7fd6', soft: '#f3f0fc', text: '#231a1b' },
  butter: { bg: '#fbe27a', deep: '#e6c548', soft: '#fef6d3', text: '#231a1b' },
  sky: { bg: '#c7e3f6', deep: '#5e9dcb', soft: '#eef6fc', text: '#231a1b' },
  blush: { bg: '#fde4e2', deep: '#f3b9b4', soft: '#fef2f1', text: '#231a1b' },
  white: { bg: '#ffffff', deep: '#eadfdd', soft: '#ffffff', text: '#231a1b' },
}

export function isPastel(value: string): value is PastelColor {
  return value in pastel
}

/** Style for elements (like links) that use the `.btn-arcade` class directly. */
export function arcadeVars(color: PastelColor): CSSProperties {
  return { '--btn-bg': pastel[color].bg, '--btn-lip': pastel[color].deep, '--btn-text': pastel[color].text } as CSSProperties
}
