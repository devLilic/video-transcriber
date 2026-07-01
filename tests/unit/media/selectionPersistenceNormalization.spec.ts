import { describe, expect, it } from 'vitest'
import { isValidSegmentSelection, normalizeSegmentSelection } from '../../../src/features/media/segmentSelection'

describe('selection persistence normalization', () => {
  it('accepts a stored selection that fits the current duration', () => {
    expect(normalizeSegmentSelection({ inSeconds: 10.5, outSeconds: 45.2 }, 60)).toEqual({
      inSeconds: 10.5,
      outSeconds: 45.2,
    })
  })

  it('identifies stored selections that must fall back to full duration', () => {
    const invalidSelection = { inSeconds: 80, outSeconds: 20 }
    const fallbackSelection = { inSeconds: 0, outSeconds: 90 }

    expect(isValidSegmentSelection(invalidSelection, 90)).toBe(false)
    expect(normalizeSegmentSelection(fallbackSelection, 90)).toEqual(fallbackSelection)
  })
})
