import type { CSSProperties } from 'react'

const shapes = [
  { emoji: '💗', top: '8%', left: '6%', size: 34, dur: 28, delay: 0 },
  { emoji: '⭐', top: '18%', left: '88%', size: 30, dur: 24, delay: -6 },
  { emoji: '☁️', top: '42%', left: '3%', size: 44, dur: 34, delay: -12 },
  { emoji: '🪙', top: '64%', left: '92%', size: 28, dur: 26, delay: -3 },
  { emoji: '✨', top: '82%', left: '10%', size: 26, dur: 22, delay: -9 },
  { emoji: '💜', top: '30%', left: '70%', size: 22, dur: 30, delay: -15 },
  { emoji: '☁️', top: '88%', left: '74%', size: 40, dur: 36, delay: -20 },
  { emoji: '🍬', top: '94%', left: '42%', size: 22, dur: 32, delay: -5 },
]

const blobs = [
  { color: '#ffd2e3', top: '-8%', left: '-10%', size: 420 },
  { color: '#e3fbf1', top: '55%', left: '70%', size: 380 },
  { color: '#f0ecff', top: '35%', left: '-15%', size: 340 },
  { color: '#fff8dc', top: '-10%', left: '65%', size: 300 },
]

export function AmbientBackground({ calm = false }: { calm?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {blobs.map((blob, index) => (
        <div
          key={index}
          className="ambient-shape absolute rounded-full blur-3xl"
          style={{
            background: blob.color,
            top: blob.top,
            left: blob.left,
            width: blob.size,
            height: blob.size,
            opacity: calm ? 0.5 : 0.85,
            '--dur': `${40 + index * 6}s`,
          } as CSSProperties}
        />
      ))}
      {!calm &&
        shapes.map((shape, index) => (
          <span
            key={index}
            className="ambient-shape absolute select-none opacity-60"
            style={{
              top: shape.top,
              left: shape.left,
              fontSize: shape.size,
              '--dur': `${shape.dur}s`,
              '--delay': `${shape.delay}s`,
            } as CSSProperties}
          >
            {shape.emoji}
          </span>
        ))}
    </div>
  )
}
