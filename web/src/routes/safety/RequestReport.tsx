import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { ArcadeButton } from '../../components/ui/ArcadeButton'
import { Avatar } from '../../components/ui/ProfilePhoto'
import { PageLoader } from '../../components/ui/States'
import { RequiredNotice } from '../../components/safety/SafetyParts'
import { backend } from '../../data'
import { useProfile } from '../../hooks/data'
import { useSession } from '../../store/session'

export default function RequestReport() {
  const { uid: subjectUid = '' } = useParams()
  const navigate = useNavigate()
  const uid = useSession((state) => state.user?.uid)
  const { profile, loading } = useProfile(subjectUid)
  const [name, setName] = useState('')
  const [context, setContext] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile) {
      setName(profile.displayName)
      setContext(profile.city)
    }
  }, [profile])

  if (loading) return <PageLoader />

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!uid) return
    if (!name.trim()) return setError('Enter the name to search.')
    if (!confirmed) return setError('Please confirm you understand the limits of this report.')
    setBusy(true)
    setError('')
    try {
      const requestId = await backend().requestSafetyReport(uid, {
        subjectUid: profile?.uid,
        subjectName: name.trim(),
        context: context.trim() || undefined,
        confirmedScope: true,
      })
      navigate(`/safety/report/${requestId}`, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the report.')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl pb-10">
      <button type="button" onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 font-semibold text-ink-soft hover:text-ink">
        <ChevronLeft className="size-5" /> Back
      </button>
      <div className="frost grid gap-5 p-6">
        <div className="flex items-center gap-3">
          {profile && <Avatar src={profile.photos[0]} alt={profile.displayName} size={52} />}
          <div>
            <h1 className="font-sans text-2xl font-bold">Request a safety report</h1>
            <p className="text-sm text-ink-soft">Private to you. {profile?.displayName ?? 'This person'} is never notified.</p>
          </div>
        </div>

        <section className="grid gap-2 text-sm leading-relaxed">
          <h2 className="font-sans text-base font-semibold">What this does</h2>
          <ul className="list-disc space-y-1 pl-5 text-ink-soft">
            <li>Searches only the public sources that are configured and accessible, and lists exactly which ones.</li>
            <li>Results may be about a <strong>different person with the same name</strong>. Each finding shows how strong the identity match is.</li>
            <li>A charge or allegation is not a conviction. Each finding shows its case status and a link to the source.</li>
            <li>No results does not mean no records exist.</li>
          </ul>
        </section>

        <RequiredNotice />

        <form onSubmit={submit} className="grid gap-4">
          <div>
            <label htmlFor="subject-name" className="mb-1 block text-sm font-semibold">Name to search</label>
            <input id="subject-name" className="input-arcade" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label htmlFor="subject-context" className="mb-1 block text-sm font-semibold">
              Broad location <span className="font-normal text-ink-soft">(optional, city or state — helps tell people apart)</span>
            </label>
            <input id="subject-context" className="input-arcade" value={context} maxLength={80} onChange={(event) => setContext(event.target.value)} />
          </div>
          <label className="flex items-start gap-3 rounded-2xl bg-white/70 p-3 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 size-5 accent-lilac-deep" />
            <span>I understand this is a limited summary of public sources, may be incomplete or about someone else, and is not a formal background check.</span>
          </label>
          {error && <p role="alert" className="rounded-2xl bg-peach/40 p-3 text-sm">{error}</p>}
          <ArcadeButton type="submit" color="lilac" size="lg" loading={busy} disabled={!confirmed}>
            Run report
          </ArcadeButton>
        </form>
      </div>
    </div>
  )
}
