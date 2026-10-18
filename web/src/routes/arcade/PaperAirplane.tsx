import { useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { RefreshCw, Send } from 'lucide-react'
import { PaperFlight } from '../../components/games/PaperFlight'
import { PaperFace } from '../../components/games/PaperSheet'
import { ArcadeButton } from '../../components/ui/ArcadeButton'
import { Avatar } from '../../components/ui/ProfilePhoto'
import { backend } from '../../data'
import { PAPER_NOTE_MAX, cleanNote, rollPapers } from '../../games/paperAirplane/papers'
import { useAirplanes, useProfiles } from '../../hooks/data'
import { useSession } from '../../store/session'
import { toast } from '../../store/toast'
import { useTokens } from '../../store/tokens'
import type { PaperAirplane, PaperDesign } from '../../types'

export default function PaperAirplaneGame() {
  const uid = useSession((state) => state.user?.uid)
  const addTokens = useTokens((state) => state.add)
  const { inbox, sent } = useAirplanes(uid)
  const [options, setOptions] = useState<PaperDesign[]>(() => rollPapers())
  const [picked, setPicked] = useState(0)
  const [text, setText] = useState('')
  const [flight, setFlight] = useState<{ design: PaperDesign; text: string; result: Promise<void> } | null>(null)
  const [box, setBox] = useState<'inbox' | 'sent'>('inbox')
  const sending = useRef(false)
  const design = options[picked]

  const people = useProfiles([
    ...inbox.map((plane) => plane.fromUid),
    ...sent.flatMap((plane) => (plane.reply ? [plane.reply.fromUid] : [])),
  ])

  function reshuffle() {
    setOptions(rollPapers())
    setPicked(0)
  }

  function send() {
    if (!uid || flight || sending.current) return
    sending.current = true
    let note = ''
    try {
      note = cleanNote(text)
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Write a note first.', 'error')
      return
    }
    const chosen = design
    const result = backend()
      .throwPaperAirplane(uid, chosen, note)
      .then(() => addTokens(uid, 3))
    setFlight({ design: chosen, text: note, result })
  }

  function onFlightDone() {
    const pending = flight?.result
    sending.current = false
    setFlight(null)
    void pending
      ?.then(() => {
        setText('')
        setBox('sent')
        toast('It’s in the air. You’ll only learn who caught it if they write back.', 'success')
      })
      .catch((cause) => {
        toast(cause instanceof Error ? cause.message : 'The airplane didn’t leave.', 'error')
      })
  }

  const waiting = inbox.filter((plane) => !plane.reply).length

  return (
    <div className="max-w-3xl pb-12">
      <span className="eyebrow">Fun match</span>
      <h1 className="mt-4 text-[2.6rem] sm:text-5xl">Throw a paper airplane.</h1>
      <p className="mb-8 mt-4 max-w-xl text-lg text-ink-soft">
        Pick a sheet, write a note, and send it to someone random. You won’t see who caught it unless they write back.
      </p>

      <div className="flex items-end justify-between gap-3">
        <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">Pick a sheet</p>
        <button type="button" onClick={reshuffle} className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-soft hover:text-ink" disabled={!!flight}>
          <RefreshCw className="size-4" aria-hidden />
          New sheets
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 sm:gap-5">
        {options.map((option, index) => (
          <button
            key={`${option.color}-${option.pattern}`}
            type="button"
            aria-pressed={index === picked}
            aria-label={`${option.pattern} paper`}
            onClick={() => setPicked(index)}
            className={`rounded-sm transition ${index === picked ? 'scale-[1.03] ring-4 ring-ink' : 'opacity-80 hover:-translate-y-1 hover:opacity-100'}`}
          >
            <PaperFace design={option} className="aspect-[3/4] w-full" />
          </button>
        ))}
      </div>

      <div className="mx-auto mt-8 w-full max-w-sm">
        <PaperFace design={design} className="min-h-72">
          <label className="block h-full p-5 pr-8">
            <span className="sr-only">Your note</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, PAPER_NOTE_MAX))}
              maxLength={PAPER_NOTE_MAX}
              placeholder="Write something worth unfolding…"
              className="h-56 w-full resize-none bg-transparent font-serif text-xl italic leading-snug outline-none placeholder:text-current placeholder:opacity-40"
              style={{ color: design.ink }}
            />
          </label>
        </PaperFace>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-ink-soft">{text.trim().length}/{PAPER_NOTE_MAX}</span>
          <ArcadeButton color="sky" onClick={send} disabled={!!flight || text.trim().length === 0} icon={<Send className="size-4" />}>
            Throw it
          </ArcadeButton>
        </div>
      </div>

      <div className="mt-14">
        <div className="flex gap-2" role="tablist" aria-label="Airplanes">
          <Tab active={box === 'inbox'} onClick={() => setBox('inbox')}>
            Landed{waiting > 0 ? ` (${waiting})` : ''}
          </Tab>
          <Tab active={box === 'sent'} onClick={() => setBox('sent')}>
            Thrown ({sent.length})
          </Tab>
        </div>
        <div className="mt-4 grid gap-4">
          {box === 'inbox' && (inbox.length === 0
            ? <Empty>No airplanes have landed yet.</Empty>
            : inbox.map((plane) => <InboxCard key={plane.id} plane={plane} name={people[plane.fromUid]?.firstName} photo={people[plane.fromUid]?.photos[0]} uid={uid} />))}
          {box === 'sent' && (sent.length === 0
            ? <Empty>You haven’t thrown one yet.</Empty>
            : sent.map((plane) => (
              <SentCard
                key={plane.id}
                plane={plane}
                name={plane.reply ? people[plane.reply.fromUid]?.firstName : undefined}
                photo={plane.reply ? people[plane.reply.fromUid]?.photos[0] : undefined}
              />
            )))}
        </div>
      </div>

      {flight && <PaperFlight design={flight.design} text={flight.text} onDone={onFlightDone} />}
    </div>
  )
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-bold ${active ? 'bg-ink text-white' : 'bg-white text-ink-soft'}`}
    >
      {children}
    </button>
  )
}

function Empty({ children }: { children: string }) {
  return <p className="rounded-2xl bg-white px-5 py-8 text-ink-soft">{children}</p>
}

function InboxCard({ plane, name, photo, uid }: { plane: PaperAirplane; name?: string; photo?: string; uid?: string }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  async function reply() {
    if (!uid) return
    let note = ''
    try {
      note = cleanNote(draft)
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Write a reply first.', 'error')
      return
    }
    setBusy(true)
    try {
      await backend().replyToAirplane(uid, plane.id, note)
      toast(`${name ?? 'They'} can see it was you.`, 'success')
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Could not send your reply.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="gloss-card grid gap-4 p-4 sm:grid-cols-[9rem_1fr] sm:p-5">
      <PaperFace design={plane.design} className="min-h-36">
        <p className="p-3 font-serif text-sm italic leading-snug">{plane.text}</p>
      </PaperFace>
      <div>
        <p className="flex items-center gap-2 font-bold">
          <Avatar src={photo} alt={name ?? 'Sender'} size={32} />
          From {name ?? 'someone'}
        </p>
        {plane.reply ? (
          <p className="mt-3 text-ink-soft">You wrote back: “{plane.reply.text}” They know it was you.</p>
        ) : (
          <div className="mt-3">
            <label className="block text-sm text-ink-soft" htmlFor={`reply-${plane.id}`}>Write back and they’ll learn it was you.</label>
            <textarea
              id={`reply-${plane.id}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, PAPER_NOTE_MAX))}
              maxLength={PAPER_NOTE_MAX}
              className="input-arcade mt-2 min-h-20 w-full"
            />
            <ArcadeButton color="mint" size="sm" className="mt-2" onClick={reply} loading={busy} disabled={draft.trim().length === 0}>
              Write back
            </ArcadeButton>
          </div>
        )}
      </div>
    </article>
  )
}

function SentCard({ plane, name, photo }: { plane: PaperAirplane; name?: string; photo?: string }) {
  return (
    <motion.article layout className="gloss-card grid gap-4 p-4 sm:grid-cols-[9rem_1fr] sm:p-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <PaperFace design={plane.design} className="min-h-36">
        <p className="p-3 font-serif text-sm italic leading-snug">{plane.text}</p>
      </PaperFace>
      <div>
        <p className="text-sm text-ink-soft">Your note</p>
        {plane.reply ? (
          <div className="mt-2">
            <p className="flex items-center gap-2 font-bold">
              <Avatar src={photo} alt={name ?? 'Catcher'} size={32} />
              {name ?? 'Someone'} wrote back
            </p>
            <p className="mt-2 font-serif text-lg italic leading-snug">“{plane.reply.text}”</p>
          </div>
        ) : (
          <p className="mt-2 text-ink-soft">Still in the air. You’ll only learn who caught it if they write back.</p>
        )}
      </div>
    </motion.article>
  )
}
