import { useState } from 'react'
import { ChevronDown, CircleDashed, ExternalLink, History, Info, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react'
import {
  REQUIRED_NOTICE,
  caseStatusLabels,
  identityLabels,
  tierStyles,
  type CaseStatus,
  type Finding,
  type IdentityAssessment,
  type RecordTier,
} from '../../types/safetyReport'

const toneClasses = {
  lilac: 'bg-lilac/50 border-lilac',
  butter: 'bg-butter/70 border-butter-deep/40',
  sky: 'bg-sky/50 border-sky-deep/40',
  gray: 'bg-gray-100 border-gray-300',
  peach: 'bg-peach/40 border-peach-deep/40',
  mint: 'bg-mint/40 border-mint-deep/40',
}

/** Tier color coding: surface, border, and icon color per result tone. */
export const tierTone = {
  red: { surface: 'bg-coral/20', border: 'border-coral-deep', text: 'text-coral-deep', dot: 'bg-coral-deep', icon: ShieldAlert },
  orange: { surface: 'bg-peach/30', border: 'border-peach-deep', text: 'text-peach-deep', dot: 'bg-peach-deep', icon: History },
  amber: { surface: 'bg-butter/50', border: 'border-butter-deep', text: 'text-ink', dot: 'bg-butter-deep', icon: TriangleAlert },
  green: { surface: 'bg-mint/30', border: 'border-mint-deep', text: 'text-mint-deep', dot: 'bg-mint-deep', icon: ShieldCheck },
  gray: { surface: 'bg-gray-100', border: 'border-gray-300', text: 'text-ink-soft', dot: 'bg-gray-400', icon: CircleDashed },
} as const

export function toneForTier(tier: RecordTier) {
  return tierTone[tierStyles[tier].tone]
}

/** Border color for a single finding, from its case status. */
const caseBorder: Record<CaseStatus, string> = {
  conviction: 'border-coral-deep',
  guilty_plea: 'border-coral-deep',
  charge_pending: 'border-butter-deep',
  allegation_only: 'border-butter-deep',
  civil_finding: 'border-butter-deep',
  acquitted: 'border-mint-deep',
  dismissed: 'border-mint-deep',
  unknown: 'border-gray-300',
  not_applicable: 'border-gray-300',
}

export function RequiredNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div role="note" className={`flex gap-2 rounded-2xl ${compact ? 'p-0 text-xs text-ink-soft' : 'border border-lilac/60 bg-white/80 p-4 text-sm'} leading-relaxed`}>
      <Info className={`${compact ? 'size-4' : 'mt-0.5 size-5 text-lilac-deep'} shrink-0`} aria-hidden />
      <p>{REQUIRED_NOTICE}</p>
    </div>
  )
}

export function StatusPill({ kind, value }: { kind: 'identity'; value: IdentityAssessment } | { kind: 'case'; value: CaseStatus }) {
  const entry = kind === 'identity' ? identityLabels[value] : caseStatusLabels[value]
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClasses[entry.tone]}`}>
      {entry.label}
    </span>
  )
}

export function SourceLink({ href, title }: { href: string; title: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-semibold text-lilac-deep shadow-sm hover:underline"
    >
      Check the source: {title} <ExternalLink className="size-4 shrink-0" aria-hidden />
    </a>
  )
}

/**
 * One finding. Verified findings get a solid border colored by case status; unresolved ones get a
 * dashed border and lead with why they are unresolved.
 */
export function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false)
  const verified = (finding.evidence_status ?? 'unverified') === 'verified'
  const why = verified ? null : finding.why_unresolved
  const description = why && finding.description.startsWith(why) ? finding.description.slice(why.length).trim() : finding.description
  return (
    <article className={`rounded-2xl border-2 bg-white/85 p-4 ${verified ? 'border-solid' : 'border-dashed'} ${caseBorder[finding.case_status]}`}>
      {why && <p className="mb-1.5 font-semibold">{why}</p>}
      <p>{description}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <StatusPill kind="case" value={finding.case_status} />
        <StatusPill kind="identity" value={finding.identity_assessment} />
        {finding.historical_report_only && (
          <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold">News report only</span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SourceLink href={finding.source_url} title={finding.source_title} />
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
          Details <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      </div>
      {open && (
        <div className="mt-3 grid gap-3 border-t border-gray-200 pt-3 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-ink-soft">Date</dt>
            <dd>{finding.event_date ?? 'Unknown'}</dd>
            <dt className="text-ink-soft">Jurisdiction</dt>
            <dd>{finding.jurisdiction ?? 'Unknown'}</dd>
            <dt className="text-ink-soft">Source type</dt>
            <dd>{finding.source_type.replace(/_/g, ' ')}</dd>
            <dt className="text-ink-soft">Retrieved</dt>
            <dd>{new Date(finding.retrieved_at).toLocaleDateString()}</dd>
          </dl>
          {!why && finding.identity_rationale && (
            <div>
              <p className="font-semibold">Why we think it’s this person</p>
              <p className="text-ink-soft">{finding.identity_rationale}</p>
            </div>
          )}
          {finding.supporting_excerpt && (
            <blockquote className="rounded-xl border-l-4 border-lilac bg-white px-3 py-2 italic">“{finding.supporting_excerpt}”</blockquote>
          )}
          {finding.conflicts.length > 0 && (
            <div>
              <p className="font-semibold">Conflicting details</p>
              <ul className="list-disc pl-5 text-ink-soft">{finding.conflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}</ul>
            </div>
          )}
          {finding.limitations.length > 0 && (
            <div>
              <p className="font-semibold">Limitations</p>
              <ul className="list-disc pl-5 text-ink-soft">{finding.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
