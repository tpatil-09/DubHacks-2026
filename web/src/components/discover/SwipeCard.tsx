import { forwardRef, useImperativeHandle, useState } from 'react'
import { Link } from 'react-router'
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from 'motion/react'
import { ProfilePhoto } from '../ui/ProfilePhoto'
import { InterestStickers, DemoTag } from '../ui/Sticker'
import { PersonaBadge, VibeMeter } from '../ui/Badges'
import { ageFrom } from '../../lib/age'
import { arcadeVars } from '../../lib/colors'
import type { LikeType, Profile } from '../../types'

export interface SwipeCardHandle {
  swipe: (type: LikeType) => void
}

interface SwipeCardProps {
  profile: Profile
  vibe: number | null
  onDecide: (type: LikeType) => void
  active: boolean
}

const THRESHOLD = 110

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard({ profile, vibe, onDecide, active }, ref) {
  const reduceMotion = useReducedMotion()
  const [flipped, setFlipped] = useState(false)
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-300, 300], [-14, 14])
  const likeOpacity = useTransform(x, [20, THRESHOLD], [0, 1])
  const passOpacity = useTransform(x, [-THRESHOLD, -20], [1, 0])

  function fly(type: LikeType) {
    const target = type === 'like' ? 700 : -700
    if (reduceMotion) {
      onDecide(type)
      return
    }
    animate(x, target, { type: 'spring', stiffness: 260, damping: 30, velocity: 800 }).then(() => onDecide(type))
  }

  useImperativeHandle(ref, () => ({ swipe: fly }))

  function handleDragEnd(_event: unknown, info: PanInfo) {
    if (info.offset.x > THRESHOLD || info.velocity.x > 700) fly('like')
    else if (info.offset.x < -THRESHOLD || info.velocity.x < -700) fly('pass')
    else animate(x, 0, { type: 'spring', stiffness: 400, damping: 25 })
  }

  const age = ageFrom(profile.birthdate)

  return (
    <motion.div
      className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
      style={{ x, rotate, perspective: 1200 }}
      drag={active ? 'x' : false}
      dragSnapToOrigin={false}
      onDragEnd={handleDragEnd}
      onTap={() => active && setFlipped((value) => !value)}
      aria-label={`${profile.displayName}${age ? `, ${age}` : ''}. Tap to flip the card.`}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        {/* Front */}
        <div className="gloss-card absolute inset-0 overflow-hidden p-2.5 [backface-visibility:hidden]">
          <div className="relative h-full overflow-hidden rounded-[18px]">
            <ProfilePhoto src={profile.photos[0]} alt={`${profile.displayName}'s photo`} className="h-full w-full" emojiSize="text-[9rem]" />
            <span className="holo-sheen" aria-hidden />
            <div className="absolute left-3 top-3 flex gap-2">{profile.isDemo && <DemoTag />}</div>
            <motion.span style={{ opacity: likeOpacity }} className="absolute left-5 top-10 -rotate-12 rounded-2xl border-4 border-mint-deep bg-white/80 px-4 py-1 font-display text-3xl font-bold text-mint-deep">
              LIKE
            </motion.span>
            <motion.span style={{ opacity: passOpacity }} className="absolute right-5 top-10 rotate-12 rounded-2xl border-4 border-peach-deep bg-white/80 px-4 py-1 font-display text-3xl font-bold text-peach-deep">
              PASS
            </motion.span>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/90 to-transparent p-4 pt-16">
              <h2 className="text-3xl font-bold">
                {profile.displayName}
                {age !== null && <span className="font-medium text-ink-soft">, {age}</span>}
              </h2>
              {profile.city && <p className="text-sm text-ink-soft">📍 {profile.city}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PersonaBadge personaId={profile.quiz?.personaId} />
                {vibe !== null && <VibeMeter percent={vibe} />}
              </div>
              <div className="mt-3">
                <InterestStickers ids={profile.interests} max={4} />
              </div>
            </div>
          </div>
        </div>

        {/* Back */}
        <div className="gloss-card absolute inset-0 flex flex-col gap-4 overflow-y-auto p-6 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <h2 className="text-2xl font-bold">About {profile.displayName}</h2>
          <p>{profile.bio}</p>
          {profile.prompts.map((prompt) => (
            <div key={prompt.question} className="rounded-2xl bg-blush/70 p-4">
              <p className="font-display text-sm font-semibold text-ink-soft">{prompt.question}</p>
              <p className="font-display text-lg">{prompt.answer}</p>
            </div>
          ))}
          <InterestStickers ids={profile.interests} />
          <Link
            to={`/profile/${profile.uid}`}
            className="btn-arcade mt-auto h-11 px-5 text-sm"
            style={arcadeVars('lilac')}
            onClick={(event) => event.stopPropagation()}
          >
            Full profile
          </Link>
        </div>
      </motion.div>
    </motion.div>
  )
})
