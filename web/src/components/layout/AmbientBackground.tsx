import type { CSSProperties } from 'react'
import { Capsule } from '../ui/Capsule'
import type { PastelColor } from '../../lib/colors'

// Drifting gachapon capsules are the brand's background motif.
const capsules: { color: PastelColor; top: string; left: string; size: number; dur: number; delay: number }[] = [
  { color: 'bubblegum', top: '14%', left: '93%', size: 40, dur: 28, delay: 0 },
  { color: 'butter', top: '6%', left: '62%', size: 30, dur: 24, delay: -6 },
  { color: 'mint', top: '95%', left: '42%', size: 36, dur: 34, delay: -12 },
  { color: 'lilac', top: '64%', left: '94%', size: 34, dur: 26, delay: -3 },
  { color: 'sky', top: '90%', left: '70%', size: 28, dur: 32, delay: -9 },
  { color: 'peach', top: '40%', left: '86%', size: 26, dur: 30, delay: -15 },
]

const blobs = [
  { color: '#ffd2e3', top: '-12%', left: '-12%', size: 460 },
  { color: '#e3fbf1', top: '60%', left: '72%', size: 400 },
  { color: '#fff3d1', top: '-14%', left: '62%', size: 320 },
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
            opacity: calm ? 0.35 : 0.6,
            '--dur': `${40 + index * 6}s`,
          } as CSSProperties}
        />
      ))}
      {!calm &&
        capsules.map((capsule, index) => (
          <span
            key={index}
            className="ambient-shape absolute opacity-90 drop-shadow-[0_6px_10px_rgba(59,47,74,0.10)]"
            style={{ top: capsule.top, left: capsule.left, '--dur': `${capsule.dur}s`, '--delay': `${capsule.delay}s` } as CSSProperties}
          >
            <Capsule color={capsule.color} size={capsule.size} />
          </span>
        ))}
    </div>
  )
}
