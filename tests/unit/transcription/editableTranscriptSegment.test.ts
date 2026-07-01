import { describe, expect, it } from 'vitest'
import { parseWhisperResult } from '../../../electron/main/modules/local-transcription/parseWhisperResult'
import {
  buildTranscriptFullText,
  resetTranscriptSegmentText,
  updateTranscriptSegmentText,
} from '../../../src/features/transcription/transcriptSegmentText'
import type { LocalTranscriptSegment } from '../../../src/shared/local-transcription/types'

describe('editable transcript segments', () => {
  it('initializes automatic text from the Whisper result', () => {
    const result = parseWhisperResult({
      transcription: [
        {
          offsets: { from: 0, to: 1000 },
          text: '  Bună ziua!  ',
        },
      ],
    }, 5, 10)

    expect(result.segments[0]).toMatchObject({
      originalText: 'Bună ziua!',
      text: 'Bună ziua!',
      isEdited: false,
      editedAt: null,
    })
  })

  it('updates text while preserving the automatic text', () => {
    const updated = updateTranscriptSegmentText(createSegment(), '  Bună seara!  ', '2026-07-01T12:00:00.000Z')

    expect(updated.originalText).toBe('Bună ziua!')
    expect(updated.text).toBe('Bună seara!')
    expect(updated.isEdited).toBe(true)
    expect(updated.editedAt).toBe('2026-07-01T12:00:00.000Z')
  })

  it('preserves timecodes when text changes', () => {
    const segment = createSegment()
    const updated = updateTranscriptSegmentText(segment, 'Alt text.', '2026-07-01T12:00:00.000Z')

    expect(updated.relativeStartSeconds).toBe(segment.relativeStartSeconds)
    expect(updated.relativeEndSeconds).toBe(segment.relativeEndSeconds)
    expect(updated.absoluteStartSeconds).toBe(segment.absoluteStartSeconds)
    expect(updated.absoluteEndSeconds).toBe(segment.absoluteEndSeconds)
  })

  it('detects text identical to the original as not edited', () => {
    const updated = updateTranscriptSegmentText(createSegment(), '  Bună ziua!  ', '2026-07-01T12:00:00.000Z')

    expect(updated.text).toBe('Bună ziua!')
    expect(updated.isEdited).toBe(false)
    expect(updated.editedAt).toBeNull()
  })

  it('resets edited text to the automatic text', () => {
    const edited = updateTranscriptSegmentText(createSegment(), 'Bună seara!', '2026-07-01T12:00:00.000Z')
    const reset = resetTranscriptSegmentText(edited)

    expect(reset.text).toBe('Bună ziua!')
    expect(reset.isEdited).toBe(false)
    expect(reset.editedAt).toBeNull()
  })

  it('builds fullText from edited text values', () => {
    const edited = updateTranscriptSegmentText(createSegment(), 'Bună seara!', '2026-07-01T12:00:00.000Z')

    expect(buildTranscriptFullText([
      edited,
      { ...createSegment('b'), originalText: 'Original automat.', text: 'Text corectat.' },
    ])).toBe('Bună seara! Text corectat.')
  })
})

function createSegment(id = 'a'): LocalTranscriptSegment {
  return {
    id,
    relativeStartSeconds: 0,
    relativeEndSeconds: 1.5,
    absoluteStartSeconds: 10,
    absoluteEndSeconds: 11.5,
    originalText: 'Bună ziua!',
    text: 'Bună ziua!',
    isEdited: false,
    editedAt: null,
  }
}
