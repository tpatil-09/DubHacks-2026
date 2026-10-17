import { describe, expect, it } from 'vitest'
import { caseStatusLabels, emptyResultsMessage, parseSafetyReport, type SafetyReport } from './safetyReport'
import { buildDemoReport } from '../fixtures/demoReports'
import { demoProfiles } from '../fixtures/demoProfiles'

const mixed = () => buildDemoReport({ reportId: 'r1', subjectUid: 'demo-maya', nameProvided: 'Maya' })

describe('parseSafetyReport', () => {
  it('accepts every demo fixture', () => {
    for (const profile of demoProfiles) {
      const result = parseSafetyReport(buildDemoReport({ reportId: 'r', subjectUid: profile.uid, nameProvided: profile.displayName }))
      expect(result.ok).toBe(true)
    }
    expect(parseSafetyReport(buildDemoReport({ reportId: 'r', nameProvided: 'Someone Typed' })).ok).toBe(true)
  })

  it('rejects malformed input', () => {
    expect(parseSafetyReport(null).ok).toBe(false)
    expect(parseSafetyReport({ schema_version: '1.0' }).ok).toBe(false)
  })

  it('rejects a finding without a source URL', () => {
    const report = mixed() as SafetyReport
    expect(report.findings.length).toBeGreaterThan(0)
    const broken = { ...report, findings: [{ ...report.findings[0], source_url: undefined }] }
    expect(parseSafetyReport(broken).ok).toBe(false)
  })
})

describe('report wording', () => {
  it('never labels non-convictions as convictions', () => {
    for (const status of ['charge_pending', 'dismissed', 'acquitted', 'unknown'] as const) {
      const label = caseStatusLabels[status as keyof typeof caseStatusLabels]
      if (label) expect(label.label).not.toMatch(/^conviction/i)
    }
    expect(caseStatusLabels.charge_pending.label).toMatch(/not a conviction/i)
  })

  it('never calls an empty report clean or safe', () => {
    const empty = buildDemoReport({ reportId: 'r', subjectUid: 'demo-sam', nameProvided: 'Sam' })
    const message = emptyResultsMessage(empty) ?? ''
    expect(message).toMatch(/does not mean no records exist/)
    expect(message).not.toMatch(/\b(clean|safe|cleared|verified)\b/i)
  })

  it('marks every demo report as synthetic with example.com sources', () => {
    const report = mixed()
    expect(report.is_synthetic).toBe(true)
    for (const finding of report.findings) expect(new URL(finding.source_url).hostname).toMatch(/example\.com$/)
  })

  it('never attaches records to a typed real-world name', () => {
    expect(buildDemoReport({ reportId: 'r', nameProvided: 'Real Person' }).findings).toHaveLength(0)
  })
})
