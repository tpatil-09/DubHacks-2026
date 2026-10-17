import { motion, useReducedMotion } from 'motion/react'

export type MascotMood = 'happy' | 'sleepy' | 'excited' | 'thinking' | 'calm'

interface MascotProps {
  mood?: MascotMood
  size?: number
  className?: string
}

/** "Bubbi", a glossy capsule-heart buddy. Pure SVG so it loads instantly. */
export function Mascot({ mood = 'happy', size = 120, className = '' }: MascotProps) {
  const reduceMotion = useReducedMotion()
  const bounce = mood === 'excited' ? [0, -16, 0] : [0, -6, 0]
  return (
    <motion.div
      aria-hidden
      className={className}
      style={{ width: size, height: size }}
      animate={reduceMotion ? undefined : { y: bounce, rotate: mood === 'excited' ? [0, -4, 4, 0] : 0 }}
      transition={{ duration: mood === 'excited' ? 0.8 : 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <defs>
          <radialGradient id="mascot-body" cx="40%" cy="30%" r="75%">
            <stop offset="0" stopColor="#ffd2e3" />
            <stop offset=".55" stopColor="#ff9cc6" />
            <stop offset="1" stopColor="#f07aae" />
          </radialGradient>
        </defs>
        <ellipse cx="60" cy="112" rx="30" ry="5" fill="#3b2f4a" opacity=".1" />
        <path
          d="M60 104C28 82 12 66 12 44a24 24 0 0 1 48-8 24 24 0 0 1 48 8c0 22-16 38-48 60z"
          fill="url(#mascot-body)"
          stroke="#fff"
          strokeWidth="4"
        />
        <ellipse cx="36" cy="32" rx="12" ry="7" fill="#fff" opacity=".75" transform="rotate(-25 36 32)" />
        <circle cx="30" cy="62" r="7" fill="#ff6fa8" opacity=".35" />
        <circle cx="90" cy="62" r="7" fill="#ff6fa8" opacity=".35" />
        {mood === 'sleepy' ? (
          <g stroke="#3b2f4a" strokeWidth="3.5" strokeLinecap="round" fill="none">
            <path d="M38 54q6 5 12 0" />
            <path d="M70 54q6 5 12 0" />
          </g>
        ) : (
          <g className={reduceMotion ? undefined : 'animate-blink'} style={{ transformBox: 'fill-box' }}>
            <ellipse cx="44" cy="52" rx="6" ry={mood === 'excited' ? 8 : 7} fill="#3b2f4a" />
            <ellipse cx="76" cy="52" rx="6" ry={mood === 'excited' ? 8 : 7} fill="#3b2f4a" />
            <circle cx="46" cy="49" r="2.2" fill="#fff" />
            <circle cx="78" cy="49" r="2.2" fill="#fff" />
          </g>
        )}
        {mood === 'thinking' ? (
          <path d="M52 70h16" stroke="#3b2f4a" strokeWidth="3.5" strokeLinecap="round" />
        ) : mood === 'calm' ? (
          <path d="M52 68q8 5 16 0" stroke="#3b2f4a" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M50 66q10 12 20 0z" fill="#3b2f4a" stroke="#3b2f4a" strokeWidth="2" strokeLinejoin="round" />
        )}
        {mood === 'sleepy' && (
          <text x="92" y="24" fontFamily="Fredoka, sans-serif" fontSize="16" fontWeight="700" fill="#9d8cf0">z z</text>
        )}
        {mood === 'thinking' && (
          <g fill="#c4b5fd">
            <circle cx="100" cy="28" r="4" />
            <circle cx="108" cy="16" r="6" />
          </g>
        )}
      </svg>
    </motion.div>
  )
}
