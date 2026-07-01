import type { LocalTranscriptSegment } from '../../../../src/shared/local-transcription/types'
import {
  buildTranscriptFullText,
  normalizeTranscriptSegmentText,
  resetTranscriptSegmentText,
  updateTranscriptSegmentText,
} from '../../../../src/shared/local-transcription/transcriptSegmentText'
import type { VideoProject } from '../../../../src/shared/projects/types'

export const MAX_TRANSCRIPT_SEGMENT_TEXT_LENGTH = 10000

export interface UpdateStoredTranscriptSegmentTextInput {
  transcriptionCreatedAt: string
  segmentId: string
  text: string
  editedAt: string
  updatedAt: string
}

export interface ResetStoredTranscriptSegmentTextInput {
  transcriptionCreatedAt: string
  segmentId: string
  updatedAt: string
}

export interface StoredTranscriptSegmentUpdateResult {
  project: VideoProject
  segment: LocalTranscriptSegment
  fullText: string
}

export function updateStoredTranscriptSegmentText(
  project: VideoProject | null,
  input: UpdateStoredTranscriptSegmentTextInput,
): StoredTranscriptSegmentUpdateResult {
  const normalizedText = normalizeTranscriptSegmentText(input.text)

  if (normalizedText.length > MAX_TRANSCRIPT_SEGMENT_TEXT_LENGTH) {
    throw new Error('Transcript segment text is too long.')
  }

  return updateStoredTranscriptSegment(project, input, (segment) => (
    updateTranscriptSegmentText(segment, normalizedText, input.editedAt)
  ))
}

export function resetStoredTranscriptSegmentText(
  project: VideoProject | null,
  input: ResetStoredTranscriptSegmentTextInput,
): StoredTranscriptSegmentUpdateResult {
  return updateStoredTranscriptSegment(project, input, resetTranscriptSegmentText)
}

function updateStoredTranscriptSegment(
  project: VideoProject | null,
  input: ResetStoredTranscriptSegmentTextInput,
  updateSegment: (segment: LocalTranscriptSegment) => LocalTranscriptSegment,
): StoredTranscriptSegmentUpdateResult {
  if (!project?.transcription) {
    throw new Error('Transcript not found.')
  }

  if (project.transcription.createdAt !== input.transcriptionCreatedAt) {
    throw new Error('Transcript version not found.')
  }

  const segmentIndex = project.transcription.segments.findIndex((segment) => segment.id === input.segmentId)

  if (segmentIndex < 0) {
    throw new Error('Transcript segment not found.')
  }

  const segments = project.transcription.segments.map((segment, index) => (
    index === segmentIndex ? updateSegment(segment) : segment
  ))
  const segment = segments[segmentIndex]
  const fullText = buildTranscriptFullText(segments)

  return {
    project: {
      ...project,
      transcription: {
        ...project.transcription,
        fullText,
        segments,
      },
      updatedAt: input.updatedAt,
    },
    segment,
    fullText,
  }
}
