import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { AlertTriangle, ChevronLeft } from 'lucide-react'
import { FindingCard, ProgressTracker, RequiredNotice } from '../../components/safety/SafetyParts'
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States'
import { backend } from '../../data'
import { useReportRequest } from '../../hooks/data'
import { emptyResultsMessage, parseSafetyReport, type SafetyReport } from '../../types/safetyReport'

const nextSteps = [
  'Check original records yourself on the official court or registry website for the relevant county or state.',
  'Remember that names are shared by many people. Confirm details like age and location before drawing conclusions.',
  'Meet in a public place, tell a friend your plans, and trust your instincts.',
]

export default function ReportResults() {
  const { requestId = '' } = useParams()
  const { request, loading } = useReportRequest(requestId)
  const [report, setReport] = useState<SafetyReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const finished = request?.status === 'complete' || request?.status === 'incomplete'

  useEffect(() => {
    if (!finished) return
    let active = true
    backend()
      .getSafetyReport(requestId)
      .then((raw) => {
        if (!active) return
        const parsed = parseSafetyReport(raw)
        if (parsed.ok) setReport(parsed.report)
        else setError(`The report didn’t match the expected format (${parsed.error}), so it isn’t shown.`)
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : 'Could not load the report.'))
    return () => {
      active = false
    }
  }, [finished, requestId])

  if (loading) return <PageLoader label="Opening report…" />
  if (!request) {
    return <EmptyState title="Report not found" body="Reports are private to the person who requested them." mood="calm" />
  }

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <Link to="/settings" className="mb-3 flex w-fit items-center gap-1 font-semibold text-ink-soft hover:text-ink">
        <ChevronLeft className="size-5" /> My reports
      </Link>
      <header className="mb-4">
        <h1 className="font-sans text-3xl font-bold">Safety report</h1>
        <p className="text-ink-soft">
          For “{request.subjectName}”{request.context ? ` · ${request.context}` : ''} · requested {new Date(request.createdAt).toLocaleString()}
        </p>
      </header>

      <div className="grid gap-5">
        <RequiredNotice />

        {request.status === 'failed' ? (
          <ErrorState title="The report couldn’t be completed" body={request.error ?? 'Something went wrong while searching.'} />
        ) : !finished ? (
          <section className="grid gap-3">
            <h2 className="font-sans text-lg font-semibold">Working on it…</h2>
            <ProgressTracker status={request.status} />
          </section>
        ) : error ? (
          <ErrorState title="Report unavailable" body={error} />
        ) : !report ? (
          <PageLoader label="Loading report…" />
        ) : (
          <ReportBody report={report} />
        )}
      </div>
    </div>
  )
}

function ReportBody({ report }: { report: SafetyReport }) {
  const empty = emptyResultsMessage(report)
  const incomplete = !report.scope.search_completed || report.errors.length > 0
  return (
    <>
      {report.is_synthetic && (
        <p className="rounded-2xl border-2 border-dashed border-butter-deep bg-butter/50 px-4 py-2 text-center text-sm font-semibold">
          🧪 Synthetic demo data — not a real person or real records
        </p>
      )}

      {incomplete && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-butter-deep/50 bg-butter/50 p-4 text-sm">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">This report is incomplete.</p>
            {report.errors.length > 0 && <ul className="mt-1 list-disc pl-5">{report.errors.map((entry) => <li key={entry}>{entry}</li>)}</ul>}
          </div>
        </div>
      )}

      <section className="frost p-5">
        <h2 className="font-sans text-lg font-semibold">Summary</h2>
        <p className="mt-1">{report.summary}</p>
        {report.human_review_required && <p className="mt-2 text-sm text-ink-soft">Findings should be checked against the original sources before drawing conclusions.</p>}
      </section>

      <section className="frost grid gap-2 p-5 text-sm">
        <h2 className="font-sans text-lg font-semibold">Search coverage</h2>
        <p><span className="font-semibold">Searched:</span> {report.scope.sources_searched.length ? report.scope.sources_searched.join(', ') : 'None'}</p>
        {report.scope.sources_not_accessible.length > 0 && (
          <p><span className="font-semibold">Not accessible:</span> {report.scope.sources_not_accessible.join(', ')}</p>
        )}
        <p><span className="font-semibold">Search completed:</span> {report.scope.search_completed ? 'Yes' : 'No'}</p>
      </section>

      <section className="grid gap-3">
        <h2 className="font-sans text-lg font-semibold">Findings ({report.findings.length})</h2>
        {empty ? <p className="frost p-5">{empty}</p> : report.findings.map((finding, index) => <FindingCard key={finding.finding_id} finding={finding} index={index} />)}
      </section>

      <section className="frost p-5 text-sm">
        <h2 className="font-sans text-lg font-semibold">Limitations</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5">{report.limitations.map((entry) => <li key={entry}>{entry}</li>)}</ul>
      </section>

      <section className="frost p-5 text-sm">
        <h2 className="font-sans text-lg font-semibold">Suggested next steps</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5">{nextSteps.map((entry) => <li key={entry}>{entry}</li>)}</ul>
      </section>

      <p className="text-center text-xs text-ink-soft">Report {report.report_id} · schema v{report.schema_version} · generated {new Date(report.generated_at).toLocaleString()}</p>
    </>
  )
}
