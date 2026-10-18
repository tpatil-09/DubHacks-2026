import { z } from 'zod'

// Mirrors the report.json shape in claude.md section 7. Keep in sync with the
// screening team's schema; the UI renders only what passes this validation.

export const identityAssessments = ['strong_match', 'possible_match', 'weak_match', 'unresolved'] as const

export const caseStatuses = [
  'conviction',
  'guilty_plea',
  'charge_pending',
  'acquitted',
  'dismissed',
  'allegation_only',
  'civil_finding',
  'unknown',
  'not_applicable',
] as const

const isoTimestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid ISO-8601 timestamp')

export const findingSchema = z.object({
  finding_id: z.string(),
  description: z.string(),
  record_type: z.string(),
  case_status: z.enum(caseStatuses),
  identity_assessment: z.enum(identityAssessments),
  identity_rationale: z.string(),
  event_date: z.string().nullable(),
  jurisdiction: z.string().nullable(),
  source_url: z.string().url(),
  source_title: z.string(),
  source_type: z.string(),
  retrieved_at: isoTimestamp,
  supporting_excerpt: z.string().nullable().optional(),
  conflicts: z.array(z.string()),
  limitations: z.array(z.string()),
})

export const safetyReportSchema = z.object({
  schema_version: z.string(),
  report_id: z.string(),
  generated_at: isoTimestamp,
  /** Set on demo fixtures so the UI can label them as synthetic. */
  is_synthetic: z.boolean().optional(),
  subject: z.object({
    name_provided: z.string(),
    context_provided: z.string().nullable().optional(),
  }),
  scope: z.object({
    sources_searched: z.array(z.string()),
    sources_not_accessible: z.array(z.string()),
    search_completed: z.boolean(),
  }),
  summary: z.string(),
  findings: z.array(findingSchema),
  limitations: z.array(z.string()),
  errors: z.array(z.string()),
  human_review_required: z.boolean(),
})

export type IdentityAssessment = (typeof identityAssessments)[number]
export type CaseStatus = (typeof caseStatuses)[number]
export type Finding = z.infer<typeof findingSchema>
export type SafetyReport = z.infer<typeof safetyReportSchema>

export type ParsedReport = { ok: true; report: SafetyReport } | { ok: false; error: string }

export function parseSafetyReport(raw: unknown): ParsedReport {
  const result = safetyReportSchema.safeParse(raw)
  if (result.success) return { ok: true, report: result.data }
  const first = result.error.issues[0]
  return { ok: false, error: first ? `${first.path.join('.') || 'report'}: ${first.message}` : 'Invalid report' }
}

export const REQUIRED_NOTICE =
  'SafeMatch provides a limited summary of accessible public sources. Information may be incomplete or inaccurate, and identity may be uncertain. This is not a formal criminal-history check and cannot guarantee personal safety.'

type Tone = 'lilac' | 'butter' | 'sky' | 'gray' | 'peach' | 'mint'

export const identityLabels: Record<IdentityAssessment, { label: string; tone: Tone }> = {
  strong_match: { label: 'Strong identity match', tone: 'lilac' },
  possible_match: { label: 'Possible match', tone: 'butter' },
  weak_match: { label: 'Weak match', tone: 'sky' },
  unresolved: { label: 'Identity unresolved', tone: 'gray' },
}

export const caseStatusLabels: Record<CaseStatus, { label: string; tone: Tone }> = {
  conviction: { label: 'Conviction', tone: 'peach' },
  guilty_plea: { label: 'Guilty plea', tone: 'peach' },
  charge_pending: { label: 'Charge pending (not a conviction)', tone: 'butter' },
  acquitted: { label: 'Acquitted', tone: 'mint' },
  dismissed: { label: 'Dismissed', tone: 'mint' },
  allegation_only: { label: 'Allegation only', tone: 'sky' },
  civil_finding: { label: 'Civil finding', tone: 'sky' },
  unknown: { label: 'Status unknown', tone: 'gray' },
  not_applicable: { label: 'Not applicable', tone: 'gray' },
}

export function emptyResultsMessage(report: SafetyReport): string | null {
  if (report.findings.length > 0) return null
  return report.scope.search_completed
    ? 'No matching records were found in the sources searched. This does not mean no records exist.'
    : 'The search did not complete, so no conclusions can be drawn. This does not mean no records exist.'
}
