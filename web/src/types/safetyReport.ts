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
  // Optional fields produced by background_check (see claude.md section 7).
  evidence_status: z.enum(['verified', 'unverified', 'inconclusive']).optional(),
  why_unresolved: z.string().nullable().optional(),
  historical_report_only: z.boolean().optional(),
})

export const recordTiers = [
  'verified_record_requires_attention',
  'reported_conviction_unconfirmed',
  'unresolved_allegations_or_charges',
  'cleared_outcomes_only',
  'no_linked_records',
  'insufficient_information',
] as const

export const tldrSchema = z.object({
  record_tier: z.enum(recordTiers),
  tier_label: z.string(),
  headline: z.string(),
  key_points: z.array(z.object({ text: z.string(), finding_ids: z.array(z.string()) })),
  caveats: z.array(z.string()),
})

export const safetyReportSchema = z.object({
  /** The background check's summary: a rule-based tier plus a plain-language headline. */
  tldr: tldrSchema.optional(),
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
export type RecordTier = (typeof recordTiers)[number]
export type Finding = z.infer<typeof findingSchema>
export type SafetyReport = z.infer<typeof safetyReportSchema>
export type Tldr = z.infer<typeof tldrSchema>

/** Color coding for each record tier. Labels describe the evidence, never the person ("safe" is never used). */
export const tierStyles: Record<RecordTier, { short: string; tone: 'red' | 'orange' | 'amber' | 'green' | 'gray' }> = {
  verified_record_requires_attention: { short: 'Record needs attention', tone: 'red' },
  reported_conviction_unconfirmed: { short: 'Past record reported', tone: 'orange' },
  // Nothing here is confirmed, so the label must not suggest the person has done anything.
  unresolved_allegations_or_charges: { short: 'Check flagged results', tone: 'amber' },
  cleared_outcomes_only: { short: 'Cleared', tone: 'green' },
  no_linked_records: { short: 'No records linked', tone: 'green' },
  insufficient_information: { short: 'Not enough info', tone: 'gray' },
}

/** Findings shown to viewers: verified or unresolved, and plausibly about this person. */
export function visibleFindings(report: SafetyReport) {
  const linked = report.findings.filter((f) => f.identity_assessment === 'strong_match' || f.identity_assessment === 'possible_match')
  const verified = linked.filter((f) => (f.evidence_status ?? 'unverified') === 'verified')
  const unresolved = linked.filter((f) => (f.evidence_status ?? 'unverified') !== 'verified')
  const unlinkedCount = report.findings.length - linked.length
  return { verified, unresolved, unlinkedCount }
}

/** Reports without a pipeline TLDR (older fixtures) fall back to a cautious tier. */
export function reportTier(report: SafetyReport): RecordTier {
  if (report.tldr) return report.tldr.record_tier
  if (!report.scope.search_completed) return 'insufficient_information'
  return visibleFindings(report).verified.length || visibleFindings(report).unresolved.length
    ? 'unresolved_allegations_or_charges'
    : 'no_linked_records'
}

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
