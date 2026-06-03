import { describe, it, expect } from 'vitest'
import {
  applyClassificationOverride,
  CLASSIFICATION_BUCKETS,
  deriveSetAndForget,
  deriveTracked,
  detectAutoEarnPatterns,
  detectDiscountPatterns,
  detectPayOverTimePatterns,
  detectSetAndForget,
  detectTrialPatterns,
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

describe('detectTrialPatterns', () => {
  it('returns true for 3 representative trial phrasings (Task 48 / NEW-8)', () => {
    // DashPass 6 month trial — the FU regression that surfaced NEW-8.
    expect(
      detectTrialPatterns('DashPass 6 month trial', '6-month complimentary DashPass trial')
    ).toBe(true)
    // Apple TV+ trial in name only — common when description is null.
    expect(detectTrialPatterns('Apple TV+ Trial', null)).toBe(true)
    // Trial phrasing buried in description — Walmart+ style.
    expect(
      detectTrialPatterns('Walmart+ Membership', 'Free 6-month trial of Walmart+')
    ).toBe(true)
  })

  it('returns false for 3 representative non-trial phrasings (negative lock)', () => {
    // Recurring statement credit — must not flip just because "credit" exists.
    expect(
      detectTrialPatterns('$25 Streaming Credit', 'Monthly statement credit')
    ).toBe(false)
    // Fixed annual travel credit — pure discretionary, no trial.
    expect(detectTrialPatterns('$300 Travel Credit', null)).toBe(false)
    // Lounge access — passive activation perk, not a trial.
    expect(
      detectTrialPatterns('Priority Pass', 'Complimentary lounge access worldwide')
    ).toBe(false)
  })
})

describe('detectPayOverTimePatterns', () => {
  it('returns true for 3 representative pay-over-time phrasings (Task 48 / NEW-8)', () => {
    // Chase Pay Over Time — the FU surface case.
    expect(
      detectPayOverTimePatterns('Chase Pay Over Time', 'Pay over time on eligible purchases')
    ).toBe(true)
    // Amazon Pay Over Time — second FU surface case.
    expect(detectPayOverTimePatterns('Amazon Pay Over Time', null)).toBe(true)
    // Pay-over-time buried in description — generic phrasing.
    expect(
      detectPayOverTimePatterns(
        'Flexible Payments',
        'Option to pay over time for purchases over $100'
      )
    ).toBe(true)
  })

  it('returns false for 3 representative non-financing phrasings (negative lock)', () => {
    // Streaming credit — recurring, but not financing.
    expect(
      detectPayOverTimePatterns('$25 Streaming Credit', 'Monthly credit toward streaming')
    ).toBe(false)
    // Cash back rate — would be flipped by earn-rate rule, not this one.
    expect(
      detectPayOverTimePatterns('1.5% Cash Back', 'on all purchases')
    ).toBe(false)
    // Trial — distinct override path, no pay-over-time signal.
    expect(detectPayOverTimePatterns('DashPass Trial', '6 month trial')).toBe(false)
  })
})

describe('detectDiscountPatterns', () => {
  it('returns true for 3 representative auto-applied / recurring discount phrasings', () => {
    // DashPass quarterly discount — the FU case that motivated this regex.
    expect(
      detectDiscountPatterns('DashPass quarterly discount', 'Quarterly discount on DashPass orders')
    ).toBe(true)
    // Explicit auto-applied phrasing — the safest discount signal.
    expect(
      detectDiscountPatterns('Auto-applied discount', 'Discount auto applied at checkout')
    ).toBe(true)
    // Monthly recurring discount — fixed cadence prefix.
    expect(
      detectDiscountPatterns('Grocery Savings', 'Monthly discount on grocery purchases')
    ).toBe(true)
  })

  it('returns false for 3 representative fixed-dollar credits (CRITICAL false-positive lock)', () => {
    // "$25 dining credit" — must NOT flip even though the card description
    // might use "discount" colloquially elsewhere. The regex requires the
    // discount prefix; bare "credit" is the strongest non-flip signal.
    expect(
      detectDiscountPatterns('$25 Dining Credit', 'Monthly statement credit for dining')
    ).toBe(false)
    // Streaming credit — fixed-dollar recurring, must stay discretionary-credit.
    expect(
      detectDiscountPatterns('$10 Streaming Credit', 'Monthly credit toward streaming')
    ).toBe(false)
    // Hotel property credit — per-stay fixed amount, not a discount rate.
    expect(
      detectDiscountPatterns('$50 Hotel Credit', '$50 property credit per stay')
    ).toBe(false)
  })
})

describe('applyClassificationOverride', () => {
  it('flips discretionary-credit to auto-earn when name/description matches earn-rate regex', () => {
    // The integration of override path: LLM says discretionary, regex says earn rate.
    expect(
      applyClassificationOverride(
        '1.5% Cash Back',
        'Earn 1.5% cash back on all purchases',
        'discretionary-credit'
      )
    ).toBe('auto-earn')
    expect(
      applyClassificationOverride('3x Points', 'on dining', 'discretionary-credit')
    ).toBe('auto-earn')
  })

  it('flips discretionary-credit to one-time-bonus when trial pattern matches', () => {
    // The FU NEW-8 case: "DashPass 6 month trial" was classified as
    // discretionary-credit (tracked: true) when it's a signup perk.
    expect(
      applyClassificationOverride(
        'DashPass 6 month trial',
        '6-month complimentary DashPass trial',
        'discretionary-credit'
      )
    ).toBe('one-time-bonus')
  })

  it('flips discretionary-credit to passive-perk when pay-over-time pattern matches', () => {
    // The FU NEW-8 case: "Chase Pay Over Time" is a card feature, not a credit.
    expect(
      applyClassificationOverride(
        'Chase Pay Over Time',
        'Pay over time on eligible purchases',
        'discretionary-credit'
      )
    ).toBe('passive-perk')
  })

  it('flips discretionary-credit to passive-perk when recurring-discount pattern matches', () => {
    // The FU NEW-8 case: "DashPass quarterly discount" is auto-applied at checkout.
    expect(
      applyClassificationOverride(
        'DashPass quarterly discount',
        'Quarterly discount on DashPass orders',
        'discretionary-credit'
      )
    ).toBe('passive-perk')
  })

  it('auto-earn is sticky: weaker keyword signals do not downgrade an auto-earn input', () => {
    // Edge case: "5% cash back trial offer". LLM correctly identifies the
    // earn-rate mechanic as auto-earn — the "trial" keyword must not flip
    // it to one-time-bonus. The earn rate is the truth, the trial is a wrapper.
    expect(
      applyClassificationOverride('5% Cash Back trial offer', null, 'auto-earn')
    ).toBe('auto-earn')
    // Same for discount and pay-over-time wrappers around an earn rate.
    expect(
      applyClassificationOverride(
        '2% Cash Back',
        'Monthly discount applied as cash back',
        'auto-earn'
      )
    ).toBe('auto-earn')
  })

  it('passes through unchanged when no override pattern matches', () => {
    // True discretionary credit — no override must fire.
    expect(
      applyClassificationOverride(
        '$300 Travel Credit',
        'Up to $300 annual statement credit',
        'discretionary-credit'
      )
    ).toBe('discretionary-credit')
    // Activation perk — no override path targets it; passes through.
    expect(
      applyClassificationOverride('Priority Pass', null, 'activation-perk')
    ).toBe('activation-perk')
    // Critical false-positive lock at the integration level: "$25 dining
    // credit" must not flip to passive-perk just because "discount" might be
    // used colloquially — the regex requires the discount prefix.
    expect(
      applyClassificationOverride(
        '$25 Dining Credit',
        'Monthly statement credit for dining',
        'discretionary-credit'
      )
    ).toBe('discretionary-credit')
  })

  it('no-op (silent) when LLM already chose the override target', () => {
    // LLM correctly classified a trial as one-time-bonus → no flip, no log.
    expect(
      applyClassificationOverride(
        'DashPass 6 month trial',
        null,
        'one-time-bonus'
      )
    ).toBe('one-time-bonus')
    // LLM correctly classified pay-over-time as passive-perk → no flip.
    expect(
      applyClassificationOverride('Chase Pay Over Time', null, 'passive-perk')
    ).toBe('passive-perk')
  })
})

describe('detectSetAndForget', () => {
  it('returns true for 5 membership-reimbursement benefits (Walmart+, Uber One, CLEAR, Oura, digital entertainment)', () => {
    // Walmart+ membership — credit auto-applies once enrolled.
    expect(
      detectSetAndForget('Walmart+ Membership', 'Annual Walmart+ membership statement credit')
    ).toBe(true)
    // Uber One membership — the half of the Uber One/Uber Cash split that IS set-and-forget.
    expect(
      detectSetAndForget('Uber One', 'Complimentary Uber One membership credit')
    ).toBe(true)
    // CLEAR Plus — the paid airport-security membership.
    expect(
      detectSetAndForget('CLEAR Plus Credit', 'Up to $189 toward a CLEAR Plus membership')
    ).toBe(true)
    // Oura — ring membership reimbursement.
    expect(
      detectSetAndForget('Oura Membership', 'Statement credit toward an Oura Ring membership')
    ).toBe(true)
    // Digital-entertainment / streaming-bundle credit — bundled subscriptions.
    expect(
      detectSetAndForget('Digital Entertainment Credit', 'Monthly credit for digital entertainment subscriptions')
    ).toBe(true)
  })

  it('returns false for recurring-action credits — Uber Cash, airline fee, hotel, Resy (negative lock)', () => {
    // Uber Cash: a monthly balance the user must actively SPEND — the canonical
    // trap. Must NOT match the Uber One membership pattern.
    expect(detectSetAndForget('Uber Cash', '$15 in monthly Uber Cash, $20 in December')).toBe(false)
    // Airline incidental fee credit — must charge an airline to capture.
    expect(
      detectSetAndForget('$200 Airline Fee Credit', 'Annual credit for airline incidental fees')
    ).toBe(false)
    // Hotel property credit — must book/stay.
    expect(
      detectSetAndForget('$50 Hotel Credit', 'Property credit per stay at participating hotels')
    ).toBe(false)
    // Resy dining credit — must dine to capture.
    expect(
      detectSetAndForget('$10 Resy Dining Credit', 'Monthly statement credit at Resy restaurants')
    ).toBe(false)
  })
})

describe('deriveSetAndForget', () => {
  it('resolves true for a tracked membership-reimbursement benefit (either tracked bucket)', () => {
    expect(
      deriveSetAndForget('Walmart+ Membership', 'Annual Walmart+ credit', 'activation-perk')
    ).toBe(true)
    expect(
      deriveSetAndForget('CLEAR Plus Credit', 'CLEAR Plus membership', 'discretionary-credit')
    ).toBe(true)
  })

  it('resolves false for Uber Cash even when tracked (Uber One vs Uber Cash)', () => {
    expect(
      deriveSetAndForget('Uber Cash', '$15 monthly Uber Cash', 'discretionary-credit')
    ).toBe(false)
  })

  it('resolves false when the benefit is not tracked — code decides, not the membership name', () => {
    // A Walmart+ *trial* is overridden to one-time-bonus (not tracked); even
    // though the name matches the membership set, an untracked benefit is never
    // set-and-forget. Mirrors the deriveTracked discipline.
    expect(
      deriveSetAndForget('Walmart+ 6-month trial', 'Free Walmart+ trial', 'one-time-bonus')
    ).toBe(false)
    // auto-earn is likewise excluded — a Walmart cash-back rate is not a membership.
    expect(
      deriveSetAndForget('Walmart Cash Back', '5% back at Walmart', 'auto-earn')
    ).toBe(false)
  })

  it('resolves false for a tracked credit that is not a known membership (recurring-action)', () => {
    expect(
      deriveSetAndForget('$200 Airline Fee Credit', 'Annual airline incidental credit', 'discretionary-credit')
    ).toBe(false)
  })
})
