import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Send } from 'lucide-react'
import { GachaponMachine } from '../../components/games/GachaponMachine'
import { ArcadeButton } from '../../components/ui/ArcadeButton'
import { Avatar } from '../../components/ui/ProfilePhoto'
import { Modal } from '../../components/ui/Modal'
import { backend, otherUser } from '../../data'
import { nextWyrPrompt, type WyrPrompt } from '../../games/wouldYouRather/prompts'
import { useMatches, useProfiles } from '../../hooks/data'
import { useSession } from '../../store/session'
import { useTokens } from '../../store/tokens'
import { toast } from '../../store/toast'
import type { WyrChoice } from '../../types'

export default function WouldYouRather() {
  const uid = useSession((state) => state.user?.uid)
  const navigate = useNavigate()
  const addTokens = useTokens((state) => state.add)
  const { matches } = useMatches(uid)
  const partnerIds = useMemo(() => (uid ? matches.map((match) => otherUser(match, uid)) : []), [matches, uid])
  const partners = useProfiles(partnerIds)
  const [myAnswers, setMyAnswers] = useState<Record<string, WyrChoice>>({})
  const [partnerAnswers, setPartnerAnswers] = useState<Record<string, Record<string, WyrChoice>>>({})
  const [prompt, setPrompt] = useState<WyrPrompt | null>(null)
  const [choice, setChoice] = useState<WyrChoice | null>(null)
  const [sendOpen, setSendOpen] = useState(false)

  useEffect(() => {
    if (uid) backend().getWyrAnswers(uid).then(setMyAnswers).catch(() => undefined)
  }, [uid])

  useEffect(() => {
    if (partnerIds.length) backend().getWyrAnswersFor(partnerIds).then(setPartnerAnswers).catch(() => undefined)
  }, [partnerIds])

  function dispense() {
    setChoice(null)
    setPrompt(nextWyrPrompt(new Set(Object.keys(myAnswers))))
  }

  async function pick(side: WyrChoice) {
    if (!uid || !prompt || choice) return
    setChoice(side)
    setMyAnswers((current) => ({ ...current, [prompt.id]: side }))
    addTokens(uid, 2)
    try {
      await backend().saveWyrAnswer(uid, prompt.id, side)
    } catch {
      toast('Your answer didn’t save, but you can still play.', 'error')
    }
  }

  async function sendTo(matchId: string) {
    if (!uid || !prompt || !choice) return
    try {
      await backend().sendMessage(matchId, {
        senderId: uid,
        type: 'game_share',
        text: `Would you rather: ${prompt.a} or ${prompt.b}?`,
        game: { promptId: prompt.id, answers: { [uid]: choice } },
      })
      setSendOpen(false)
      toast('Capsule sent! 🎰', 'success')
      navigate(`/chat/${matchId}`)
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Could not send.', 'error')
    }
  }

  const agreeing = prompt && choice ? partnerIds.filter((id) => partnerAnswers[id]?.[prompt.id] === choice) : []

  return (
    <div className="max-w-4xl pb-10">
      <span className="eyebrow">Fun match</span>
      <h1 className="mt-4 text-[2.6rem] sm:text-5xl">Would you rather…</h1>
      <p className="mb-10 mt-4 text-lg text-ink-soft">Crank the machine, crack a capsule, pick a side.</p>

      <div className="grid items-start gap-8 md:grid-cols-[auto_1fr]">
        <GachaponMachine onDispense={dispense} disabled={!!prompt && !choice} />

        <AnimatePresence mode="wait">
          {!prompt ? (
            <motion.div key="idle" className="gloss-card p-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="font-display text-xl font-semibold">Turn the crank to get your first capsule!</p>
              <p className="mt-2 text-ink-soft">Each one holds a silly (or deep) dilemma. +2 tokens per answer.</p>
            </motion.div>
          ) : (
            <motion.div key={prompt.id} initial={{ scale: 0.8, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
              <p className="mb-3 text-center font-display text-lg font-semibold text-ink-soft">Would you rather…</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {(['a', 'b'] as const).map((side) => {
                  const selected = choice === side
                  return (
                    <motion.button
                      key={side}
                      type="button"
                      onClick={() => pick(side)}
                      disabled={!!choice}
                      aria-pressed={selected}
                      whileHover={choice ? undefined : { y: -4, rotate: side === 'a' ? -1.5 : 1.5 }}
                      whileTap={choice ? undefined : { scale: 0.94 }}
                      animate={choice ? { scale: selected ? 1.04 : 0.94, opacity: selected ? 1 : 0.55 } : { scale: 1, opacity: 1 }}
                      className={`gloss-card min-h-36 p-5 text-center font-display text-xl font-semibold leading-snug ${
                        side === 'a' ? 'bg-gradient-to-br from-white to-blush' : 'bg-gradient-to-br from-white to-sky/50'
                      } ${selected ? 'ring-4 ring-bubblegum' : ''}`}
                    >
                      {side === 'a' ? prompt.a : prompt.b}
                    </motion.button>
                  )
                })}
              </div>

              {choice && (
                <motion.div className="gloss-card mt-5 p-5" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                  {partnerIds.length === 0 ? (
                    <p className="text-ink-soft">Match with someone to see what they picked!</p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex -space-x-3">
                        {agreeing.slice(0, 5).map((id) => (
                          <Avatar key={id} src={partners[id]?.photos[0]} alt={partners[id]?.firstName ?? 'Match'} size={40} />
                        ))}
                      </div>
                      <p className="font-display text-lg font-semibold">
                        {agreeing.length === 0
                          ? 'None of your matches picked this… yet!'
                          : `${agreeing.length} of your ${partnerIds.length} matches picked this too!`}
                      </p>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    {partnerIds.length > 0 && (
                      <ArcadeButton color="lilac" onClick={() => setSendOpen(true)} icon={<Send className="size-4" />}>
                        Send to chat
                      </ArcadeButton>
                    )}
                    <ArcadeButton color="mint" onClick={dispense}>Next capsule</ArcadeButton>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Modal open={sendOpen} onClose={() => setSendOpen(false)} title="Send to a match">
        <ul className="grid gap-2">
          {matches.map((match) => {
            const id = uid ? otherUser(match, uid) : ''
            const partner = partners[id]
            return (
              <li key={match.id}>
                <button type="button" onClick={() => sendTo(match.id)} className="flex w-full items-center gap-3 rounded-2xl bg-white/70 p-2 text-left hover:bg-white">
                  <Avatar src={partner?.photos[0]} alt={partner?.firstName ?? 'Match'} size={44} />
                  <span className="font-display text-lg font-semibold">{partner?.firstName ?? 'Match'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Modal>
    </div>
  )
}
