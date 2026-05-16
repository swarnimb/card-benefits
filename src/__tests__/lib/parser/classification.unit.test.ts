import { describe, it, expect } from 'vitest'
import {
  CLASSIFICATION_BUCKETS,
  deriveTracked,
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
