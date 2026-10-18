import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import { ArcadeButton } from '../ui/ArcadeButton'
import { PaperFace } from './PaperSheet'
import type { PaperDesign } from '../../types'

interface PaperFlightProps {
  design: PaperDesign
  text: string
  onDone: () => void
}

const FOLD_MS = 2300
const FLY_MS = 3200

export function PaperFlight({ design, text, onDone }: PaperFlightProps) {
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<'fold' | 'fly'>(reduced ? 'fly' : 'fold')
  const finished = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const finish = () => {
    if (finished.current) return
    finished.current = true
    onDoneRef.current()
  }

  useEffect(() => {
    if (reduced) {
      const timer = setTimeout(finish, 700)
      return () => clearTimeout(timer)
    }
    const fly = setTimeout(() => setPhase('fly'), FOLD_MS)
    const done = setTimeout(finish, FOLD_MS + FLY_MS)
    return () => {
      clearTimeout(fly)
      clearTimeout(done)
    }
    // The timers should start once per flight. `finish` reads the latest callback through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  const status = phase === 'fold' ? 'Folding your note into a paper airplane.' : 'Your airplane is flying away.'

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-hidden bg-cream/75 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Throwing your paper airplane">
      <p className="sr-only" aria-live="polite">{status}</p>
      {reduced ? (
        <motion.div className="grid h-full place-items-center" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.7 }}>
          <PaperFace design={design} className="h-64 w-48">
            <p className="p-5 font-serif text-xl italic leading-snug">{text}</p>
          </PaperFace>
        </motion.div>
      ) : phase === 'fold' ? (
        <div className="grid h-full place-items-center">
          <FoldingSheet design={design} text={text} />
        </div>
      ) : (
        <FlyingPlane design={design} />
      )}
      <ArcadeButton color="white" className="absolute bottom-8 left-1/2 -translate-x-1/2" onClick={finish}>
        Skip
      </ArcadeButton>
    </div>,
    document.body,
  )
}

function FoldingSheet({ design, text }: { design: PaperDesign; text: string }) {
  const [folded, setFolded] = useState(false)
  const [tucked, setTucked] = useState(false)

  useEffect(() => {
    const fold = setTimeout(() => setFolded(true), 550)
    const tuck = setTimeout(() => setTucked(true), 1250)
    return () => {
      clearTimeout(fold)
      clearTimeout(tuck)
    }
  }, [])

  return (
    <div className="[perspective:900px]">
      <motion.div
        className="relative h-72 w-56 origin-center shadow-xl"
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ rotate: -6, clipPath: 'polygon(0% 0%, 100% 0%, 100% 35%, 100% 100%, 55% 100%, 0% 100%)' }}
        animate={
          tucked
            ? { rotate: -16, scale: 0.78, clipPath: 'polygon(0% 58%, 88% 16%, 62% 48%, 100% 42%, 54% 74%, 36% 58%)' }
            : { rotate: -4, scale: 1, clipPath: 'polygon(0% 0%, 100% 0%, 100% 35%, 100% 100%, 55% 100%, 0% 100%)' }
        }
        transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      >
        <PaperFace design={design} className="absolute inset-0">
          <motion.p className="p-5 font-serif text-xl italic leading-snug" animate={{ opacity: tucked ? 0 : 1 }}>
            {text}
          </motion.p>
        </PaperFace>
        <motion.div
          aria-hidden
          className="absolute left-0 top-0 h-full w-1/2 origin-right"
          style={{ backgroundColor: design.color, backfaceVisibility: 'hidden', boxShadow: 'inset -14px 0 18px rgba(35,26,27,.12)' }}
          animate={{ rotateY: folded ? -172 : 0 }}
          transition={{ duration: 0.55, ease: [0.45, 0, 0.2, 1] }}
        />
        <motion.div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[46%] origin-top"
          style={{ backgroundColor: design.color, backfaceVisibility: 'hidden', boxShadow: 'inset 0 12px 16px rgba(35,26,27,.1)' }}
          animate={{ rotateX: tucked ? -176 : 0 }}
          transition={{ duration: 0.5, ease: [0.45, 0, 0.2, 1] }}
        />
      </motion.div>
    </div>
  )
}

function FlyingPlane({ design }: { design: PaperDesign }) {
  return (
    <motion.div
      className="absolute left-1/2 top-[42%] -ml-24"
      initial={{ x: 0, y: 0, rotate: -18, scale: 0.7, opacity: 0 }}
      animate={{
        x: [0, 160, -190, 210, -70, 250, 30, 520],
        y: [20, -110, 40, -160, 80, -30, -130, -300],
        rotate: [-18, 16, -30, 12, -12, 22, -20, -48],
        scale: [0.75, 1, 0.92, 1.05, 0.88, 1, 0.55, 0.06],
        opacity: [0, 1, 1, 1, 1, 1, 0.75, 0],
      }}
      transition={{ duration: FLY_MS / 1000, ease: 'easeInOut' }}
    >
      <PlaneGraphic design={design} />
    </motion.div>
  )
}

function PlaneGraphic({ design }: { design: PaperDesign }) {
  const patternId = useId()
  return (
    <svg viewBox="0 0 220 96" className="w-48 overflow-visible drop-shadow-[0_12px_16px_rgba(35,26,27,.28)]" aria-hidden>
      <defs>
        <pattern id={patternId} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.3" fill={design.accent} />
        </pattern>
      </defs>
      <path d="M8 50 L198 18 L146 48 L208 42 L124 72 L82 54 Z" fill={design.color} stroke={design.ink} strokeWidth="2.5" strokeLinejoin="round" />
      {design.pattern !== 'solid' && <path d="M8 50 L198 18 L146 48 L208 42 L124 72 L82 54 Z" fill={`url(#${patternId})`} opacity="0.85" />}
      <path d="M8 50 L146 48" stroke={design.accent} strokeWidth="2" />
      <path d="M82 54 L198 18" stroke={design.accent} strokeWidth="1.6" opacity="0.8" />
    </svg>
  )
}
