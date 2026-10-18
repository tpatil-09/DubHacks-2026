import { ExternalLink, Hourglass } from 'lucide-react'
import { useScreening } from '../../hooks/data'
import { reportTier, tierStyles, visibleFindings, type SafetyReport } from '../../types/safetyReport'
import { FindingCard, RequiredNotice, toneForTier } from './SafetyParts'

/** Small color-coded result chip for cards and headers. */
export function TierChip({ uid, size = 'sm', variant = 'chip' }: { uid: string; size?: 'sm' | 'md'; variant?: 'chip' | 'badge' }) {
  const screening = useScreening(uid)
  if (screening.status === 'loading') return null
  if (variant === 'badge' && screening.status === 'ready') {
    // White badge over a photo, like a "Verified" label; the icon carries the tier color.
    const tier = reportTier(screening.report)
    const tone = toneForTier(tier)
    const Icon = tone.icon
    return (
      <span className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-bold text-ink shadow-[0_6px_16px_-8px_rgba(35,26,27,.5)]" title={screening.report.tldr?.tier_label}>
        <Icon className={`size-4 ${tone.text}`} strokeWidth={2.5} aria-hidden />
        <span className="sr-only">Background check: </span>
        {tierStyles[tier].short}
      </span>
    )
  }
  if (screening.status !== 'ready') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
        <Hourglass className="size-3.5" aria-hidden /> Check in progress
      </span>
    )
  }
  const tier = reportTier(screening.report)
  const tone = toneForTier(tier)
  const Icon = tone.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-2 ${tone.border} ${tone.surface} ${size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'} font-semibold`}
      title={screening.report.tldr?.tier_label}
    >
      <Icon className={`${size === 'md' ? 'size-4' : 'size-3.5'} ${tone.text}`} aria-hidden />
      <span className="sr-only">Background check: </span>
      {tierStyles[tier].short}
    </span>
  )
}

function TldrCard({ report }: { report: SafetyReport }) {
  const tier = reportTier(report)
  const tone = toneForTier(tier)
  const Icon = tone.icon
  const byId = new Map(report.findings.map((f) => [f.finding_id, f]))
  const tldr = report.tldr
  return (
    <div className={`rounded-3xl border-[3px] ${tone.border} ${tone.surface} p-5`}>
      <div className="flex items-center gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-full bg-white ${tone.text}`}>
          <Icon className="size-6" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">TLDR</p>
          <p className="font-display text-xl font-semibold leading-tight">{tier === 'unresolved_allegations_or_charges' ? 'Flagged results to check, nothing confirmed' : (tldr?.tier_label ?? tierStyles[tier].short)}</p>
        </div>
      </div>
      <p className="mt-3 text-lg">{tldr?.headline ?? report.summary}</p>
      {tldr && tldr.key_points.length > 0 && (
        <ul className="mt-3 grid gap-1.5">
          {tldr.key_points.map((point) => (
            <li key={point.text} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className={`mt-1.5 size-2 shrink-0 self-start rounded-full ${tone.dot}`} aria-hidden />
              <span className="flex-1">{point.text}</span>
              {point.finding_ids.map((id) => {
                const f = byId.get(id)
                return f ? (
                  <a key={id} href={f.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-lilac-deep hover:underline">
                    source <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null
              })}
            </li>
          ))}
        </ul>
      )}
      {tldr && tldr.caveats.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tldr.caveats.map((c) => (
            <span key={c} className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs text-ink-soft">{c}</span>
          ))}
        </div>
      )}
    </div>
  )
}

/** The full inline background check for a member, fed by the background_check pipeline's report.json. */
export function BackgroundCheck({ uid, name, self = false }: { uid: string; name: string; self?: boolean }) {
  const screening = useScreening(uid)
  return (
    <section id="background-check" aria-labelledby="background-check-title" className="grid scroll-mt-24 gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="background-check-title" className="text-2xl font-bold">Background check</h2>
        <p className="text-sm text-ink-soft">{self ? 'What other members see on your profile' : `Public records checked for ${name}`}</p>
      </div>
      {screening.status === 'loading' && <div className="h-40 animate-pulse rounded-3xl bg-white/60" aria-label="Loading background check" />}
      {screening.status === 'pending' && (
        <div className="flex items-center gap-3 rounded-3xl border-[3px] border-gray-300 bg-gray-100 p-5">
          <Hourglass className="size-6 text-ink-soft" aria-hidden />
          <p>The background check for {name} is still running. Check back soon.</p>
        </div>
      )}
      {screening.status === 'error' && (
        <p role="alert" className="rounded-3xl bg-peach/30 p-5">The background check couldn’t be shown ({screening.error}).</p>
      )}
      {screening.status === 'ready' && <ReportBody report={screening.report} />}
    </section>
  )
}

function ReportBody({ report }: { report: SafetyReport }) {
  const { verified, unresolved, unlinkedCount } = visibleFindings(report)
  return (
    <>
      <TldrCard report={report} />

      {verified.length > 0 && (
        <div className="grid gap-2.5">
          <h3 className="text-lg font-semibold">Verified <span className="text-sm font-normal text-ink-soft">· confirmed by the sources linked</span></h3>
          {verified.map((f) => <FindingCard key={f.finding_id} finding={f} />)}
        </div>
      )}

      {unresolved.length > 0 && (
        <div className="grid gap-2.5">
          <h3 className="text-lg font-semibold">Unresolved <span className="text-sm font-normal text-ink-soft">· found, but not confirmed</span></h3>
          {unresolved.map((f) => <FindingCard key={f.finding_id} finding={f} />)}
        </div>
      )}

      {unlinkedCount > 0 && (
        <p className="rounded-2xl bg-white/70 p-3 text-sm text-ink-soft">
          {unlinkedCount} record{unlinkedCount === 1 ? '' : 's'} under the same name couldn’t be linked to this person, so {unlinkedCount === 1 ? 'it isn’t' : 'they aren’t'} shown.
        </p>
      )}

      <footer className="grid gap-2 text-sm">
        <div className="flex flex-wrap gap-1.5">
          {report.is_synthetic && <span className="rounded-full bg-lilac/40 px-2.5 py-0.5 text-xs font-semibold">🧪 Synthetic demo data</span>}
          {!report.scope.search_completed && <span className="rounded-full bg-butter/70 px-2.5 py-0.5 text-xs font-semibold">Search incomplete</span>}
          <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs text-ink-soft">
            {report.scope.sources_searched.length} source{report.scope.sources_searched.length === 1 ? '' : 's'} checked
            {report.scope.sources_not_accessible.length > 0 && ` · ${report.scope.sources_not_accessible.length} couldn’t be reached`}
          </span>
          <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs text-ink-soft">Checked {new Date(report.generated_at).toLocaleDateString()}</span>
        </div>
        <RequiredNotice compact />
      </footer>
    </>
  )
}
