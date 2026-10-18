import { useState } from 'react'
import { Link } from 'react-router'
import { MapPin, Settings as SettingsIcon } from 'lucide-react'
import { AboutFields, BasicsFields, PhotosFields, PreferencesFields } from '../components/profile/ProfileFields'
import { ArcadeButton } from '../components/ui/ArcadeButton'
import { ArcadeCard } from '../components/ui/ArcadeCard'
import { ProfilePhoto } from '../components/ui/ProfilePhoto'
import { PersonaBadge } from '../components/ui/Badges'
import { InterestStickers } from '../components/ui/Sticker'
import { BackgroundCheck, TierChip } from '../components/safety/BackgroundCheck'
import { draftFromProfile, validateAbout, validateBasics, validatePhotos, validatePreferences, type ProfileDraft } from '../lib/profileValidation'
import { ageFrom } from '../lib/age'
import { arcadeVars } from '../lib/colors'
import { useSession } from '../store/session'
import { toast } from '../store/toast'

type Tab = 'preview' | 'basics' | 'preferences' | 'photos' | 'about'

const tabs: { id: Tab; label: string }[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'basics', label: 'Basics' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'photos', label: 'Photos' },
  { id: 'about', label: 'About' },
]

export default function MyProfile() {
  const profile = useSession((state) => state.profile)
  const saveProfile = useSession((state) => state.saveProfile)
  const [tab, setTab] = useState<Tab>('preview')
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const problem = validateBasics(draft) ?? validatePreferences(draft) ?? validatePhotos(draft) ?? validateAbout(draft)
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
        bio: draft.bio.trim(),
        city: draft.city.trim(),
        prompts: draft.prompts.filter((prompt) => prompt.answer.trim()),
      })
      toast('Profile saved ✨', 'success')
      setTab('preview')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  const age = profile ? ageFrom(profile.birthdate) : null

  return (
    <div className="max-w-4xl pb-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <h1 className="text-[2.6rem] sm:text-6xl">My profile.</h1>
        <Link to="/settings" className="flex items-center gap-1.5 font-display font-semibold text-ink-soft hover:text-ink">
          <SettingsIcon className="size-5" /> Settings
        </Link>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto" role="tablist">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => {
              setTab(entry.id)
              setError('')
            }}
            className={`rounded-xl px-4 py-2 font-semibold transition-colors ${tab === entry.id ? 'bg-blush text-bubblegum' : 'text-ink-soft hover:bg-white hover:text-ink'}`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'preview' && profile ? (
        <div className="grid gap-5 sm:grid-cols-[1fr_1.2fr]">
          <ArcadeCard tilt className="p-2.5">
            <ProfilePhoto src={profile.photos[0]} alt="Your cover photo" className="aspect-[3/4] w-full rounded-[18px]" />
          </ArcadeCard>
          <div className="flex flex-col gap-3">
            <h2 className="text-3xl font-bold">
              {profile.firstName}
              {age !== null && <span className="font-medium text-ink-soft">, {age}</span>}
            </h2>
            {profile.city && <p className="flex items-center gap-1 text-ink-soft"><MapPin className="size-4 shrink-0" aria-hidden /> {profile.city}</p>}
            {profile.pronouns && <p className="text-ink-soft">{profile.pronouns}</p>}
            <TierChip uid={profile.uid} size="md" />
            {profile.quiz ? (
              <PersonaBadge personaId={profile.quiz.personaId} />
            ) : (
              <Link to="/arcade/quiz" className="btn-arcade h-10 w-fit px-4 text-sm" style={arcadeVars('lilac')}>Take the vibe quiz</Link>
            )}
            <p>{profile.bio}</p>
            <InterestStickers ids={profile.interests} />
            {profile.prompts.map((prompt) => (
              <div key={prompt.question} className="gloss-card p-3">
                <p className="font-display text-sm font-semibold text-ink-soft">{prompt.question}</p>
                <p className="font-display text-lg">{prompt.answer}</p>
              </div>
            ))}
          </div>
          <div className="sm:col-span-2">
            <BackgroundCheck uid={profile.uid} name={`${profile.firstName} ${profile.lastName}`.trim()} self />
          </div>
        </div>
      ) : (
        <div className="gloss-card p-6">
          {tab === 'basics' && <BasicsFields draft={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />}
          {tab === 'preferences' && <PreferencesFields draft={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />}
          {tab === 'photos' && <PhotosFields draft={draft} onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))} />}
          {tab === 'about' && <AboutFields draft={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />}
          {error && <p role="alert" className="mt-5 rounded-2xl bg-peach/40 p-3 text-sm">{error}</p>}
          <ArcadeButton className="mt-6 w-full" size="lg" onClick={save} loading={saving}>Save changes</ArcadeButton>
        </div>
      )}
    </div>
  )
}
