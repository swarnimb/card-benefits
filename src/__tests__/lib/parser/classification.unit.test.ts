import { describe, it, expect } from 'vitest'
import {
  applyAutoEarnOverride,
  CLASSIFICATION_BUCKETS,
  deriveTracked,
  detectAutoEarnPatterns,
  isValidClassification,
  normalizeClassification,
} from '@/lib/parser/classification'

describe('deriveTracked', () => {
  it('returns true for discretionary-credit and activation-perk', () => {
    expect(deriveTracked('discretionary-credit')).toBe(true)
    expect(deriveTracked('activation-perk')).toBe(true)
  })

  it('returns false for auto-earn, passive-perk, one-time-bonus', () => {
    expect(deriveTracked('auto-earn')).toBe(false)
    expect(deriveTracked('passive-perk')).toBe(false)
    expect(deriveTracked('one-time-bonus')).toBe(false)
  })

  it('returns true (conservative) for unknown/ambiguous string — A10 mitigation', () => {
    expect(deriveTracked('mystery-bucket')).toBe(true)
    expect(deriveTracked(null)).toBe(true)
    expect(deriveTracked(undefined)).toBe(true)
  })
})

describe('normalizeClassification', () => {
  it('returns discretionary-credit for null/undefined/garbage', () => {
    expect(normalizeClassification(null)).toBe('discretionary-credit')
    expect(normalizeClassification(undefined)).toBe('discretionary-credit')
    expect(normalizeClassification(42)).toBe('discretionary-credit')
    expect(normalizeClassification('not-a-bucket')).toBe('discretionary-credit')
  })

  it('passes a valid bucket through unchanged', () => {
    for (const bucket of CLASSIFICATION_BUCKETS) {
      expect(normalizeClassification(bucket)).toBe(bucket)
    }
  })
})

describe('isValidClassification', () => {
  it('returns false for a non-bucket string', () => {
    expect(isValidClassification('lifestyle')).toBe(false)
    expect(isValidClassification('')).toBe(false)
    expect(isValidClassification(123)).toBe(false)
  })

  it('returns true for every defined bucket', () => {
    for (const bucket of CLASSIFICATION_BUCKETS) {
      expect(isValidClassification(bucket)).toBe(true)
    }
  })
})

describe('detectAutoEarnPatterns', () => {
  it('returns true for 5 representative cash-back / points patterns', () => {
    // Cash-back percentage on all purchases — Freedom Unlimited base rate.
    expect(
      detectAutoEarnPatterns(
        '1.5% Cash Back',
        'Earn 1.5% cash back on all purchases'
      )
    ).toBe(true)
    // Cash-back percentage on a specific category — FU dining/drugstore.
    expect(
      detectAutoEarnPatterns(
        '3% on Dining',
        'Earn 3% cash back at restaurants worldwide'
      )
    ).toBe(true)
    // "Rewards" phrasing — covers Citi/Discover rotating-category language.
    expect(
      detectAutoEarnPatterns(
        '5% Rewards',
        'Earn 5% rewards on rotating quarterly categories'
      )
    ).toBe(true)
    // Points multiplier in name only — common when description is null.
    expect(detectAutoEarnPatterns('3x Points on Dining', null)).toBe(true)
    // Miles multiplier in description — Hilton Aspire / Capital One pattern.
    expect(
      detectAutoEarnPatterns('Hilton Points', 'Earn 5x miles on hotel stays')
    ).toBe(true)
  })

  it('returns false for 5 representative discretionary-credit phrasings', () => {
    // Fixed-dollar annual credit — should remain discretionary-credit.
    expect(
      detectAutoEarnPatterns(
        '$300 Travel Credit',
        'Up to $300 annual statement credit toward eligible travel'
      )
    ).toBe(false)
    // Fixed monthly credit — Amex Platinum Uber Cash style.
    expect(
      detectAutoEarnPatterns(
        '$200 Uber Credit',
        '$15 monthly Uber Cash, $20 in December'
      )
    ).toBe(false)
    // Streaming subscription credit — fixed dollar, not a rate.
    expect(
      detectAutoEarnPatterns(
        '$25 Streaming Credit',
        'Monthly statement credit for select streaming subscriptions'
      )
    ).toBe(false)
    // Property-specific credit — fixed amount per stay.
    expect(
      detectAutoEarnPatterns(
        '$120 Dining Credit',
        'Annual credit at Grubhub, Five Guys, Goldbelly'
      )
    ).toBe(false)
    // Hotel resort credit — fixed amount, not a rate.
    expect(
      detectAutoEarnPatterns(
        '$50 Hotel Credit',
        'Property credit per stay at participating hotels'
      )
    ).toBe(false)
  })
})

describe('applyAutoEarnOverride', () => {
  it('flips discretionary-credit to auto-earn when name/description matches earn-rate regex', () => {
    // The integration of override path: LLM says discretionary, regex says earn rate.
    expect(
      applyAutoEarnOverride(
        '1.5% Cash Back',
        'Earn 1.5% cash back on all purchases',
        'discretionary-credit'
      )
    ).toBe('auto-earn')
    expect(
      applyAutoEarnOverride('3x Points', 'on dining', 'discretionary-credit')
    ).toBe('auto-earn')
  })

  it('passes through unchanged when no earn-rate pattern matches', () => {
    // True discretionary credit — override must not fire.
    expect(
      applyAutoEarnOverride(
        '$300 Travel Credit',
        'Up to $300 annual statement credit',
        'discretionary-credit'
      )
    ).toBe('discretionary-credit')
    // Activation perk — override only flips to auto-earn, never away from it.
    expect(
      applyAutoEarnOverride('Priority Pass', null, 'activation-perk')
    ).toBe('activation-perk')
    // Already auto-earn — short-circuit, no work needed.
    expect(
      applyAutoEarnOverride('1.5% Cash Back', 'on all', 'auto-earn')
    ).toBe('auto-earn')
  })
})
