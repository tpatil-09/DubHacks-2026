import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { LogOut, Trash2 } from 'lucide-react'
import { ArcadeButton } from '../components/ui/ArcadeButton'
import { Avatar } from '../components/ui/ProfilePhoto'
import { Modal } from '../components/ui/Modal'
import { backend, firebaseAvailable, leaveDemoMode } from '../data'
import { useProfiles } from '../hooks/data'
import { useSession } from '../store/session'
import { toast } from '../store/toast'

export default function Settings() {
  const navigate = useNavigate()
  const { user, account, saveAccount, saveProfile } = useSession()
  const uid = user?.uid
  const [blocked, setBlocked] = useState<string[]>([])
  const blockedProfiles = useProfiles(blocked)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const isDemo = backend().kind === 'demo'

  useEffect(() => {
    if (!uid) return
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
    <div className="grid max-w-3xl gap-5 pb-10">
      <div className="mb-4"><span className="eyebrow">Account</span><h1 className="mt-4 text-[2.6rem] sm:text-6xl">Privacy & settings.</h1></div>

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
