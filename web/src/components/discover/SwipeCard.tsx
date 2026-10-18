import { forwardRef, useImperativeHandle, useState } from 'react'
import { Link } from 'react-router'
import { MapPin } from 'lucide-react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from 'motion/react'
import { ProfilePhoto } from '../ui/ProfilePhoto'
import { InterestStickers, DemoTag } from '../ui/Sticker'
import { interestById } from '../../lib/interests'
import { TierChip } from '../safety/BackgroundCheck'
import { ageFrom } from '../../lib/age'
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
      aria-label={`${profile.firstName}${age ? `, ${age}` : ''}. Tap to flip the card.`}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        {/* Front: full-bleed photo with the details laid over it */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-white shadow-[0_28px_56px_-28px_rgba(35,26,27,.55)] [backface-visibility:hidden]">
          <ProfilePhoto src={profile.photos[0]} alt={`${profile.firstName}'s photo`} className="h-full w-full" emojiSize="text-[6rem] -translate-y-[62%] sm:text-[10rem] sm:-translate-y-[18%]" />
          <div className="absolute left-5 top-5 flex flex-wrap gap-2">
            <TierChip uid={profile.uid} variant="badge" />
            {profile.isDemo && <DemoTag />}
          </div>
          <motion.span style={{ opacity: likeOpacity }} className="absolute right-6 top-20 rotate-12 rounded-xl border-[3px] border-white bg-mint-deep/90 px-4 py-1 text-3xl font-extrabold tracking-tight text-white">
            LIKE
          </motion.span>
          <motion.span style={{ opacity: passOpacity }} className="absolute left-6 top-20 -rotate-12 rounded-xl border-[3px] border-white bg-ink/80 px-4 py-1 text-3xl font-extrabold tracking-tight text-white">
            PASS
          </motion.span>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-6 pb-6 pt-24 text-white sm:px-8 sm:pb-8">
            {vibe !== null && (
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-white/90">
                <span className="size-2 rounded-full bg-mint" aria-hidden /> {vibe}% vibe match
              </p>
            )}
            <h2 className="text-4xl text-white sm:text-5xl">
              {profile.firstName}
              {age !== null && <span className="ml-2 font-medium">{age}</span>}
            </h2>
            {profile.city && (
              <p className="mt-2 flex items-center gap-2 text-base text-white/90 sm:text-lg">
                <MapPin className="size-5 shrink-0" aria-hidden /> {profile.city}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.interests.slice(0, 3).map((id) => {
                const interest = interestById(id)
                return interest ? (
                  <span key={id} className="rounded-lg bg-white/20 px-3.5 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
                    {interest.label}
                  </span>
                ) : null
              })}
            </div>
          </div>
        </div>

        {/* Back */}
        <div className="gloss-card absolute inset-0 flex flex-col gap-5 overflow-y-auto p-7 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <span className="eyebrow">About</span>
          <h2 className="text-3xl">{profile.firstName}</h2>
          <p className="leading-relaxed text-ink-soft">{profile.bio}</p>
          {profile.prompts.map((prompt) => (
            <div key={prompt.question} className="border-t border-[var(--color-line)] pt-4">
              <p className="eyebrow">{prompt.question}</p>
              <p className="mt-2 text-xl font-bold tracking-tight">“{prompt.answer}”</p>
            </div>
          ))}
          <InterestStickers ids={profile.interests} />
          <Link
            to={`/profile/${profile.uid}`}
            className="btn-arcade mt-auto h-11 px-5 text-sm"
            onClick={(event) => event.stopPropagation()}
          >
            Full profile
          </Link>
        </div>
      </motion.div>
    </motion.div>
  )
})
