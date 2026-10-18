import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Avatar } from '../ui/ProfilePhoto'
import { ArcadeButton } from '../ui/ArcadeButton'
import { celebrate } from '../../lib/confetti'
import type { Profile } from '../../types'

interface MatchModalProps {
  match: { matchId: string; them: Profile } | null
  me: Profile | null
  onClose: () => void
}

export function MatchModal({ match, me, onClose }: MatchModalProps) {
  const navigate = useNavigate()

  useEffect(() => {
    if (match) {
      celebrate()
      new Audio('/sounds/its-a-match.mp3').play().catch(() => {})
    }
  }, [match])

  return (
    <AnimatePresence>
      {match && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="It's a match"
        >
          <motion.div
            className="gloss-card w-full max-w-sm p-8 text-center"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16 }}
          >
            <p className="eyebrow !text-bubblegum">It’s mutual</p>
            <h2 className="mt-1 text-4xl font-bold">You matched with {match.them.firstName}.</h2>
            <div className="my-6 flex items-center justify-center">
              <motion.div initial={{ x: -80, rotate: -20 }} animate={{ x: 10, rotate: -8 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}>
                <Avatar src={me?.photos[0]} alt="You" size={104} />
              </motion.div>
              <motion.span className="z-10 -mx-2 text-4xl" initial={{ scale: 0 }} animate={{ scale: [0, 1.5, 1] }} transition={{ delay: 0.35 }} aria-hidden>
                💖
              </motion.span>
              <motion.div initial={{ x: 80, rotate: 20 }} animate={{ x: -10, rotate: 8 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}>
                <Avatar src={match.them.photos[0]} alt={match.them.firstName} size={104} />
              </motion.div>
            </div>
            <p className="mb-6 text-ink-soft">You and {match.them.firstName} liked each other.</p>
            <div className="grid gap-3">
              <ArcadeButton size="lg" onClick={() => navigate(`/chat/${match.matchId}`)}>
                Say hello
              </ArcadeButton>
              <ArcadeButton color="white" onClick={onClose}>
                Keep browsing
              </ArcadeButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
