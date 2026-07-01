import { describe, expect, it } from 'vitest'
import type { LocalTranscriptSegment } from '../../../src/shared/local-transcription/types'
import { findActiveTranscriptSegment } from '../../../src/features/transcription/findActiveTranscriptSegment'

const segments: LocalTranscriptSegment[] = [
  createSegment('a', 10, 12),
  createSegment('b', 13, 15),
]

describe('findActiveTranscriptSegment', () => {
  it('returns the segment containing the current time', () => {
    expect(findActiveTranscriptSegment(segments, 11)?.id).toBe('a')
  })

  it('returns null when current time is between segments', () => {
    expect(findActiveTranscriptSegment(segments, 12.5)).toBeNull()
  })

  it('returns null before and after the transcript', () => {
    expect(findActiveTranscriptSegment(segments, 9.99)).toBeNull()
    expect(findActiveTranscriptSegment(segments, 15)).toBeNull()
  })

  it('treats the exact boundary as the next segment start', () => {
    expect(findActiveTranscriptSegment(segments, 12)).toBeNull()
    expect(findActiveTranscriptSegment(segments, 13)?.id).toBe('b')
  })
})

function createSegment(id: string, start: number, end: number): LocalTranscriptSegment {
  return {
    id,
    relativeStartSeconds: start - 10,
    relativeEndSeconds: end - 10,
    absoluteStartSeconds: start,
    absoluteEndSeconds: end,
    originalText: id,
    text: id,
    isEdited: false,
    editedAt: null,
  }
}
