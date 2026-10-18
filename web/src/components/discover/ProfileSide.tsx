import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, Sparkle, Sparkles } from 'lucide-react'
import { TierChip } from '../safety/BackgroundCheck'
import { personaById } from '../../games/quiz/personas'
import type { Profile } from '../../types'

/** "Get to know" column shown beside the top Discover card. */
export function ProfileSide({ profile, vibe, hasQuiz }: { profile: Profile; vibe: number | null; hasQuiz: boolean }) {
  const prompt = profile.prompts[0]
  const persona = personaById(profile.quiz?.personaId)
  const rows: { label: string; value: ReactNode }[] = [
    ...(profile.city ? [{ label: 'Lives in', value: profile.city }] : []),
    ...(persona ? [{ label: 'Vibe type', value: persona.name }] : []),
    {
      label: 'Background check',
      value: (
        <Link to={`/profile/${profile.uid}#background-check`} className="hover:underline">
          <TierChip uid={profile.uid} />
        </Link>
      ),
    },
  ]

  return (
    <AnimatePresence mode="wait">
      <motion.aside
        key={profile.uid}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
        aria-label={`About ${profile.displayName}`}
        className="min-w-0"
      >
        <div className="flex items-center justify-between">
          <span className="eyebrow">The little things</span>
          <Sparkles className="size-7 text-bubblegum" aria-hidden />
        </div>
        <h2 className="mt-8 text-4xl sm:text-[3.4rem]">Get to know {profile.displayName}.</h2>
        <p className="mt-6 text-lg leading-8 text-ink-soft">{profile.bio}</p>

        {prompt && (
          <div className="mt-8 border-t border-[var(--color-line)] pt-8">
            <span className="eyebrow">{prompt.question.replace(/…|\.\.\.$/, '')}</span>
            <p className="mt-4 text-[1.9rem] font-bold leading-snug tracking-tight">“{prompt.answer}”</p>
          </div>
        )}

        <dl className="mt-8 grid gap-4 border-t border-[var(--color-line)] pt-7">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4">
              <dt className="text-ink-soft">{row.label}</dt>
              <dd className="text-right font-bold">{row.value}</dd>
            </div>
          ))}
        </dl>

        <Link
          to={vibe !== null ? '/arcade/would-you-rather' : hasQuiz ? '/arcade' : '/arcade/quiz'}
          className="mt-8 flex items-center gap-5 rounded-2xl bg-butter px-7 py-6 transition hover:brightness-[.98]"
        >
          <Sparkle className="size-9 shrink-0 fill-ink text-ink" aria-hidden />
          <span className="flex-1">
            <span className="block text-ink">{vibe !== null ? `Same energy? You’re ${vibe}% in sync.` : 'Want a fun match?'}</span>
            <span className="block font-extrabold">
              {vibe !== null ? 'Play Would You Rather.' : hasQuiz ? 'They haven’t taken the quiz yet. Try a game.' : 'Take the vibe quiz.'}
            </span>
          </span>
          <ArrowUpRight className="size-6 shrink-0" aria-hidden />
        </Link>
      </motion.aside>
    </AnimatePresence>
  )
}
