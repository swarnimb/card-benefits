import { describe, it, expect } from 'vitest'
import { flagBenefit } from '../../../scripts/audit-benefit-values'

describe('flagBenefit', () => {
  it('flags a semiannual benefit whose value looks like an annual total', () => {
    const result = flagBenefit({
      value: 600,
      resetPeriod: 'semiannual',
      description: '$600 per year',
    })
    expect(result.flagged).toBe(true)
    expect(result.reason).toMatch(/annual/i)
  })

  it('does not flag an annual or once benefit', () => {
    expect(
      flagBenefit({ value: 300, resetPeriod: 'annual', description: null })
    ).toEqual({ flagged: false, reason: '' })
    expect(
      flagBenefit({ value: 300, resetPeriod: 'once', description: '$300 annual travel credit' })
    ).toEqual({ flagged: false, reason: '' })
  })
})
