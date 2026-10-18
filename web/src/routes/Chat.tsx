import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { motion } from 'motion/react'
import { Ban, ChevronLeft, Ellipsis, Flag, HeartCrack, Send, ShieldCheck, User } from 'lucide-react'
import { Avatar } from '../components/ui/ProfilePhoto'
import { PersonaBadge } from '../components/ui/Badges'
import { ArcadeButton } from '../components/ui/ArcadeButton'
import { Modal } from '../components/ui/Modal'
import { DemoTag } from '../components/ui/Sticker'
import { EmptyState, PageLoader } from '../components/ui/States'
import { GameShareCard } from '../components/chat/GameShareCard'
import { BlockReportModal } from '../components/profile/BlockReport'
import { backend, otherUser } from '../data'
import { useMatches, useMessages, useProfile } from '../hooks/data'
import { nextWyrPrompt, type WyrPrompt } from '../games/wouldYouRather/prompts'
import { interestById } from '../lib/interests'
import { markSeen } from '../lib/lastSeen'
import { useSession } from '../store/session'
import { toast } from '../store/toast'
import type { WyrChoice } from '../types'

const MAX_LENGTH = 1000

export default function Chat() {
  const { matchId = '' } = useParams()
  const navigate = useNavigate()
  const uid = useSession((state) => state.user?.uid) ?? ''
  const me = useSession((state) => state.profile)
  const { matches, loading: matchesLoading } = useMatches(uid)
  const match = matches.find((entry) => entry.id === matchId)
  const partnerUid = match ? otherUser(match, uid) : undefined
  const { profile: partner } = useProfile(partnerUid)
  const { messages, loading } = useMessages(match ? matchId : undefined)
  const [text, setText] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<'block' | 'report' | null>(null)
  const [gamePrompt, setGamePrompt] = useState<WyrPrompt | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    markSeen(matchId)
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, matchId])

  const icebreakers = useMemo(() => {
    if (!partner || !me) return []
    const shared = partner.interests.filter((id) => me.interests.includes(id)).map(interestById).filter(Boolean)
    const ideas = shared.slice(0, 2).map((interest) => `We both like ${interest!.label.toLowerCase()} ${interest!.emoji} What got you into it?`)
    if (partner.prompts[0]) ideas.push(`"${partner.prompts[0].answer}" — okay, I need the full story.`)
    ideas.push('What’s the best thing that happened to you this week?')
    return ideas.slice(0, 3)
  }, [partner, me])

  if (matchesLoading) return <PageLoader />
  if (!match || !partnerUid) {
    return <EmptyState title="Chat not found" body="This match may have ended." mood="thinking" action={<Link to="/matches" className="font-display font-semibold underline">Back to matches</Link>} />
  }

  const partnerName = partner?.displayName ?? 'your match'

  async function send(event?: FormEvent, override?: string) {
    event?.preventDefault()
    const body = (override ?? text).trim().slice(0, MAX_LENGTH)
    if (!body) return
    setText('')
    try {
      await backend().sendMessage(matchId, { senderId: uid, type: 'text', text: body })
    } catch (cause) {
      setText(body)
      toast(cause instanceof Error ? cause.message : 'Message didn’t send.', 'error')
    }
  }

  async function sendGame(choice: WyrChoice) {
    if (!gamePrompt) return
    const prompt = gamePrompt
    setGamePrompt(null)
    try {
      await backend().sendMessage(matchId, {
        senderId: uid,
        type: 'game_share',
        text: `Would you rather: ${prompt.a} or ${prompt.b}?`,
        game: { promptId: prompt.id, answers: { [uid]: choice } },
      })
      await backend().saveWyrAnswer(uid, prompt.id, choice)
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Capsule didn’t send.', 'error')
    }
  }

  async function unmatch() {
    setMenuOpen(false)
    try {
      await backend().unmatch(uid, matchId)
      toast(`Unmatched with ${partnerName}.`)
      navigate('/matches')
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Could not unmatch.', 'error')
    }
  }

  const onlySystem = messages.every((message) => message.type === 'system')

  return (
    <div className="mx-auto flex h-[calc(100dvh-11rem)] max-w-2xl flex-col lg:h-[calc(100dvh-6rem)]">
      <header className="gloss-card flex items-center gap-3 p-3">
        <button type="button" onClick={() => navigate('/matches')} aria-label="Back to matches" className="grid size-9 place-items-center rounded-full hover:bg-blush">
          <ChevronLeft className="size-5" />
        </button>
        <Link to={`/profile/${partnerUid}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar src={partner?.photos[0]} alt={partnerName} size={46} />
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-display text-lg font-semibold">
              {partnerName} {partner?.isDemo && <DemoTag className="!text-[10px]" />}
            </span>
            <PersonaBadge personaId={partner?.quiz?.personaId} />
          </span>
        </Link>
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Chat options" className="grid size-10 place-items-center rounded-full hover:bg-blush">
          <Ellipsis className="size-6" />
        </button>
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-1 py-4" aria-live="polite">
        {loading && <PageLoader />}
        {messages.map((message) => {
          if (message.type === 'system') {
            return (
              <p key={message.id} className="mx-auto w-fit rounded-full bg-butter/70 px-4 py-1 font-display text-sm font-semibold">
                {message.text}
              </p>
            )
          }
          const mine = message.senderId === uid
          return (
            <motion.div
              key={message.id}
              className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              initial={{ y: 10, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            >
              {message.type === 'game_share' ? (
                <GameShareCard
                  message={message}
                  myUid={uid}
                  partnerUid={partnerUid}
                  partnerName={partnerName}
                  onAnswer={(choice) => backend().answerGameShare(matchId, message.id, uid, choice).catch(() => toast('Answer didn’t save.', 'error'))}
                />
              ) : (
                <p
                  title={new Date(message.createdAt).toLocaleString()}
                  className={`max-w-[78%] whitespace-pre-wrap break-words rounded-[20px] border-[3px] border-white px-4 py-2 shadow-sm ${
                    mine ? 'rounded-br-md bg-sky' : 'rounded-bl-md bg-blush'
                  }`}
                >
                  {message.text}
                </p>
              )}
            </motion.div>
          )
        })}
        {!loading && onlySystem && icebreakers.length > 0 && (
          <div className="gloss-card mx-auto max-w-md p-4">
            <p className="mb-2 font-display font-semibold">Need an icebreaker?</p>
            <div className="grid gap-2">
              {icebreakers.map((idea) => (
                <button key={idea} type="button" onClick={() => send(undefined, idea)} className="rounded-2xl bg-white/80 px-3 py-2 text-left text-sm hover:bg-white">
                  {idea}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={send} className="gloss-card flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={() => setGamePrompt(nextWyrPrompt(new Set()))}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-lilac text-xl shadow-[inset_0_2px_4px_rgba(255,255,255,.8),0_3px_0_#9d8cf0]"
          aria-label="Send a Would You Rather capsule"
        >
          🎰
        </button>
        <label htmlFor="chat-input" className="sr-only">Message {partnerName}</label>
        <input
          id="chat-input"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none"
          placeholder={`Message ${partnerName}…`}
          maxLength={MAX_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoComplete="off"
        />
        <ArcadeButton type="submit" size="sm" className="!h-11 !w-11 !px-0" aria-label="Send message" disabled={!text.trim()}>
          <Send className="size-5" />
        </ArcadeButton>
      </form>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Chat options">
        <div className="grid gap-2">
          <MenuItem icon={<User className="size-5" />} label="View profile" onClick={() => navigate(`/profile/${partnerUid}`)} />
          <MenuItem icon={<ShieldCheck className="size-5" />} label="Background check" onClick={() => navigate(`/profile/${partnerUid}#background-check`)} />
          <MenuItem icon={<HeartCrack className="size-5" />} label="Unmatch" onClick={unmatch} />
          <MenuItem icon={<Ban className="size-5" />} label="Block" onClick={() => { setMenuOpen(false); setModal('block') }} />
          <MenuItem icon={<Flag className="size-5" />} label="Report" onClick={() => { setMenuOpen(false); setModal('report') }} />
        </div>
      </Modal>

      <Modal open={!!gamePrompt} onClose={() => setGamePrompt(null)} title="Would you rather…">
        {gamePrompt && (
          <div className="grid gap-3">
            <p className="text-sm text-ink-soft">Pick your answer. {partnerName} sees theirs revealed after they choose.</p>
            {(['a', 'b'] as const).map((side) => (
              <ArcadeButton key={side} color={side === 'a' ? 'blush' : 'sky'} className="!h-auto min-h-14 py-3 text-left" onClick={() => sendGame(side)}>
                {side === 'a' ? gamePrompt.a : gamePrompt.b}
              </ArcadeButton>
            ))}
            <button type="button" className="mt-1 font-display font-semibold text-ink-soft hover:text-ink" onClick={() => setGamePrompt(nextWyrPrompt(new Set([gamePrompt.id])))}>
              🔄 Different capsule
            </button>
          </div>
        )}
      </Modal>

      <BlockReportModal otherUid={partnerUid} otherName={partnerName} mode={modal} onClose={() => setModal(null)} />
    </div>
  )
}

function MenuItem({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 text-left font-display font-semibold hover:bg-white">
      {icon}
      {label}
    </button>
  )
}
