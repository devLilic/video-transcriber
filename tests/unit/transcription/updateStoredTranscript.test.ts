import { describe, expect, it } from 'vitest'
import {
  resetStoredTranscriptSegmentText,
  updateStoredTranscriptSegmentText,
} from '../../../electron/main/modules/projects/updateStoredTranscript'
import type { LocalTranscriptSegment } from '../../../src/shared/local-transcription/types'
import type { VideoProject } from '../../../src/shared/projects/types'

describe('updateStoredTranscript', () => {
  it('updates the matching segment', () => {
    const result = updateStoredTranscriptSegmentText(createProject(), {
      transcriptionCreatedAt: '2026-07-01T10:00:00.000Z',
      segmentId: 'b',
      text: '  Text corectat.\r\nLinia doi.  ',
      editedAt: '2026-07-01T11:00:00.000Z',
      updatedAt: '2026-07-01T11:00:00.000Z',
    })

    expect(result.segment).toMatchObject({
      id: 'b',
      originalText: 'Text automat.',
      text: 'Text corectat.\nLinia doi.',
      isEdited: true,
      editedAt: '2026-07-01T11:00:00.000Z',
    })
  })

  it('preserves segment timecodes', () => {
    const project = createProject()
    const original = project.transcription?.segments[1]
    const result = updateStoredTranscriptSegmentText(project, {
      transcriptionCreatedAt: '2026-07-01T10:00:00.000Z',
      segmentId: 'b',
      text: 'Text corectat.',
      editedAt: '2026-07-01T11:00:00.000Z',
      updatedAt: '2026-07-01T11:00:00.000Z',
    })

    expect(result.segment.relativeStartSeconds).toBe(original?.relativeStartSeconds)
    expect(result.segment.relativeEndSeconds).toBe(original?.relativeEndSeconds)
    expect(result.segment.absoluteStartSeconds).toBe(original?.absoluteStartSeconds)
    expect(result.segment.absoluteEndSeconds).toBe(original?.absoluteEndSeconds)
  })

  it('rejects an unknown segment id', () => {
    expect(() => updateStoredTranscriptSegmentText(createProject(), {
      transcriptionCreatedAt: '2026-07-01T10:00:00.000Z',
      segmentId: 'missing',
      text: 'Text.',
      editedAt: '2026-07-01T11:00:00.000Z',
      updatedAt: '2026-07-01T11:00:00.000Z',
    })).toThrow(/segment not found/i)
  })

  it('rejects segment text that is too long', () => {
    expect(() => updateStoredTranscriptSegmentText(createProject(), {
      transcriptionCreatedAt: '2026-07-01T10:00:00.000Z',
      segmentId: 'b',
      text: 'a'.repeat(10001),
      editedAt: '2026-07-01T11:00:00.000Z',
      updatedAt: '2026-07-01T11:00:00.000Z',
    })).toThrow(/too long/i)
  })

  it('rebuilds fullText from stored segment text', () => {
    const result = updateStoredTranscriptSegmentText(createProject(), {
      transcriptionCreatedAt: '2026-07-01T10:00:00.000Z',
      segmentId: 'b',
      text: 'Text corectat.',
      editedAt: '2026-07-01T11:00:00.000Z',
      updatedAt: '2026-07-01T11:00:00.000Z',
    })

    expect(result.fullText).toBe('Salut. Text corectat.')
    expect(result.project.transcription?.fullText).toBe('Salut. Text corectat.')
  })

  it('resets a segment to the automatic text', () => {
    const edited = updateStoredTranscriptSegmentText(createProject(), {
      transcriptionCreatedAt: '2026-07-01T10:00:00.000Z',
      segmentId: 'b',
      text: 'Text corectat.',
      editedAt: '2026-07-01T11:00:00.000Z',
      updatedAt: '2026-07-01T11:00:00.000Z',
    })
    const reset = resetStoredTranscriptSegmentText(edited.project, {
      transcriptionCreatedAt: '2026-07-01T10:00:00.000Z',
      segmentId: 'b',
      updatedAt: '2026-07-01T12:00:00.000Z',
    })

    expect(reset.segment.text).toBe('Text automat.')
    expect(reset.segment.isEdited).toBe(false)
    expect(reset.segment.editedAt).toBeNull()
    expect(reset.fullText).toBe('Salut. Text automat.')
  })
})

function createProject(): VideoProject {
  return {
    selection: {
      inSeconds: 10,
      outSeconds: 20,
    },
    transcription: {
      engine: 'whisper.cpp',
      model: 'small-q5_1',
      language: 'ro',
      sourceSelection: {
        inSeconds: 10,
        outSeconds: 20,
      },
      fullText: 'Salut. Text automat.',
      segments: [
        createSegment('a', 0, 1, 'Salut.'),
        createSegment('b', 1, 3, 'Text automat.'),
      ],
      createdAt: '2026-07-01T10:00:00.000Z',
    },
    updatedAt: '2026-07-01T10:00:00.000Z',
  }
}

function createSegment(id: string, start: number, end: number, text: string): LocalTranscriptSegment {
  return {
    id,
    relativeStartSeconds: start,
    relativeEndSeconds: end,
    absoluteStartSeconds: 10 + start,
    absoluteEndSeconds: 10 + end,
    originalText: text,
    text,
    isEdited: false,
    editedAt: null,
  }
}
