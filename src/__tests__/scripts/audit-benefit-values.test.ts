import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock the filesystem so loadCorrections reads our in-memory JSON, and the db
// module so main()'s dynamic import wires a fake prisma into the script's
// module-level binding (the script only assigns `prisma` inside main()).
const { mockReadFileSync } = vi.hoisted(() => ({ mockReadFileSync: vi.fn() }))
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    benefit: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  },
}))

vi.mock('node:fs', () => ({ readFileSync: mockReadFileSync }))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

import {
  flagBenefit,
  loadCorrections,
  runApply,
  main,
  ApplyError,
} from '../../../scripts/audit-benefit-values'

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

describe('loadCorrections', () => {
  beforeEach(() => {
    mockReadFileSync.mockReset()
  })

  it('parses a valid { id: positiveNumber } map into the expected structure', () => {
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ ben_a: 50, ben_b: 12.5 })
    )

    const result = loadCorrections('corrections.json')

    expect(result).toEqual({ ben_a: 50, ben_b: 12.5 })
    expect(mockReadFileSync).toHaveBeenCalledWith('corrections.json', 'utf-8')
  })

  it('throws ApplyError on a non-number value, citing the offending id', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ ben_bad: '50' }))

    try {
      loadCorrections('corrections.json')
      expect.unreachable('expected loadCorrections to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(ApplyError)
      expect((err as ApplyError).benefitId).toBe('ben_bad')
    }
  })

  it('throws ApplyError on a zero or negative value', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ ben_zero: 0 }))
    expect(() => loadCorrections('corrections.json')).toThrow(ApplyError)

    mockReadFileSync.mockReturnValue(JSON.stringify({ ben_neg: -10 }))
    expect(() => loadCorrections('corrections.json')).toThrow(ApplyError)
  })
})

describe('runApply (via main --apply)', () => {
  const ORIGINAL_ARGV = process.argv

  beforeEach(() => {
    mockReadFileSync.mockReset()
    mockPrisma.benefit.findMany.mockReset()
    mockPrisma.benefit.update.mockReset()
    mockPrisma.$transaction.mockReset()
    mockPrisma.$disconnect.mockReset()
    // Run the inner callback against the fake prisma client.
    mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockPrisma) => unknown) =>
      cb(mockPrisma)
    )
    mockPrisma.$disconnect.mockResolvedValue(undefined)
    process.argv = ['node', 'audit-benefit-values.ts', '--apply', 'corrections.json']
  })

  afterEach(() => {
    process.argv = ORIGINAL_ARGV
  })

  it('HAPPY: updates Benefit.value only — usedAmount and periods untouched', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ ben_a: 50 }))
    mockPrisma.benefit.findMany.mockResolvedValue([{ id: 'ben_a', value: 600 }])
    mockPrisma.benefit.update.mockResolvedValue({ id: 'ben_a', value: 50 })

    await main()

    expect(mockPrisma.benefit.update).toHaveBeenCalledTimes(1)
    expect(mockPrisma.benefit.update).toHaveBeenCalledWith({
      where: { id: 'ben_a' },
      data: { value: 50 },
    })
    // Only `value` is written — no usedAmount / period fields in the update data.
    const writtenData = mockPrisma.benefit.update.mock.calls[0][0].data
    expect(Object.keys(writtenData)).toEqual(['value'])
  })

  it('ERROR: throws ApplyError when a corrected id is absent from the DB', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ ben_missing: 50 }))
    // findMany returns nothing → id not present in oldValues map.
    mockPrisma.benefit.findMany.mockResolvedValue([])

    await expect(main()).rejects.toMatchObject({
      name: 'ApplyError',
      benefitId: 'ben_missing',
    })
    expect(mockPrisma.benefit.update).not.toHaveBeenCalled()
  })
})
