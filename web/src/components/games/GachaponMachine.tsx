import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Capsule } from '../ui/Capsule'
import type { PastelColor } from '../../lib/colors'

const domeCapsules: { color: PastelColor; x: number; y: number; r: number }[] = [
  { color: 'bubblegum', x: 18, y: 58, r: -20 },
  { color: 'mint', x: 46, y: 64, r: 15 },
  { color: 'butter', x: 72, y: 56, r: 40 },
  { color: 'lilac', x: 30, y: 34, r: 10 },
  { color: 'sky', x: 60, y: 30, r: -30 },
  { color: 'peach', x: 44, y: 12, r: 25 },
]

interface GachaponMachineProps {
  onDispense: () => void
  disabled?: boolean
}

/** A pastel capsule machine. Turning the crank drops a capsule, then calls onDispense. */
export function GachaponMachine({ onDispense, disabled }: GachaponMachineProps) {
  const reduceMotion = useReducedMotion()
  const [turns, setTurns] = useState(0)
  const [dropping, setDropping] = useState<PastelColor | null>(null)

  function crank() {
    if (dropping || disabled) return
    const color = domeCapsules[Math.floor(Math.random() * domeCapsules.length)].color
    setTurns((value) => value + 1)
    setDropping(color)
    setTimeout(() => {
      setDropping(null)
      onDispense()
    }, reduceMotion ? 50 : 1100)
  }

  return (
    <div className="relative mx-auto w-64 select-none" aria-label="Capsule machine">
      {/* Dome */}
      <div className="relative mx-auto h-48 w-56 overflow-hidden rounded-t-full border-[6px] border-white bg-gradient-to-b from-white/80 to-sky/30 shadow-[inset_0_8px_20px_rgba(255,255,255,.9),0_10px_30px_rgba(116,180,232,.25)]">
        <motion.div
          className="absolute inset-0"
          animate={turns && !reduceMotion ? { rotate: [0, -6, 6, -3, 0] } : undefined}
          key={turns}
          transition={{ duration: 0.6 }}
        >
          {domeCapsules.map((capsule, index) => (
            <Capsule
              key={index}
              color={capsule.color}
              size={52}
              className="absolute"
              style={{ left: `${capsule.x}%`, top: `${capsule.y}%`, transform: `translate(-50%, 0) rotate(${capsule.r}deg)` }}
            />
          ))}
        </motion.div>
        <span className="absolute left-8 top-6 h-16 w-6 rotate-[25deg] rounded-full bg-white/70" aria-hidden />
      </div>

      {/* Body */}
      <div className="relative -mt-2 rounded-[32px] border-[6px] border-white bg-gradient-to-b from-bubblegum to-bubblegum-deep px-5 pb-6 pt-5 shadow-[inset_0_6px_10px_rgba(255,255,255,.45),0_8px_0_#a92a2f,0_20px_30px_rgba(229,72,77,.28)]">
        <div className="flex items-center justify-between">
          <motion.button
            type="button"
            onClick={crank}
            disabled={disabled || !!dropping}
            aria-label="Turn the crank"
            className="relative grid size-20 place-items-center rounded-full border-[5px] border-white bg-butter shadow-[inset_0_4px_6px_rgba(255,255,255,.8),0_5px_0_#e6c548] disabled:opacity-80"
            animate={{ rotate: turns * 360 }}
            transition={{ type: 'spring', stiffness: 80, damping: 12 }}
            whileTap={{ scale: 0.92 }}
          >
            <span className="absolute h-3 w-14 rounded-full bg-white/90 shadow-inner" />
            <span className="absolute size-4 rounded-full bg-bubblegum-deep" />
          </motion.button>
          <div className="relative h-20 w-24 overflow-hidden rounded-2xl border-[4px] border-white/80 bg-ink/15 shadow-inner">
            <AnimatePresence>
              {dropping && (
                <motion.div
                  key="drop"
                  className="absolute left-1/2 -translate-x-1/2"
                  initial={{ top: -60, rotate: 0 }}
                  animate={{ top: 12, rotate: 200 }}
                  exit={{ scale: 1.4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                >
                  <Capsule color={dropping} size={48} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <p className="mt-4 text-center font-display text-lg font-bold text-white drop-shadow">
          {disabled ? 'Pick an answer first!' : dropping ? 'Here it comes…' : 'Turn the crank!'}
        </p>
      </div>
    </div>
  )
}
