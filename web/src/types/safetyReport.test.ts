import { describe, expect, it } from 'vitest'
import {
  caseStatusLabels,
  emptyResultsMessage,
  parseSafetyReport,
  recordTiers,
  REQUIRED_NOTICE,
  reportTier,
  tierStyles,
  visibleFindings,
  type SafetyReport,
} from './safetyReport'
import { buildScreeningReport } from '../fixtures/demoReports'
import { demoProfiles } from '../fixtures/demoProfiles'
import pipelineSample from '../fixtures/pipelineSample.json'

const forProfile = (uid: string) => {
  const profile = demoProfiles.find((p) => p.uid === uid)!
  return buildScreeningReport({ subjectUid: uid, nameProvided: `${profile.firstName} ${profile.lastName}`.trim(), context: profile.city })
}

describe('parseSafetyReport', () => {
  it('accepts every demo screening report', () => {
    for (const profile of demoProfiles) {
      const result = parseSafetyReport(forProfile(profile.uid))
      expect(result.ok, profile.uid).toBe(true)
    }
  })

  it('accepts real report.json output from the background_check pipeline', () => {
    const result = parseSafetyReport(pipelineSample)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.report.tldr?.record_tier).toBeDefined()
    expect(result.report.findings.every((f) => f.evidence_status)).toBe(true)
  })

  it('rejects malformed input', () => {
    expect(parseSafetyReport(null).ok).toBe(false)
    expect(parseSafetyReport({ schema_version: '1.0' }).ok).toBe(false)
  })

  it('rejects a finding without a source URL', () => {
    const report = forProfile('demo-maya') as SafetyReport
    const broken = { ...report, findings: [{ ...report.findings[0], source_url: undefined }] }
    expect(parseSafetyReport(broken).ok).toBe(false)
  })
})

describe('built-in background checks', () => {
  it('every demo member has a synthetic report with example.com sources', () => {
    for (const profile of demoProfiles) {
      const report = forProfile(profile.uid)
      expect(report.is_synthetic).toBe(true)
      expect(report.limitations).toContain(REQUIRED_NOTICE)
      for (const finding of report.findings) expect(new URL(finding.source_url).hostname).toMatch(/example\.com$/)
    }
  })

  it('demo profiles cover several result tiers', () => {
    const tiers = new Set(demoProfiles.map((p) => reportTier(forProfile(p.uid))))
    expect(tiers.size).toBeGreaterThanOrEqual(5)
  })

  it('name-only matches are hidden from viewers and only counted', () => {
    const { verified, unresolved, unlinkedCount } = visibleFindings(forProfile('demo-river'))
    expect(verified).toHaveLength(0)
    expect(unresolved).toHaveLength(0)
    expect(unlinkedCount).toBe(2)
  })

  it('unresolved findings explain why they are unresolved', () => {
    for (const profile of demoProfiles) {
      for (const f of visibleFindings(forProfile(profile.uid)).unresolved) expect(f.why_unresolved, f.finding_id).toBeTruthy()
    }
  })

  it('the pipeline sample hides other people and keeps linked findings', () => {
    const report = parseSafetyReport(pipelineSample)
    if (!report.ok) throw new Error(report.error)
    const { verified, unresolved } = visibleFindings(report.report)
    expect([...verified, ...unresolved].every((f) => ['strong_match', 'possible_match'].includes(f.identity_assessment))).toBe(true)
  })
})

describe('report wording', () => {
  it('never labels a tier or non-conviction as safe, clean, or a conviction', () => {
    for (const tier of recordTiers) expect(tierStyles[tier].short).not.toMatch(/\b(safe|clean)\b/i)
    // Unconfirmed results must not read as if the person has issues.
    expect(tierStyles.unresolved_allegations_or_charges.short).not.toMatch(/allegation|charge/i)
    for (const status of ['charge_pending', 'dismissed', 'acquitted', 'unknown'] as const) {
      expect(caseStatusLabels[status].label).not.toMatch(/^conviction/i)
    }
    expect(caseStatusLabels.charge_pending.label).toMatch(/not a conviction/i)
  })

  it('never calls an empty report clean or safe', () => {
    const message = emptyResultsMessage(forProfile('demo-sam')) ?? ''
    expect(message).toMatch(/does not mean no records exist/)
    expect(message).not.toMatch(/\b(clean|safe|cleared|verified)\b/i)
  })
})
