import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Heart, MapPin, ShieldCheck, Star, X } from 'lucide-react'
import { SwipeCard, type SwipeCardHandle } from '../components/discover/SwipeCard'
import { MatchModal } from '../components/discover/MatchModal'
import { ProfileSide } from '../components/discover/ProfileSide'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States'
import { backend } from '../data'
import { vibePercent } from '../lib/vibe'
import { useSession } from '../store/session'
import { useTokens } from '../store/tokens'
import { toast } from '../store/toast'
import type { LikeType, Profile } from '../types'

export default function Discover() {
  const user = useSession((state) => state.user)
  const me = useSession((state) => state.profile)
  const addTokens = useTokens((state) => state.add)
  const [queue, setQueue] = useState<Profile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [match, setMatch] = useState<{ matchId: string; them: Profile } | null>(null)
  const topCard = useRef<SwipeCardHandle>(null)
  const deciding = useRef(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(null)
    setQueue(null)
    try {
      setQueue(await backend().listDiscover(user.uid))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load profiles.')
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const decide = useCallback(
    async (type: LikeType) => {
      const target = queue?.[0]
      if (!user || !target || deciding.current) return
      deciding.current = true
      setQueue((current) => current?.slice(1) ?? null)
      try {
        const { matchId } = await backend().setLike(user.uid, target.uid, type)
        if (type === 'like') addTokens(user.uid, 1)
        if (matchId) {
          addTokens(user.uid, 5)
          setMatch({ matchId, them: target })
        }
      } catch (cause) {
        toast(cause instanceof Error ? cause.message : 'That didn’t save. Try again.', 'error')
        setQueue((current) => (current ? [target, ...current] : [target]))
      } finally {
        deciding.current = false
      }
    },
    [queue, user, addTokens],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (match || (event.target as HTMLElement)?.closest('input, textarea, select')) return
      if (event.key === 'ArrowRight') topCard.current?.swipe('like')
      if (event.key === 'ArrowLeft') topCard.current?.swipe('pass')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [match])

  const vibeWith = (profile: Profile) => (me?.quiz && profile.quiz ? vibePercent(me.quiz.axes, profile.quiz.axes) : null)

  const top = queue?.[0]

  return (
    <div className="pb-6">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[2.6rem] sm:text-6xl">Meet your next spark.</h1>
          <p className="mt-4 text-lg text-ink-soft">Find your match, or play a game for a fun match. Check their background check before you meet.</p>
        </div>
        <p className="mt-5 hidden shrink-0 items-center gap-2 text-ink-soft sm:flex">
          <MapPin className="size-5" aria-hidden /> {me?.city ? `Near ${me.city.split(',')[0]}` : 'Near you'}
        </p>
      </header>

      {error ? (
        <div className="mt-10"><ErrorState body={error} onRetry={load} /></div>
      ) : queue === null ? (
        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
          <Skeleton className="aspect-[4/5] sm:aspect-[19/20] w-full rounded-2xl" />
          <div className="grid content-start gap-4"><Skeleton className="h-6 w-40" /><Skeleton className="h-14 w-3/4" /><Skeleton className="h-24 w-full" /></div>
        </div>
      ) : queue.length === 0 || !top ? (
        <div className="mt-10">
          <EmptyState
            title="You’ve seen everyone for now"
            body="New people join every day. Try a fun-match game while you wait."
            action={<Link to="/arcade" className="btn-arcade h-12 px-6">Try a fun match</Link>}
          />
        </div>
      ) : (
        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-16">
          <div className="flex min-w-0 flex-col items-center">
            <div className="relative aspect-[4/5] sm:aspect-[19/20] w-full select-none">
              {queue.slice(0, 3).reverse().map((profile, index, shown) => {
                const depth = shown.length - 1 - index
                const isTop = depth === 0
                return (
                  <div
                    key={profile.uid}
                    className="absolute inset-0 transition-transform duration-300"
                    style={{ transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.035})`, zIndex: 10 - depth, opacity: depth > 1 ? 0 : 1 }}
                    aria-hidden={!isTop}
                  >
                    <SwipeCard ref={isTop ? topCard : undefined} profile={profile} vibe={vibeWith(profile)} onDecide={decide} active={isTop} />
                  </div>
                )
              })}
            </div>
            <div className="mt-10 flex items-center gap-7">
              <button type="button" className="btn-circle size-[4.5rem]" aria-label={`Pass on ${top.firstName}`} onClick={() => topCard.current?.swipe('pass')}>
                <X className="size-8 text-ink-soft" strokeWidth={1.75} />
              </button>
              <Link to={`/profile/${top.uid}`} className="btn-circle size-[4.5rem]" aria-label={`See ${top.firstName}’s full profile`}>
                <Star className="size-8 text-mint-deep" strokeWidth={1.75} />
              </Link>
              <button type="button" className="btn-circle btn-circle-primary size-[5.5rem]" aria-label={`Like ${top.firstName}`} onClick={() => topCard.current?.swipe('like')}>
                <Heart className="size-9" fill="currentColor" />
              </button>
            </div>
            <p className="mt-5 text-ink-soft">A little courage goes a long way.</p>
          </div>

          <ProfileSide profile={top} vibe={vibeWith(top)} hasQuiz={!!me?.quiz} />
        </div>
      )}

      <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] pt-6 text-ink-soft">
        <span className="flex items-center gap-2">Only good energy here. <Heart className="size-5" aria-hidden /></span>
        <span className="flex items-center gap-2"><ShieldCheck className="size-5" aria-hidden /> Every profile includes a background check</span>
      </footer>

      <MatchModal match={match} me={me} onClose={() => setMatch(null)} />
    </div>
  )
}
