import { AnimatePresence, motion } from 'motion/react'
import { useToasts } from '../../store/toast'

const tones = {
  info: 'bg-white',
  success: 'bg-mint',
  error: 'bg-peach',
}

export function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            type="button"
            onClick={() => dismiss(toast.id)}
            className={`pointer-events-auto rounded-full border-[3px] border-white px-5 py-2 font-display font-medium shadow-[0_8px_20px_rgba(59,47,74,.15)] ${tones[toast.tone]}`}
            initial={{ y: -30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            {toast.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
