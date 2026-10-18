import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Ban, ChevronLeft, Flag, Heart, X } from 'lucide-react'
import { ArcadeCard } from '../components/ui/ArcadeCard'
import { ArcadeButton } from '../components/ui/ArcadeButton'
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

  const age = profile.age
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
    <div className="mx-auto max-w-3xl pb-8">
      <button type="button" onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 font-display font-semibold text-ink-soft hover:text-ink">
        <ChevronLeft className="size-5" /> Back
      </button>
      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <div>
          <ArcadeCard tilt className="overflow-hidden p-2.5">
            <ProfilePhoto src={profile.photos[photoIndex]} alt={`${profile.displayName}'s photo ${photoIndex + 1}`} className="aspect-[3/4] w-full rounded-[18px]" emojiSize="text-[8rem]" />
          </ArcadeCard>
          {profile.photos.length > 1 && (
            <div className="mt-3 flex justify-center gap-2" role="tablist" aria-label="Photos">
              {profile.photos.map((photo, index) => (
                <button
                  key={`${photo.slice(0, 30)}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={photoIndex === index}
                  aria-label={`Photo ${index + 1}`}
                  onClick={() => setPhotoIndex(index)}
                  className={`h-3 rounded-full transition-all ${photoIndex === index ? 'w-8 bg-bubblegum' : 'w-3 bg-white'}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-4xl font-bold">
                {profile.displayName}
                {age !== null && <span className="font-medium text-ink-soft">, {age}</span>}
              </h1>
              {profile.isDemo && <DemoTag />}
            </div>
            {profile.city && <p className="text-ink-soft">📍 {profile.city}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <a href="#background-check" aria-label="Jump to background check"><TierChip uid={profile.uid} size="md" /></a>
              <PersonaBadge personaId={profile.quiz?.personaId} />
              {vibe !== null && <VibeMeter percent={vibe} />}
            </div>
          </div>

          <p className="text-lg">{profile.bio}</p>
          <InterestStickers ids={profile.interests} />
          {profile.prompts.map((prompt) => (
            <div key={prompt.question} className="gloss-card p-4">
              <p className="font-display text-sm font-semibold text-ink-soft">{prompt.question}</p>
              <p className="font-display text-xl">{prompt.answer}</p>
            </div>
          ))}

          {!isMe && (
            <>
              <div className="mt-2 flex gap-4">
                <ArcadeButton color="peach" className="flex-1" onClick={() => decide('pass')} disabled={busy} icon={<X className="size-5" />}>
                  Pass
                </ArcadeButton>
                <ArcadeButton className="flex-1" onClick={() => decide('like')} loading={busy} icon={<Heart className="size-5" fill="currentColor" />}>
                  Like
                </ArcadeButton>
              </div>
              <div className="flex gap-4 text-sm">
                <button type="button" onClick={() => setModal('block')} className="flex items-center gap-1 text-ink-soft hover:text-ink">
                  <Ban className="size-4" /> Block
                </button>
                <button type="button" onClick={() => setModal('report')} className="flex items-center gap-1 text-ink-soft hover:text-ink">
                  <Flag className="size-4" /> Report
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-8">
        <BackgroundCheck uid={profile.uid} name={profile.displayName} self={isMe} />
      </div>

      <BlockReportModal otherUid={profile.uid} otherName={profile.displayName} mode={modal} onClose={() => setModal(null)} />
      <MatchModal match={match ? { matchId: match.matchId, them: profile } : null} me={me} onClose={() => navigate('/discover')} />
    </div>
  )
}
