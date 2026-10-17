import { useState } from 'react'
import { motion } from 'motion/react'
import { Check, ChevronDown, ExternalLink, FileSearch, Info, ScanSearch, ShieldCheck } from 'lucide-react'
import {
  REQUIRED_NOTICE,
  caseStatusLabels,
  identityLabels,
  type CaseStatus,
  type Finding,
  type IdentityAssessment,
} from '../../types/safetyReport'
import type { ReportStatus } from '../../types'

const toneClasses = {
  lilac: 'bg-lilac/50 border-lilac',
  butter: 'bg-butter/70 border-butter-deep/40',
  sky: 'bg-sky/50 border-sky-deep/40',
  gray: 'bg-gray-100 border-gray-300',
  peach: 'bg-peach/40 border-peach-deep/40',
  mint: 'bg-mint/40 border-mint-deep/40',
}

export function RequiredNotice() {
  return (
    <div role="note" className="flex gap-3 rounded-2xl border border-lilac/60 bg-white/80 p-4 text-sm leading-relaxed">
      <Info className="mt-0.5 size-5 shrink-0 text-lilac-deep" aria-hidden />
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

export function FindingCard({ finding, index }: { finding: Finding; index: number }) {
  const [open, setOpen] = useState(index === 0)
  return (
    <article className="frost overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3 p-4 text-left">
        <FileSearch className="mt-0.5 size-5 shrink-0 text-lilac-deep" aria-hidden />
        <span className="flex-1">
          <span className="block font-medium">{finding.description}</span>
          <span className="mt-2 flex flex-wrap gap-1.5">
            <StatusPill kind="identity" value={finding.identity_assessment} />
            <StatusPill kind="case" value={finding.case_status} />
          </span>
        </span>
        <ChevronDown className={`size-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="grid gap-3 border-t border-white px-4 pb-4 pt-3 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-ink-soft">Record type</dt>
            <dd>{finding.record_type.replace(/_/g, ' ')}</dd>
            <dt className="text-ink-soft">Date</dt>
            <dd>{finding.event_date ?? 'Unknown'}</dd>
            <dt className="text-ink-soft">Jurisdiction</dt>
            <dd>{finding.jurisdiction ?? 'Unknown'}</dd>
            <dt className="text-ink-soft">Source type</dt>
            <dd>{finding.source_type.replace(/_/g, ' ')}</dd>
            <dt className="text-ink-soft">Retrieved</dt>
            <dd>{new Date(finding.retrieved_at).toLocaleString()}</dd>
          </dl>
          <div>
            <p className="font-semibold">Why this identity assessment</p>
            <p className="text-ink-soft">{finding.identity_rationale}</p>
          </div>
          {finding.supporting_excerpt && (
            <blockquote className="rounded-xl border-l-4 border-lilac bg-white/70 px-3 py-2 italic">“{finding.supporting_excerpt}”</blockquote>
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
          <a href={finding.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-lilac-deep underline-offset-2 hover:underline">
            {finding.source_title} <ExternalLink className="size-4" aria-hidden />
          </a>
        </div>
      )}
    </article>
  )
}

const pipeline: { status: ReportStatus; label: string; detail: string; icon: typeof ScanSearch }[] = [
  { status: 'searching', label: 'Searcher', detail: 'Looking through configured public sources', icon: ScanSearch },
  { status: 'verifying', label: 'Verifier', detail: 'Checking identity matches and case status', icon: ShieldCheck },
  { status: 'analyzing', label: 'Analyzer', detail: 'Writing a neutral, source-linked summary', icon: FileSearch },
]

const order: ReportStatus[] = ['queued', 'searching', 'verifying', 'analyzing', 'complete']

export function ProgressTracker({ status }: { status: ReportStatus }) {
  const current = order.indexOf(status)
  return (
    <ol className="grid gap-3" aria-label="Report progress">
      {pipeline.map((step) => {
        const position = order.indexOf(step.status)
        const done = current > position
        const active = current === position
        const Icon = step.icon
        return (
          <li key={step.status} className={`frost flex items-center gap-4 p-4 transition ${active ? 'ring-2 ring-lilac' : ''} ${!done && !active ? 'opacity-60' : ''}`}>
            <span className={`grid size-11 place-items-center rounded-full ${done ? 'bg-mint/60' : active ? 'bg-lilac/60' : 'bg-white'}`}>
              {done ? (
                <Check className="size-5" aria-hidden />
              ) : (
                <motion.span animate={active ? { rotate: [0, 10, -10, 0] } : undefined} transition={{ repeat: Infinity, duration: 1.4 }}>
                  <Icon className="size-5" aria-hidden />
                </motion.span>
              )}
            </span>
            <span>
              <span className="block font-semibold">{step.label}</span>
              <span className="text-sm text-ink-soft">{step.detail}</span>
            </span>
            <span className="ml-auto text-xs font-semibold text-ink-soft">{done ? 'Done' : active ? 'Working…' : 'Waiting'}</span>
          </li>
        )
      })}
    </ol>
  )
}
