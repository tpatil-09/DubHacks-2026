import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { FileSearch, LogOut, Trash2 } from 'lucide-react'
import { ArcadeButton } from '../components/ui/ArcadeButton'
import { Avatar } from '../components/ui/ProfilePhoto'
import { Modal } from '../components/ui/Modal'
import { backend, firebaseAvailable, leaveDemoMode } from '../data'
import { useProfiles } from '../hooks/data'
import { useSession } from '../store/session'
import { toast } from '../store/toast'
import type { ReportRequest } from '../types'

const statusLabels: Record<ReportRequest['status'], string> = {
  queued: 'Queued',
  searching: 'Searching',
  verifying: 'Verifying',
  analyzing: 'Analyzing',
  complete: 'Complete',
  incomplete: 'Incomplete',
  failed: 'Failed',
}

export default function Settings() {
  const navigate = useNavigate()
  const { user, account, saveAccount, saveProfile } = useSession()
  const uid = user?.uid
  const [reports, setReports] = useState<ReportRequest[] | null>(null)
  const [blocked, setBlocked] = useState<string[]>([])
  const blockedProfiles = useProfiles(blocked)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const isDemo = backend().kind === 'demo'

  useEffect(() => {
    if (!uid) return
    backend().listMyReportRequests(uid).then(setReports).catch(() => setReports([]))
    backend().listBlocked(uid).then(setBlocked).catch(() => setBlocked([]))
  }, [uid])

  async function toggleDiscoverable() {
    const discoverable = !(account?.settings.discoverable ?? true)
    try {
      await saveAccount({ settings: { discoverable, sounds: account?.settings.sounds ?? false } })
      await saveProfile({ discoverable })
      toast(discoverable ? 'You’re visible in Discover.' : 'You’re hidden from Discover.', 'success')
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Could not update.', 'error')
    }
  }

  async function unblock(otherUid: string) {
    if (!uid) return
    await backend().unblock(uid, otherUid)
    setBlocked((current) => current.filter((id) => id !== otherUid))
    toast('Unblocked.', 'success')
  }

  async function deleteData() {
    if (!uid) return
    setBusy(true)
    try {
      await backend().deleteMyData(uid)
      toast(isDemo ? 'Demo data reset.' : 'Your data was deleted.', 'success')
      navigate('/', { replace: true })
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Could not delete your data.', 'error')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5 pb-10">
      <h1 className="text-3xl font-bold">Privacy & settings</h1>

      <section className="gloss-card flex items-center justify-between gap-4 p-5">
        <div>
          <h2 className="text-xl font-semibold">Show me in Discover</h2>
          <p className="text-sm text-ink-soft">Turn off to take a break. Your matches and chats stay.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={account?.settings.discoverable ?? true}
          aria-label="Show me in Discover"
          onClick={toggleDiscoverable}
          className={`relative h-9 w-16 shrink-0 rounded-full border-[3px] border-white transition ${account?.settings.discoverable ?? true ? 'bg-mint' : 'bg-gray-200'}`}
        >
          <span className={`absolute top-0.5 size-7 rounded-full bg-white shadow transition-all ${account?.settings.discoverable ?? true ? 'left-7' : 'left-0.5'}`} />
        </button>
      </section>

      <section className="gloss-card p-5">
        <h2 className="text-xl font-semibold">My safety reports</h2>
        <p className="mb-3 text-sm text-ink-soft">Only you can see these.</p>
        {reports === null ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-ink-soft">You haven’t requested any reports.</p>
        ) : (
          <ul className="grid gap-2">
            {reports.map((report) => (
              <li key={report.id}>
                <Link to={`/safety/report/${report.id}`} className="flex items-center gap-3 rounded-2xl bg-white/70 p-3 hover:bg-white">
                  <FileSearch className="size-5 text-lilac-deep" />
                  <span className="flex-1">
                    <span className="block font-semibold">{report.subjectName}</span>
                    <span className="text-xs text-ink-soft">{new Date(report.createdAt).toLocaleString()}</span>
                  </span>
                  <span className="rounded-full bg-lilac/40 px-2.5 py-0.5 text-xs font-semibold">{statusLabels[report.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="gloss-card p-5">
        <h2 className="mb-3 text-xl font-semibold">Blocked</h2>
        {blocked.length === 0 ? (
          <p className="text-sm text-ink-soft">You haven’t blocked anyone.</p>
        ) : (
          <ul className="grid gap-2">
            {blocked.map((id) => (
              <li key={id} className="flex items-center gap-3 rounded-2xl bg-white/70 p-2">
                <Avatar src={blockedProfiles[id]?.photos[0]} alt={blockedProfiles[id]?.displayName ?? 'Blocked user'} size={40} />
                <span className="flex-1 font-semibold">{blockedProfiles[id]?.displayName ?? 'Player'}</span>
                <ArcadeButton size="sm" color="white" onClick={() => unblock(id)}>Unblock</ArcadeButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="gloss-card grid gap-3 p-5">
        <h2 className="text-xl font-semibold">Account</h2>
        {user?.email && <p className="text-sm text-ink-soft">Signed in as {user.email}</p>}
        {isDemo && firebaseAvailable && (
          <ArcadeButton color="sky" onClick={leaveDemoMode}>Leave demo mode</ArcadeButton>
        )}
        <ArcadeButton color="white" icon={<LogOut className="size-5" />} onClick={() => backend().signOut()}>Sign out</ArcadeButton>
        <ArcadeButton color="peach" icon={<Trash2 className="size-5" />} onClick={() => setConfirmDelete(true)}>
          {isDemo ? 'Reset demo data' : 'Delete my data'}
        </ArcadeButton>
      </section>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={isDemo ? 'Reset demo data?' : 'Delete your data?'}>
        <p className="text-ink-soft">
          {isDemo
            ? 'This clears your demo profile, matches, chats, and reports from this browser.'
            : 'This deletes your profile, quiz results, and game answers, then signs you out. Messages you sent stay visible to your matches.'}
        </p>
        <div className="mt-6 flex gap-3">
          <ArcadeButton color="white" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancel</ArcadeButton>
          <ArcadeButton color="peach" className="flex-1" loading={busy} onClick={deleteData}>{isDemo ? 'Reset' : 'Delete'}</ArcadeButton>
        </div>
      </Modal>
    </div>
  )
}
