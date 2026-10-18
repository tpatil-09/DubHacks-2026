import { useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, Camera, Star, Trash2 } from 'lucide-react'
import { ArcadeButton } from '../ui/ArcadeButton'
import { ProfilePhoto } from '../ui/ProfilePhoto'
import { Sticker } from '../ui/Sticker'
import { interests, promptQuestions } from '../../lib/interests'
import { LIMITS, type ProfileDraft } from '../../lib/profileValidation'
import { prepareProfilePhoto } from '../../lib/image'
import { pastel, type PastelColor } from '../../lib/colors'
import { backend } from '../../data'
import { useSession } from '../../store/session'

interface FieldsProps {
  draft: ProfileDraft
  onChange: (patch: Partial<ProfileDraft>) => void
}

const genders = [
  { id: 'woman', label: 'Woman' },
  { id: 'man', label: 'Man' },
  { id: 'nonbinary', label: 'Nonbinary' },
]

const lookingFor = [
  { id: 'women', label: 'Women' },
  { id: 'men', label: 'Men' },
  { id: 'nonbinary', label: 'Nonbinary people' },
]

function ChoicePill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 font-semibold transition ${
        selected ? 'border-bubblegum bg-blush text-bubblegum' : 'border-[var(--color-line)] bg-white hover:border-bubblegum/50'
      }`}
    >
      {children}
    </button>
  )
}

export function BasicsFields({ draft, onChange }: FieldsProps) {
  const toggleLooking = (id: string) =>
    onChange({
      interestedIn: draft.interestedIn.includes(id) ? draft.interestedIn.filter((entry) => entry !== id) : [...draft.interestedIn, id],
    })
  return (
    <div className="grid gap-5">
      <div>
        <label htmlFor="displayName" className="label-arcade">Display name</label>
        <input id="displayName" className="input-arcade" maxLength={LIMITS.name} value={draft.displayName} onChange={(event) => onChange({ displayName: event.target.value })} />
      </div>
      <div>
        <label htmlFor="age" className="label-arcade">Age</label>
        <input id="age" type="number" inputMode="numeric" min={18} max={120} step={1} required className="input-arcade" value={draft.age || ''} onChange={(event) => onChange({ age: Number(event.target.value) || 0 })} />
        <p className="mt-1 text-xs text-ink-soft">Your age appears on your profile. SafeMatch is for adults 18 and older.</p>
      </div>
      <fieldset>
        <legend className="label-arcade">I am a…</legend>
        <div className="flex flex-wrap gap-2">
          {genders.map((gender) => (
            <ChoicePill key={gender.id} selected={draft.gender === gender.id} onClick={() => onChange({ gender: gender.id })}>
              {gender.label}
            </ChoicePill>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label-arcade">I’d like to meet…</legend>
        <div className="flex flex-wrap gap-2">
          {lookingFor.map((option) => (
            <ChoicePill key={option.id} selected={draft.interestedIn.includes(option.id)} onClick={() => toggleLooking(option.id)}>
              {option.label}
            </ChoicePill>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="city" className="label-arcade">Location <span className="font-normal text-ink-soft">(city or region)</span></label>
        <input id="city" className="input-arcade" autoComplete="address-level2" maxLength={LIMITS.city} placeholder="Seattle, WA" required value={draft.city} onChange={(event) => onChange({ city: event.target.value })} />
        <p className="mt-1 text-xs text-ink-soft">Enter a city or region only, not a street address or precise location.</p>
      </div>
    </div>
  )
}

const avatarEmojis = ['🦊', '🐻', '🐸', '🐱', '🐼', '🦋', '🐙', '🌷', '🐧', '🦦', '🐰', '🍓']
const avatarColors: PastelColor[] = ['bubblegum', 'peach', 'mint', 'lilac', 'butter', 'sky']

export function PhotosFields({ draft, onChange }: FieldsProps) {
  const uid = useSession((state) => state.user?.uid)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState('')
  const [avatarColor, setAvatarColor] = useState<PastelColor>('bubblegum')
  const full = draft.photos.length >= LIMITS.maxPhotos

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])].slice(0, LIMITS.maxPhotos - draft.photos.length)
    event.target.value = ''
    if (!uid || files.length === 0) return
    setError('')
    setUploading(files.length)
    const added: string[] = []
    for (const file of files) {
      try {
        const blob = await prepareProfilePhoto(file)
        added.push(await backend().uploadPhoto(uid, blob))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Upload failed.')
      } finally {
        setUploading((count) => count - 1)
      }
    }
    onChange({ photos: [...draft.photos, ...added] })
  }

  const move = (index: number, to: number) => {
    const photos = [...draft.photos]
    const [photo] = photos.splice(index, 1)
    photos.splice(to, 0, photo)
    onChange({ photos })
  }

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-3 gap-3">
        {draft.photos.map((photo, index) => (
          <div key={`${photo.slice(0, 40)}-${index}`} className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-[var(--color-line)] bg-white">
            <ProfilePhoto src={photo} alt={`Photo ${index + 1}`} className="h-full w-full" emojiSize="text-5xl" />
            {index === 0 && (
              <span className="absolute left-1.5 top-1.5 rounded-md bg-white px-2 py-0.5 text-xs font-bold shadow-sm">Cover</span>
            )}
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
              {index > 0 ? (
                <button type="button" onClick={() => move(index, 0)} aria-label={`Make photo ${index + 1} the cover`} className="grid size-8 place-items-center rounded-full bg-white/90 shadow">
                  <Star className="size-4" />
                </button>
              ) : <span />}
              {index > 0 && (
                <button type="button" onClick={() => move(index, index - 1)} aria-label={`Move photo ${index + 1} earlier`} className="grid size-8 place-items-center rounded-full bg-white/90 shadow">
                  <ArrowLeft className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onChange({ photos: draft.photos.filter((_, position) => position !== index) })}
                aria-label={`Remove photo ${index + 1}`}
                className="grid size-8 place-items-center rounded-full bg-white/90 shadow"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, index) => (
          <div key={`uploading-${index}`} className="skeleton aspect-[3/4]" aria-label="Uploading photo" />
        ))}
        {!full && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid aspect-[3/4] place-items-center rounded-xl border-2 border-dashed border-[var(--color-line)] bg-white text-ink-soft transition hover:border-bubblegum hover:text-bubblegum"
          >
            <span className="flex flex-col items-center gap-1 font-semibold">
              <Camera className="size-7" aria-hidden /> Add photo
            </span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
      {error && <p role="alert" className="rounded-2xl bg-peach/40 p-3 text-sm">{error}</p>}

      {draft.photos.length === 0 && (
        <div className="rounded-xl border border-[var(--color-line)] bg-white p-4">
          <p className="label-arcade">Or pick a cute avatar</p>
          <div className="mb-3 flex gap-2">
            {avatarColors.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`${color} background`}
                aria-pressed={avatarColor === color}
                onClick={() => setAvatarColor(color)}
                className={`size-8 rounded-full ring-offset-2 ${avatarColor === color ? 'ring-2 ring-ink' : ''}`}
                style={{ background: pastel[color].bg }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {avatarEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onChange({ photos: [...draft.photos, `avatar:${emoji}:${avatarColor}`] })}
                className="grid size-12 place-items-center rounded-xl text-2xl transition hover:-translate-y-0.5"
                style={{ background: pastel[avatarColor].soft }}
                aria-label={`Add ${emoji} avatar`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function AboutFields({ draft, onChange }: FieldsProps) {
  const toggleInterest = (id: string) => {
    if (draft.interests.includes(id)) onChange({ interests: draft.interests.filter((entry) => entry !== id) })
    else if (draft.interests.length < LIMITS.maxInterests) onChange({ interests: [...draft.interests, id] })
  }
  const prompts = draft.prompts.length ? draft.prompts : [{ question: promptQuestions[0], answer: '' }, { question: promptQuestions[1], answer: '' }]
  const setPrompt = (index: number, patch: Partial<(typeof prompts)[number]>) =>
    onChange({ prompts: prompts.map((prompt, position) => (position === index ? { ...prompt, ...patch } : prompt)) })

  return (
    <div className="grid gap-6">
      <div>
        <label htmlFor="bio" className="label-arcade">Bio</label>
        <textarea
          id="bio"
          rows={3}
          maxLength={LIMITS.bio}
          className="input-arcade resize-none"
          placeholder="Ceramics on Tuesdays, ramen on Thursdays…"
          value={draft.bio}
          onChange={(event) => onChange({ bio: event.target.value })}
        />
        <p className="mt-1 text-right text-xs text-ink-soft">{draft.bio.length}/{LIMITS.bio}</p>
      </div>

      <fieldset>
        <legend className="label-arcade">
          Interest stickers <span className="font-normal text-ink-soft">({draft.interests.length}/{LIMITS.maxInterests}, pick at least {LIMITS.minInterests})</span>
        </legend>
        <div className="flex flex-wrap gap-2.5">
          {interests.map((interest, index) => (
            <Sticker
              key={interest.id}
              as="button"
              color={interest.color}
              tilt={[-3, 2, -1, 3][index % 4]}
              selected={draft.interests.includes(interest.id)}
              onClick={() => toggleInterest(interest.id)}
            >
              <span aria-hidden>{interest.emoji}</span>
              {interest.label}
            </Sticker>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="label-arcade">Prompts</legend>
        {prompts.map((prompt, index) => (
          <div key={index} className="rounded-xl border border-[var(--color-line)] bg-white p-3">
            <select
              aria-label={`Prompt ${index + 1} question`}
              className="mb-2 w-full rounded-lg bg-blush px-3 py-2 font-semibold"
              value={prompt.question}
              onChange={(event) => setPrompt(index, { question: event.target.value })}
            >
              {promptQuestions.map((question) => (
                <option key={question}>{question}</option>
              ))}
            </select>
            <input
              aria-label={`Prompt ${index + 1} answer`}
              className="input-arcade"
              maxLength={LIMITS.promptAnswer}
              value={prompt.answer}
              onChange={(event) => setPrompt(index, { answer: event.target.value })}
              placeholder="Your answer"
            />
          </div>
        ))}
      </fieldset>
    </div>
  )
}

export function SaveBar({ onSave, saving, label = 'Save' }: { onSave: () => void; saving: boolean; label?: string }) {
  return (
    <ArcadeButton onClick={onSave} loading={saving} size="lg" className="w-full">
      {label}
    </ArcadeButton>
  )
}
