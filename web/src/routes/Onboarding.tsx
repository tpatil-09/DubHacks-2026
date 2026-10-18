import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { AmbientBackground } from '../components/layout/AmbientBackground'
import { AboutFields, BasicsFields, PhotosFields, PreferencesFields } from '../components/profile/ProfileFields'
import { ArcadeButton } from '../components/ui/ArcadeButton'
import { Capsule } from '../components/ui/Capsule'
import { Mascot } from '../components/ui/Mascot'
import { draftFromProfile, validateAbout, validateBasics, validatePhotos, validatePreferences, type ProfileDraft } from '../lib/profileValidation'
import { useSession } from '../store/session'
import type { OnboardingStep } from '../types'
import type { PastelColor } from '../lib/colors'

const steps: { id: Exclude<OnboardingStep, 'complete'>; title: string; subtitle: string; color: PastelColor }[] = [
  { id: 'basics', title: 'The basics', subtitle: 'Let’s set up your profile.', color: 'bubblegum' },
  { id: 'preferences', title: 'Your preferences', subtitle: 'Choose what feels right; you can update this later.', color: 'sky' },
  { id: 'photos', title: 'Your photos', subtitle: 'Add 1–6 photos. The first one is your cover.', color: 'peach' },
  { id: 'about', title: 'About you', subtitle: 'Stickers and prompts make great conversation starters.', color: 'lilac' },
  { id: 'quiz', title: 'Last step', subtitle: 'Agree to your background check, then start matching.', color: 'mint' },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { account, profile, saveAccount, saveProfile } = useSession()
  const initialIndex = Math.max(0, steps.findIndex((step) => step.id === account?.onboardingStep))
  const [index, setIndex] = useState(initialIndex)
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [consent, setConsent] = useState(false)
  const step = steps[index]

  const update = (patch: Partial<ProfileDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
    setError('')
  }

  async function next() {
    const validators = { basics: validateBasics, preferences: validatePreferences, photos: validatePhotos, about: validateAbout, quiz: () => null }
    const problem = validators[step.id](draft)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    try {
      await saveProfile({
        ...draft,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        city: draft.city.trim(),
        bio: draft.bio.trim(),
        prompts: draft.prompts.filter((prompt) => prompt.answer.trim()).map((prompt) => ({ ...prompt, answer: prompt.answer.trim() })),
        discoverable: false,
      })
      await saveAccount({ onboardingStep: steps[index + 1]?.id ?? 'complete' })
      setIndex(index + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function finish(takeQuiz: boolean) {
    if (!consent) {
      setError('Please agree to the background check to finish. Every SafeMatch member has one.')
      return
    }
    setSaving(true)
    try {
      await saveProfile({ discoverable: account?.settings.discoverable ?? true })
      await saveAccount({ onboardingStep: 'complete', screeningConsentAt: Date.now() })
      navigate(takeQuiz ? '/arcade/quiz' : '/discover', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save. Try again.')
      setSaving(false)
    }
  }

  return (
    <div className="relative min-h-dvh px-4 py-8">
      <AmbientBackground />
      <div className="mx-auto max-w-xl">
        <ol className="mb-6 flex items-center justify-center gap-3" aria-label="Onboarding progress">
          {steps.map((entry, position) => (
            <li key={entry.id} className="flex items-center gap-3" aria-current={position === index ? 'step' : undefined}>
              <Capsule color={position <= index ? entry.color : 'white'} size={position === index ? 40 : 30} open={position < index} />
              <span className="sr-only">{entry.title}{position < index ? ' (done)' : ''}</span>
            </li>
          ))}
        </ol>

        <AnimatePresence mode="wait">
          <motion.section
            key={step.id}
            className="gloss-card p-6 sm:p-8"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <p className="font-display text-sm font-semibold text-ink-soft">Step {index + 1} of {steps.length}</p>
            <h1 className="mt-2 text-4xl">{step.title}</h1>
            <p className="mb-6 text-ink-soft">{step.subtitle}</p>

            {step.id === 'basics' && <BasicsFields draft={draft} onChange={update} />}
            {step.id === 'preferences' && <PreferencesFields draft={draft} onChange={update} />}
            {step.id === 'photos' && <PhotosFields draft={draft} onChange={update} />}
            {step.id === 'about' && <AboutFields draft={draft} onChange={update} />}
            {step.id === 'quiz' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <Mascot mood="excited" size={90} />
                  <p className="text-ink-soft">
                    Every SafeMatch member has a background check, so everyone can relax and enjoy getting to know each other.
                  </p>
                </div>
                <label className="flex items-start gap-3 rounded-2xl border-2 border-mint bg-mint/20 p-4 text-sm">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-0.5 size-5 shrink-0 accent-mint-deep"
                  />
                  <span>
                    I agree that SafeMatch can run a check of public records (court records, registries and news) about me, and
                    show a summary on my profile. Only records linked to me are shown, each with its source and how sure the match
                    is. It’s a limited summary of public sources, not a certified background check.
                  </span>
                </label>
                <p className="text-sm text-ink-soft">
                  Want a fun match? The optional 10-question vibe quiz shows your vibe % with everyone. You can also skip it and just swipe.
                </p>
              </div>
            )}

            {error && <p role="alert" className="mt-5 rounded-2xl bg-peach/40 p-3 text-sm">{error}</p>}

            <div className="mt-7 flex gap-3">
              {index > 0 && (
                <ArcadeButton color="white" onClick={() => setIndex(index - 1)} disabled={saving}>
                  Back
                </ArcadeButton>
              )}
              {step.id === 'quiz' ? (
                <>
                  <ArcadeButton color="white" className="flex-1" onClick={() => finish(true)} disabled={saving || !consent}>
                    Take the vibe quiz
                  </ArcadeButton>
                  <ArcadeButton color="mint" className="flex-1" onClick={() => finish(false)} loading={saving} disabled={!consent}>
                    Start matching
                  </ArcadeButton>
                </>
              ) : (
                <ArcadeButton className="flex-1" onClick={next} loading={saving}>
                  Next
                </ArcadeButton>
              )}
            </div>
          </motion.section>
        </AnimatePresence>
      </div>
    </div>
  )
}
