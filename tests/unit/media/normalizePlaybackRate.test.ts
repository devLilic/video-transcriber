import { describe, expect, it } from 'vitest'
import { normalizePlaybackRate, PLAYBACK_RATES } from '../../../src/features/media/playbackRate'

describe('normalizePlaybackRate', () => {
  it('accepts every allowed playback rate', () => {
    for (const playbackRate of PLAYBACK_RATES) {
      expect(normalizePlaybackRate(playbackRate)).toBe(playbackRate)
    }
  })

  it('returns 1 for an invalid value', () => {
    expect(normalizePlaybackRate(1.1)).toBe(1)
  })

  it('returns 1 for a string value', () => {
    expect(normalizePlaybackRate('1.5')).toBe(1)
  })

  it('returns 1 for null', () => {
    expect(normalizePlaybackRate(null)).toBe(1)
  })

  it('returns 1 for a value that is too large', () => {
    expect(normalizePlaybackRate(4)).toBe(1)
  })
})
