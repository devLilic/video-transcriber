import { describe, expect, it } from 'vitest'
import { calculateSeekTarget } from '../../../src/features/media/calculateSeekTarget'

describe('calculateSeekTarget', () => {
  it('seeks forward', () => {
    expect(calculateSeekTarget(10, 5, 0, 60)).toBe(15)
  })

  it('seeks backward', () => {
    expect(calculateSeekTarget(10, -5, 0, 60)).toBe(5)
  })

  it('clamps to zero', () => {
    expect(calculateSeekTarget(2, -5, 0, 60)).toBe(0)
  })

  it('clamps to duration', () => {
    expect(calculateSeekTarget(58, 5, 0, 60)).toBe(60)
  })

  it('clamps to segment bounds', () => {
    expect(calculateSeekTarget(12, -5, 10, 20)).toBe(10)
    expect(calculateSeekTarget(18, 5, 10, 20)).toBe(20)
  })

  it('returns the minimum for invalid values', () => {
    expect(calculateSeekTarget(Number.NaN, 1, 0, 60)).toBe(0)
    expect(calculateSeekTarget(10, Number.NaN, 0, 60)).toBe(0)
    expect(calculateSeekTarget(10, 1, Number.NaN, 60)).toBe(0)
    expect(calculateSeekTarget(10, 1, 20, 10)).toBe(20)
  })
})
