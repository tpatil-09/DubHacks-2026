import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Heart, X } from 'lucide-react'
import { SwipeCard, type SwipeCardHandle } from '../components/discover/SwipeCard'
import { MatchModal } from '../components/discover/MatchModal'
import { ArcadeButton } from '../components/ui/ArcadeButton'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States'
import { backend } from '../data'
import { vibePercent } from '../lib/vibe'
import { arcadeVars } from '../lib/colors'
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

  return (
    <div className="mx-auto flex max-w-[440px] flex-col items-center gap-5 pb-6">
      <div className="w-full">
        <div><span className="eyebrow">Today’s profiles</span><h1 className="text-4xl">Discover</h1></div>
        {!me?.quiz && (
          <p className="text-sm text-ink-soft">
            <Link to="/arcade/quiz" className="font-semibold text-bubblegum-deep underline-offset-2 hover:underline">Take the vibe quiz</Link> to see your vibe % with everyone.
          </p>
        )}
      </div>

      {error ? (
        <ErrorState body={error} onRetry={load} />
      ) : queue === null ? (
        <Skeleton className="aspect-[3/4] w-full rounded-[24px]" />
      ) : queue.length === 0 ? (
        <EmptyState
          title="You’ve seen everyone!"
          body="New people join every day. Try a fun-match game while you wait."
          action={<Link to="/arcade" className="btn-arcade h-12 px-6" style={arcadeVars('lilac')}>Try a fun match</Link>}
        />
      ) : (
        <>
          <div className="relative aspect-[3/4] w-full select-none">
            {queue.slice(0, 3).reverse().map((profile, index, shown) => {
              const depth = shown.length - 1 - index
              const isTop = depth === 0
              return (
                <div
                  key={profile.uid}
                  className="absolute inset-0 transition-transform duration-300"
                  style={{ transform: `translateY(${depth * 14}px) scale(${1 - depth * 0.05})`, zIndex: 10 - depth }}
                  aria-hidden={!isTop}
                >
                  <SwipeCard ref={isTop ? topCard : undefined} profile={profile} vibe={vibeWith(profile)} onDecide={decide} active={isTop} />
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex items-center gap-8">
            <ArcadeButton color="peach" size="icon" aria-label={`Pass on ${queue[0].displayName}`} onClick={() => topCard.current?.swipe('pass')}>
              <X className="size-7" strokeWidth={3} />
            </ArcadeButton>
            <ArcadeButton color="bubblegum" size="icon" className="!size-16" aria-label={`Like ${queue[0].displayName}`} onClick={() => topCard.current?.swipe('like')}>
              <Heart className="size-8" fill="currentColor" />
            </ArcadeButton>
          </div>
          <p className="text-xs text-ink-soft">Swipe, tap the buttons, or use ← → keys. Tap a card to flip it.</p>
        </>
      )}

      <MatchModal match={match} me={me} onClose={() => setMatch(null)} />
    </div>
  )
}
