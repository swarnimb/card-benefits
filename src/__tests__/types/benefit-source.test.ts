import { describe, it, expect, expectTypeOf } from 'vitest'
import type { BenefitSource } from '@/types/benefit'

/**
 * Pure type-level + runtime guard for the BenefitSource union (Task 79).
 * No DB access — verifies the union admits exactly "scraped" and "manual".
 */
describe('BenefitSource union', () => {
  it('admits "scraped" and "manual"', () => {
    expectTypeOf<'scraped'>().toMatchTypeOf<BenefitSource>()
    expectTypeOf<'manual'>().toMatchTypeOf<BenefitSource>()
  })

  it('admits no other value — union is exactly the two literals', () => {
    // If a third member is ever added, `BenefitSource` widens and this fails to compile.
    expectTypeOf<BenefitSource>().toEqualTypeOf<'scraped' | 'manual'>()
  })

  it('rejects an arbitrary string at the type boundary (runtime sentinel)', () => {
    const valid: BenefitSource[] = ['scraped', 'manual']
    // @ts-expect-error — "auto-earn" is not a BenefitSource
    const invalid: BenefitSource = 'auto-earn'
    expect(valid).toHaveLength(2)
    expect(invalid).toBe('auto-earn')
  })
})
