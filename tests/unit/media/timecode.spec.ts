import { describe, expect, it } from 'vitest'
import { formatTimecode } from '../../../src/features/media/timecode'

describe('formatTimecode', () => {
  it('formats zero as HH:MM:SS.mmm', () => {
    expect(formatTimecode(0)).toBe('00:00:00.000')
  })

  it('formats hours, minutes, seconds, and milliseconds', () => {
    expect(formatTimecode(3723.456)).toBe('01:02:03.456')
  })

  it('floors fractional milliseconds', () => {
    expect(formatTimecode(1.9999)).toBe('00:00:01.999')
  })

  it('normalizes invalid values to zero', () => {
    expect(formatTimecode(Number.NaN)).toBe('00:00:00.000')
    expect(formatTimecode(-3)).toBe('00:00:00.000')
  })
})
