import { wyrPromptById } from '../../games/wouldYouRather/prompts'
import { Capsule } from '../ui/Capsule'
import type { Message, WyrChoice } from '../../types'

interface GameShareCardProps {
  message: Message
  myUid: string
  partnerUid: string
  partnerName: string
  onAnswer: (choice: WyrChoice) => void
}

/** A Would You Rather capsule shared in chat. Both answers are revealed once both players pick. */
export function GameShareCard({ message, myUid, partnerUid, partnerName, onAnswer }: GameShareCardProps) {
  const prompt = message.game ? wyrPromptById(message.game.promptId) : undefined
  if (!prompt || !message.game) return <p className="text-sm text-ink-soft">This capsule couldn’t be opened.</p>
  const mine = message.game.answers[myUid]
  const theirs = message.game.answers[partnerUid]
  const bothAnswered = !!mine && !!theirs
  const options: { side: WyrChoice; text: string }[] = [
    { side: 'a', text: prompt.a },
    { side: 'b', text: prompt.b },
  ]

  return (
    <div className="w-72 max-w-full rounded-[22px] border-4 border-white bg-gradient-to-br from-lilac/60 via-white to-blush p-4 shadow-[0_8px_20px_rgba(157,140,240,.25)]">
      <div className="mb-2 flex items-center gap-2">
        <Capsule color="bubblegum" size={28} open />
        <p className="font-display text-sm font-bold tracking-wide text-ink-soft">WOULD YOU RATHER</p>
      </div>
      <div className="grid gap-2">
        {options.map(({ side, text }) => {
          const iPicked = mine === side
          const theyPicked = bothAnswered && theirs === side
          return (
            <button
              key={side}
              type="button"
              disabled={!!mine}
              onClick={() => onAnswer(side)}
              className={`rounded-2xl border-[3px] px-3 py-2 text-left font-display font-medium transition ${
                iPicked ? 'border-bubblegum bg-white' : 'border-white bg-white/70 enabled:hover:bg-white'
              }`}
            >
              {text}
              {(iPicked || theyPicked) && (
                <span className="mt-1 block text-xs font-semibold text-ink-soft">
                  {[iPicked && 'You', theyPicked && partnerName].filter(Boolean).join(' & ')} picked this
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-center text-xs font-semibold text-ink-soft">
        {bothAnswered
          ? mine === theirs ? '✨ Same answer! ✨' : 'Opposites attract? 😄'
          : mine ? `Waiting for ${partnerName}… answers reveal together.` : 'Pick one to reveal both answers!'}
      </p>
    </div>
  )
}
