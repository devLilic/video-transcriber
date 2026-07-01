import { describe, expect, it } from 'vitest'
import { normalizeSegmentSelection } from '../../../src/features/media/segmentSelection'

describe('normalizeSegmentSelection', () => {
  it('keeps a valid segment unchanged', () => {
    expect(normalizeSegmentSelection({ inSeconds: 2, outSeconds: 8 }, 10)).toEqual({
      inSeconds: 2,
      outSeconds: 8,
    })
  })

  it('clamps segment bounds to the video duration', () => {
    expect(normalizeSegmentSelection({ inSeconds: -5, outSeconds: 15 }, 10)).toEqual({
      inSeconds: 0,
      outSeconds: 10,
    })
  })

  it('keeps the normalized segment strictly ordered', () => {
    expect(normalizeSegmentSelection({ inSeconds: 9, outSeconds: 3 }, 10)).toEqual({
      inSeconds: 9,
      outSeconds: 9.05,
    })
  })

  it('returns null when duration cannot contain a segment', () => {
    expect(normalizeSegmentSelection({ inSeconds: 0, outSeconds: 1 }, 0)).toBeNull()
  })
})
