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

  it("flags an annual row whose description mentions 'per quarter'", () => {
    const result = flagBenefit({
      value: 400,
      resetPeriod: 'annual',
      description: '$400 dining credit, $100 per quarter',
    })
    expect(result.flagged).toBe(true)
    expect(result.reason).toMatch(/quarterly/i)
  })

  it('does not flag a genuine annual credit with no sub-annual signal', () => {
    expect(
      flagBenefit({
        value: 200,
        resetPeriod: 'annual',
        name: '$200 Airline Fee Credit',
        description: 'Up to $200 in statement credits for airline incidental fees',
      })
    ).toEqual({ flagged: false, reason: '' })
    expect(
      flagBenefit({
        value: 209,
        resetPeriod: 'annual',
        name: '$209 CLEAR+ Credit',
        description: null,
      })
    ).toEqual({ flagged: false, reason: '' })
  })

  it('still flags a sub-annual row needing per-window confirmation (regression)', () => {
    const result = flagBenefit({
      value: 50,
      resetPeriod: 'monthly',
      description: '$50 Uber Cash',
    })
    expect(result.flagged).toBe(true)
    expect(result.reason).toMatch(/per-window/i)
  })

  it("flags an annual row whose description uses the '/mo' shorthand", () => {
    const result = flagBenefit({
      value: 120,
      resetPeriod: 'annual',
      description: '$120 streaming credit ($10/mo)',
    })
    expect(result.flagged).toBe(true)
    expect(result.reason).toMatch(/monthly/i)
  })

  it("flags an annual row whose name signals a semi-annual cadence", () => {
    const result = flagBenefit({
      value: 200,
      resetPeriod: 'annual',
      name: '$200 semi-annual lifestyle credit',
      description: null,
    })
    expect(result.flagged).toBe(true)
    expect(result.reason).toMatch(/semi-annual/i)
  })

  it("flags an annual row using the '$N per month' money-cadence form", () => {
    const result = flagBenefit({
      value: 300,
      resetPeriod: 'annual',
      description: 'Get $25 per month back on rideshare',
    })
    expect(result.flagged).toBe(true)
    expect(result.reason).toMatch(/monthly/i)
  })

  it("flags a 'once' row whose description signals a quarterly cadence", () => {
    const result = flagBenefit({
      value: 300,
      resetPeriod: 'once',
      description: '$75 each quarter in travel credits',
    })
    expect(result.flagged).toBe(true)
    expect(result.reason).toMatch(/quarterly/i)
  })
})
