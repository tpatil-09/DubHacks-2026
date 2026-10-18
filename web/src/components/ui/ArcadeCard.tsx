import { useRef, type HTMLAttributes, type PointerEvent } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'

interface ArcadeCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Tilt toward the pointer with a holographic sheen. */
  tilt?: boolean
}

export function ArcadeCard({ tilt = false, className = '', children, ...rest }: ArcadeCardProps) {
  if (!tilt) {
    return (
      <div className={`gloss-card ${className}`} {...rest}>
        {children}
      </div>
    )
  }
  return (
    <TiltCard className={className} {...rest}>
      {children}
    </TiltCard>
  )
}

function TiltCard({ className = '', children, style, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0.5)
  const y = useMotionValue(0.5)
  const springX = useSpring(x, { stiffness: 200, damping: 20 })
  const springY = useSpring(y, { stiffness: 200, damping: 20 })
  const rotateY = useTransform(springX, [0, 1], [-10, 10])
  const rotateX = useTransform(springY, [0, 1], [8, -8])
  const sheen = useTransform(springX, [0, 1], ['0% 0%', '100% 100%'])

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    if (reduceMotion || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    x.set((event.clientX - rect.left) / rect.width)
    y.set((event.clientY - rect.top) / rect.height)
  }

  function reset() {
    x.set(0.5)
    y.set(0.5)
  }

  return (
    <div style={{ perspective: 900, ...style }} {...rest}>
      <motion.div
        ref={ref}
        onPointerMove={handleMove}
        onPointerLeave={reset}
        className={`gloss-card ${className}`}
        style={reduceMotion ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }}
      >
        {children}
        {!reduceMotion && <motion.span aria-hidden className="holo-sheen" style={{ backgroundPosition: sheen }} />}
      </motion.div>
    </div>
  )
}
