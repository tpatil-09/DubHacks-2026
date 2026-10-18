import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Ban, ChevronLeft, Flag, Heart, MapPin, X } from 'lucide-react'
import { ProfilePhoto } from '../components/ui/ProfilePhoto'
import { DemoTag, InterestStickers } from '../components/ui/Sticker'
import { PersonaBadge, VibeMeter } from '../components/ui/Badges'
import { EmptyState, PageLoader } from '../components/ui/States'
import { BlockReportModal } from '../components/profile/BlockReport'
import { MatchModal } from '../components/discover/MatchModal'
import { BackgroundCheck, TierChip } from '../components/safety/BackgroundCheck'
import { useProfile } from '../hooks/data'
import { backend } from '../data'
import { vibePercent } from '../lib/vibe'
import { ageFrom } from '../lib/age'
import { useSession } from '../store/session'
import { toast } from '../store/toast'
import type { LikeType } from '../types'

export default function ProfileDetail() {
  const { uid = '' } = useParams()
  const navigate = useNavigate()
  const me = useSession((state) => state.profile)
  const myUid = useSession((state) => state.user?.uid)
  const { profile, loading } = useProfile(uid)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [modal, setModal] = useState<'block' | 'report' | null>(null)
  const [match, setMatch] = useState<{ matchId: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const location = useLocation()

  useEffect(() => {
    if (!loading && location.hash === '#background-check') {
      document.getElementById('background-check')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [loading, location.hash])

  if (loading) return <PageLoader />
  if (!profile) return <EmptyState title="Profile not found" body="This profile is no longer available." mood="thinking" />

  const age = ageFrom(profile.birthdate)
  const vibe = me?.quiz && profile.quiz ? vibePercent(me.quiz.axes, profile.quiz.axes) : null
  const isMe = profile.uid === myUid

  async function decide(type: LikeType) {
    if (!myUid || !profile) return
    setBusy(true)
    try {
      const result = await backend().setLike(myUid, profile.uid, type)
      if (result.matchId) setMatch({ matchId: result.matchId })
      else {
        toast(type === 'like' ? `You liked ${profile.displayName} 💖` : 'Passed', 'success')
        navigate('/discover')
      }
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'That didn’t save.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-8">
      <button type="button" onClick={() => navigate(-1)} className="mb-6 flex items-center gap-1 font-semibold text-ink-soft hover:text-ink">
        <ChevronLeft className="size-5" /> Back
      </button>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0">
          <div className="relative overflow-hidden rounded-2xl shadow-[0_28px_56px_-28px_rgba(35,26,27,.55)]">
            <ProfilePhoto src={profile.photos[photoIndex]} alt={`${profile.displayName}'s photo ${photoIndex + 1}`} className="aspect-[4/5] sm:aspect-[19/20] w-full" emojiSize="text-[6rem] -translate-y-[62%] sm:text-[10rem] sm:-translate-y-[18%]" />
            <div className="absolute left-5 top-5 flex flex-wrap gap-2">
              <a href="#background-check" aria-label="Jump to background check"><TierChip uid={profile.uid} variant="badge" /></a>
              {profile.isDemo && <DemoTag />}
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-6 pb-6 pt-24 text-white sm:px-8 sm:pb-8">
              {vibe !== null && (
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-white/90"><span className="size-2 rounded-full bg-mint" aria-hidden /> {vibe}% vibe match</p>
              )}
              <h1 className="text-4xl text-white sm:text-5xl">
                {profile.displayName}
                {age !== null && <span className="ml-2 font-medium">{age}</span>}
              </h1>
              {profile.city && <p className="mt-2 flex items-center gap-2 text-lg text-white/90"><MapPin className="size-5 shrink-0" aria-hidden /> {profile.city}</p>}
            </div>
          </div>
          {profile.photos.length > 1 && (
            <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label="Photos">
              {profile.photos.map((photo, index) => (
                <button
                  key={`${photo.slice(0, 30)}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={photoIndex === index}
                  aria-label={`Photo ${index + 1}`}
                  onClick={() => setPhotoIndex(index)}
                  className={`h-2 rounded-full transition-all ${photoIndex === index ? 'w-7 bg-bubblegum' : 'w-2 bg-ink/20'}`}
                />
              ))}
            </div>
          )}
          {!isMe && (
            <div className="mt-10 flex justify-center gap-7">
              <button type="button" className="btn-circle size-[4.5rem]" aria-label={`Pass on ${profile.displayName}`} onClick={() => decide('pass')} disabled={busy}>
                <X className="size-8 text-ink-soft" strokeWidth={1.75} />
              </button>
              <button type="button" className="btn-circle btn-circle-primary size-[5.5rem]" aria-label={`Like ${profile.displayName}`} onClick={() => decide('like')} disabled={busy}>
                <Heart className="size-9" fill="currentColor" />
              </button>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <span className="eyebrow">The little things</span>
          <h2 className="mt-8 text-4xl sm:text-[3.4rem]">Get to know {profile.displayName}.</h2>
          <p className="mt-6 text-lg leading-8 text-ink-soft">{profile.bio}</p>
          <div className="mt-6"><InterestStickers ids={profile.interests} /></div>
          {profile.prompts.map((prompt) => (
            <div key={prompt.question} className="mt-8 border-t border-[var(--color-line)] pt-8">
              <span className="eyebrow">{prompt.question.replace(/…$/, '')}</span>
              <p className="mt-4 text-[1.75rem] font-bold leading-snug tracking-tight">“{prompt.answer}”</p>
            </div>
          ))}
          <dl className="mt-8 grid gap-4 border-t border-[var(--color-line)] pt-7">
            {profile.city && (
              <div className="flex justify-between gap-4"><dt className="text-ink-soft">Lives in</dt><dd className="font-bold">{profile.city}</dd></div>
            )}
            {profile.quiz && (
              <div className="flex items-center justify-between gap-4"><dt className="text-ink-soft">Vibe type</dt><dd><PersonaBadge personaId={profile.quiz.personaId} /></dd></div>
            )}
            {vibe !== null && (
              <div className="flex items-center justify-between gap-4"><dt className="text-ink-soft">In sync with you</dt><dd><VibeMeter percent={vibe} /></dd></div>
            )}
          </dl>
          {!isMe && (
            <div className="mt-8 flex gap-5 text-sm">
              <button type="button" onClick={() => setModal('block')} className="flex items-center gap-1.5 text-ink-soft hover:text-ink">
                <Ban className="size-4" /> Block
              </button>
              <button type="button" onClick={() => setModal('report')} className="flex items-center gap-1.5 text-ink-soft hover:text-ink">
                <Flag className="size-4" /> Report
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-16 border-t border-[var(--color-line)] pt-12">
        <BackgroundCheck uid={profile.uid} name={profile.displayName} self={isMe} />
      </div>

      <BlockReportModal otherUid={profile.uid} otherName={profile.displayName} mode={modal} onClose={() => setModal(null)} />
      <MatchModal match={match ? { matchId: match.matchId, them: profile } : null} me={me} onClose={() => navigate('/discover')} />
    </div>
  )
}
