import type { Finding, RecordTier, SafetyReport } from '../types/safetyReport'
import { REQUIRED_NOTICE } from '../types/safetyReport'

// SYNTHETIC TEST DATA. Pre-built background checks for fictional demo profiles only, in the
// same report.json shape the background_check pipeline produces. All sources point at
// example.com and every report sets is_synthetic: true.

interface ReportArgs {
  subjectUid?: string
  nameProvided: string
  context?: string
  now?: Date
}

const tierLabels: Record<RecordTier, string> = {
  verified_record_requires_attention: 'Verified record requiring attention',
  reported_conviction_unconfirmed: 'Conviction or registration reported, not confirmed on an official record',
  unresolved_allegations_or_charges: 'Flagged results to check, nothing confirmed',
  cleared_outcomes_only: 'Flagged results to check — charges were dismissed, acquitted, or exonerated',
  no_linked_records: 'No records linked to this person in the search scope',
  insufficient_information: 'Not enough information: key sources could not be checked',
}

const demoSources = [
  'https://example.com/synthetic/county-court-portal',
  'https://example.com/synthetic/state-registry',
  'https://example.com/synthetic/news-archive',
]

function report(
  args: ReportArgs,
  tier: RecordTier,
  headline: string,
  findings: Finding[],
  extra: Partial<Pick<SafetyReport, 'scope' | 'errors'>> & { caveats?: string[]; keyPoints?: { text: string; finding_ids: string[] }[] } = {},
): SafetyReport {
  const limitations = [REQUIRED_NOTICE, 'This report was generated from synthetic demo data. No live sources were searched.']
  return {
    tldr: {
      record_tier: tier,
      tier_label: tierLabels[tier],
      headline,
      key_points: extra.keyPoints ?? [],
      caveats: [...(extra.caveats ?? []), 'Public-source research only; not a certified background check.'],
    },
    schema_version: '1.0',
    report_id: `demo-screening-${args.subjectUid ?? 'unknown'}`,
    generated_at: (args.now ?? new Date('2026-10-01T12:00:00Z')).toISOString(),
    is_synthetic: true,
    subject: { name_provided: args.nameProvided, context_provided: args.context ?? null },
    scope: extra.scope ?? { sources_searched: demoSources, sources_not_accessible: [], search_completed: true },
    summary: `${tierLabels[tier]}. ${headline}`,
    findings,
    limitations,
    errors: extra.errors ?? [],
    human_review_required: true,
  }
}

function finding(id: string, fields: Partial<Finding> & Pick<Finding, 'description' | 'case_status' | 'identity_assessment' | 'source_title'>): Finding {
  return {
    finding_id: id,
    record_type: 'criminal_case',
    identity_rationale: fields.why_unresolved ?? 'Name, city and age range match the profile.',
    event_date: null,
    jurisdiction: null,
    source_url: `https://example.com/synthetic/${id}`,
    source_type: 'news_report',
    retrieved_at: '2026-10-01T12:00:00Z',
    supporting_excerpt: null,
    conflicts: [],
    limitations: [],
    evidence_status: 'verified',
    why_unresolved: null,
    historical_report_only: false,
    ...fields,
  }
}

function noRecords(args: ReportArgs): SafetyReport {
  return report(args, 'no_linked_records', 'No records linked to this person were found in the sources searched.', [])
}

function sameNameOnly(args: ReportArgs): SafetyReport {
  const other = (id: string, where: string) =>
    finding(id, {
      description: `A synthetic news report about a different person with the same first and last name in ${where}.`,
      case_status: 'charge_pending',
      identity_assessment: 'weak_match',
      source_title: `Example Gazette — ${where} (synthetic)`,
      evidence_status: 'unverified',
      why_unresolved: 'The match is by name only, so it may be a different person.',
    })
  return report(
    args,
    'no_linked_records',
    'No records linked to this person were found. Two records under the same name could not be linked to them.',
    [other('demo-river-1', 'Ohio'), other('demo-river-2', 'Texas')],
    { caveats: ['2 finding(s) could not be reliably linked to this person.'] },
  )
}

function cleared(args: ReportArgs): SafetyReport {
  const f = finding('demo-maya-1', {
    description: 'A synthetic county court record shows a 2021 misdemeanor assault charge that was dismissed. A dismissal is not a finding of guilt.',
    case_status: 'dismissed',
    identity_assessment: 'possible_match',
    source_title: 'Example County court portal — case 21-0042 (synthetic)',
    source_type: 'official_record',
    event_date: '2021-06-02',
    jurisdiction: 'Example County, WA (synthetic)',
    supporting_excerpt: 'Disposition: Dismissed. (synthetic excerpt)',
    identity_rationale: 'Name and city match; the record gives no age to confirm.',
  })
  return report(args, 'cleared_outcomes_only',
    'A 2021 charge was found, and it was dismissed. No standing conviction was found.', [f],
    { keyPoints: [{ text: 'A 2021 misdemeanor charge was dismissed by the court.', finding_ids: [f.finding_id] }] })
}

function openAllegation(args: ReportArgs): SafetyReport {
  const f = finding('demo-leo-1', {
    description: 'A synthetic local news article reports that a man with this name was accused of harassment in 2024. No charge or court outcome was found.',
    case_status: 'allegation_only',
    identity_assessment: 'possible_match',
    source_title: 'Example Eastside News (synthetic)',
    event_date: '2024-03-11',
    evidence_status: 'unverified',
    why_unresolved: 'It was not confirmed on an official court or registry record, and only some identifiers match, so it may be a different person.',
  })
  return report(args, 'unresolved_allegations_or_charges',
    'A news report describes a 2024 harassment allegation. No charge or outcome was confirmed, and it may be a different person.', [f],
    { keyPoints: [{ text: 'A 2024 allegation was reported by local news; no charge was found.', finding_ids: [f.finding_id] }] })
}

function reportedConviction(args: ReportArgs): SafetyReport {
  const f = finding('demo-kai-1', {
    description: 'A synthetic 2015 news article reports a DUI-related assault conviction for a man with this name.',
    case_status: 'conviction',
    identity_assessment: 'possible_match',
    source_title: 'Example Herald archive, 2015 (synthetic)',
    event_date: '2015-08-20',
    jurisdiction: 'Example County, WA (synthetic)',
    evidence_status: 'unverified',
    historical_report_only: true,
    why_unresolved: 'Current official status was not confirmed, and only some identifiers match, so it may be a different person.',
    limitations: ['Reported by news only; current official status was not confirmed.'],
  })
  return report(args, 'reported_conviction_unconfirmed',
    'A 2015 news report describes a past conviction, but it was not confirmed on an official record.', [f],
    { keyPoints: [{ text: 'A past conviction was reported in 2015; no court record confirmed it.', finding_ids: [f.finding_id] }] })
}

function incomplete(args: ReportArgs): SafetyReport {
  return report(args, 'insufficient_information',
    'Nothing linked to this person was found, but key sources could not be checked, so this is not a clear result.', [],
    {
      scope: { sources_searched: [demoSources[2]], sources_not_accessible: [demoSources[0], demoSources[1]], search_completed: false },
      errors: ['search_failed: synthetic court portal (request timed out)', 'search_failed: synthetic state registry (unavailable)'],
      caveats: ['2 source(s), such as registries or court portals, could not be checked.'],
    })
}

const bySubject: Record<string, (args: ReportArgs) => SafetyReport> = {
  'demo-maya': cleared,
  'demo-leo': openAllegation,
  'demo-kai': reportedConviction,
  'demo-theo': incomplete,
  'demo-river': sameNameOnly,
}

/** The pre-built background check for a demo profile (every demo profile has one). */
export function buildScreeningReport(args: ReportArgs): SafetyReport {
  return (bySubject[args.subjectUid ?? ''] ?? noRecords)(args)
}
