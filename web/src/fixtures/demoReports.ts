import type { SafetyReport } from '../types/safetyReport'

// SYNTHETIC TEST DATA. These reports describe fictional demo profiles only.
// All sources point at example.com and every report sets is_synthetic: true.

interface ReportArgs {
  reportId: string
  subjectUid?: string
  nameProvided: string
  context?: string
  now?: Date
}

const baseLimitations = [
  'This is not a formal criminal-history check.',
  'A lack of results does not establish that no records exist.',
  'This report was generated from synthetic demo data. No live sources were searched.',
]

function base(args: ReportArgs): Omit<SafetyReport, 'summary' | 'findings' | 'scope' | 'errors'> {
  return {
    schema_version: '1.0',
    report_id: args.reportId,
    generated_at: (args.now ?? new Date()).toISOString(),
    is_synthetic: true,
    subject: { name_provided: args.nameProvided, context_provided: args.context ?? null },
    limitations: baseLimitations,
    human_review_required: true,
  }
}

const demoSources = ['Synthetic county court portal (demo)', 'Synthetic state registry (demo)', 'Synthetic local news archive (demo)']

function mixedFindingsReport(args: ReportArgs): SafetyReport {
  const retrievedAt = (args.now ?? new Date()).toISOString()
  return {
    ...base(args),
    scope: { sources_searched: demoSources, sources_not_accessible: [], search_completed: true },
    summary:
      'Two synthetic records were found that share the provided name. One civil case was dismissed and is a possible match. One pending charge is a weak match with conflicting details that suggest a different person. Neither record establishes identity.',
    findings: [
      {
        finding_id: 'finding-001',
        description: 'Synthetic civil small-claims case filed and later dismissed by the court.',
        record_type: 'civil_case',
        case_status: 'dismissed',
        identity_assessment: 'possible_match',
        identity_rationale: 'Name and broad region match. No date of birth or other identifier was available to confirm identity.',
        event_date: '2021-06-02',
        jurisdiction: 'Example County (synthetic)',
        source_url: 'https://example.com/synthetic/court/case-1001',
        source_title: 'Example County court portal — case 1001 (synthetic)',
        source_type: 'official_record',
        retrieved_at: retrievedAt,
        supporting_excerpt: 'Case status: Dismissed. (synthetic excerpt)',
        conflicts: [],
        limitations: ['A dismissed civil case is not a finding of wrongdoing.'],
      },
      {
        finding_id: 'finding-002',
        description: 'Synthetic news report about a pending charge against a person with the same name.',
        record_type: 'criminal_case',
        case_status: 'charge_pending',
        identity_assessment: 'weak_match',
        identity_rationale: 'Only the name matches. The reported age and city differ from the provided context.',
        event_date: '2025-01-15',
        jurisdiction: 'Another State (synthetic)',
        source_url: 'https://example.com/synthetic/news/article-2002',
        source_title: 'Example Gazette — local news (synthetic)',
        source_type: 'news',
        retrieved_at: retrievedAt,
        supporting_excerpt: 'The case is pending; no verdict has been reached. (synthetic excerpt)',
        conflicts: ['Reported age differs by about 15 years.', 'Reported city is in a different state.'],
        limitations: ['News reporting is not a court finding.', 'A pending charge is not a conviction.'],
      },
    ],
    errors: [],
  }
}

function noFindingsReport(args: ReportArgs): SafetyReport {
  return {
    ...base(args),
    scope: { sources_searched: demoSources, sources_not_accessible: [], search_completed: true },
    summary: 'No matching records were found in the synthetic demo sources searched.',
    findings: [],
    errors: [],
  }
}

function incompleteReport(args: ReportArgs): SafetyReport {
  return {
    ...base(args),
    scope: {
      sources_searched: [demoSources[0]],
      sources_not_accessible: [demoSources[1], demoSources[2]],
      search_completed: false,
    },
    summary: 'The search did not complete. Only one synthetic source responded, and it returned no matching records.',
    findings: [],
    errors: ['Synthetic state registry (demo): request timed out.', 'Synthetic local news archive (demo): source unavailable.'],
  }
}

function customNameReport(args: ReportArgs): SafetyReport {
  return {
    ...base(args),
    scope: { sources_searched: [], sources_not_accessible: ['Live sources are not configured in demo mode'], search_completed: false },
    summary: 'Demo mode does not search live sources, so no information is available for this name.',
    findings: [],
    errors: ['Live search is not available in demo mode.'],
  }
}

const bySubject: Record<string, (args: ReportArgs) => SafetyReport> = {
  'demo-maya': mixedFindingsReport,
  'demo-theo': incompleteReport,
}

export function buildDemoReport(args: ReportArgs): SafetyReport {
  if (!args.subjectUid?.startsWith('demo-')) return customNameReport(args)
  return (bySubject[args.subjectUid] ?? noFindingsReport)(args)
}
