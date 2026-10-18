import { useMemo } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ProfilePhoto } from '../components/ui/ProfilePhoto'
import { DemoTag } from '../components/ui/Sticker'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States'
import { otherUser } from '../data'
import { useMatches, useProfiles } from '../hooks/data'
import { lastSeen } from '../lib/lastSeen'
import { arcadeVars } from '../lib/colors'
import { useSession } from '../store/session'

export default function Matches() {
  const uid = useSession((state) => state.user?.uid)
  const { matches, loading, error } = useMatches(uid)
  const partnerIds = useMemo(() => (uid ? matches.map((match) => otherUser(match, uid)) : []), [matches, uid])
  const partners = useProfiles(partnerIds)

  if (error) return <ErrorState body={error} />

  return (
    <div className="pb-8">
      <span className="eyebrow">It’s mutual</span>
      <h1 className="mt-4 text-[2.6rem] sm:text-6xl">Your matches.</h1>
      <p className="mb-10 mt-4 text-lg text-ink-soft">Good things start with hello. Tap someone to chat.</p>
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2].map((key) => <Skeleton key={key} className="aspect-[3/4]" />)}
        </div>
      ) : matches.length === 0 ? (
        <EmptyState
          title="No matches yet"
          body="When you and someone both like each other, they’ll show up here."
          action={<Link to="/discover" className="btn-arcade h-12 px-6" style={arcadeVars('bubblegum')}>Start discovering</Link>}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {matches.map((match, index) => {
            const partner = partners[partnerIds[index]]
            const unread = (match.lastMessageAt ?? 0) > lastSeen(match.id)
            return (
              <motion.li
                key={match.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 24 }}
                whileHover={{ y: -4, rotate: index % 2 ? 1 : -1 }}
              >
                <Link to={`/chat/${match.id}`} className="gloss-card block overflow-hidden p-2">
                  <div className="relative overflow-hidden rounded-[18px]">
                    <ProfilePhoto src={partner?.photos[0]} alt={partner?.displayName ?? 'Match'} className="aspect-[3/4] w-full" emojiSize="text-6xl" />
                    {unread && <span className="absolute right-2 top-2 size-4 rounded-full border-[3px] border-white bg-bubblegum" aria-label="New messages" />}
                    {partner?.isDemo && <DemoTag className="absolute left-2 top-2" />}
                  </div>
                  <div className="px-1.5 pb-1 pt-2">
                    <p className="font-display text-lg font-semibold">{partner?.displayName ?? '…'}</p>
                    <p className="truncate text-sm text-ink-soft">{match.lastMessagePreview ?? 'Say hi 👋'}</p>
                  </div>
                </Link>
              </motion.li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
