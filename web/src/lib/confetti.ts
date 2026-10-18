import confetti from 'canvas-confetti'

const colors = ['#ff7eb6', '#ffb39b', '#8ef0c7', '#cfc3ff', '#fde68a', '#b5dfff']

export function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const shared = { colors, disableForReducedMotion: true, scalar: 1.1, ticks: 220 }
  confetti({ ...shared, particleCount: 90, spread: 80, origin: { y: 0.6 } })
  setTimeout(() => confetti({ ...shared, particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } }), 150)
  setTimeout(() => confetti({ ...shared, particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } }), 300)
}
