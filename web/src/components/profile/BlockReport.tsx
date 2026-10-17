import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Modal } from '../ui/Modal'
import { ArcadeButton } from '../ui/ArcadeButton'
import { backend } from '../../data'
import { useSession } from '../../store/session'
import { toast } from '../../store/toast'
import type { UserReportReason } from '../../types'

const reasons: { id: UserReportReason; label: string }[] = [
  { id: 'harassment', label: 'Harassment or hate' },
  { id: 'fake', label: 'Fake profile' },
  { id: 'scam', label: 'Scam or spam' },
  { id: 'underage', label: 'May be under 18' },
  { id: 'other', label: 'Something else' },
]

interface BlockReportProps {
  otherUid: string
  otherName: string
  mode: 'block' | 'report' | null
  onClose: () => void
}

export function BlockReportModal({ otherUid, otherName, mode, onClose }: BlockReportProps) {
  const uid = useSession((state) => state.user?.uid)
  const navigate = useNavigate()
  const [reason, setReason] = useState<UserReportReason>('harassment')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!uid) return
    setBusy(true)
    try {
      if (mode === 'report') {
        await backend().reportUser(uid, otherUid, reason, details.trim())
        await backend().block(uid, otherUid)
        toast(`Thanks. ${otherName} was reported and blocked.`, 'success')
      } else {
        await backend().block(uid, otherUid)
        toast(`${otherName} is blocked.`, 'success')
      }
      onClose()
      navigate('/discover')
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'That didn’t work. Try again.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={mode !== null} onClose={onClose} title={mode === 'report' ? `Report ${otherName}` : `Block ${otherName}?`}>
      {mode === 'report' ? (
        <div className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="label-arcade">What’s going on?</legend>
            {reasons.map((option) => (
              <label key={option.id} className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-2">
                <input type="radio" name="reason" value={option.id} checked={reason === option.id} onChange={() => setReason(option.id)} className="size-4 accent-bubblegum" />
                {option.label}
              </label>
            ))}
          </fieldset>
          <div>
            <label htmlFor="report-details" className="label-arcade">Details <span className="font-normal text-ink-soft">(optional)</span></label>
            <textarea id="report-details" rows={3} maxLength={1000} className="input-arcade resize-none" value={details} onChange={(event) => setDetails(event.target.value)} />
          </div>
          <p className="text-sm text-ink-soft">Reporting also blocks {otherName}. They won’t be told who reported them.</p>
        </div>
      ) : (
        <p className="text-ink-soft">{otherName} won’t appear in Discover or your matches anymore. You can unblock them in Settings.</p>
      )}
      <div className="mt-6 flex gap-3">
        <ArcadeButton color="white" className="flex-1" onClick={onClose} disabled={busy}>Cancel</ArcadeButton>
        <ArcadeButton color="peach" className="flex-1" onClick={submit} loading={busy}>
          {mode === 'report' ? 'Report & block' : 'Block'}
        </ArcadeButton>
      </div>
    </Modal>
  )
}
