import type { LocalTranscriptSegment } from './types'

export function updateTranscriptSegmentText(
  segment: LocalTranscriptSegment,
  nextText: string,
  editedAt: string,
): LocalTranscriptSegment {
  const text = normalizeTranscriptSegmentText(nextText)
  const isEdited = text !== segment.originalText

  return {
    ...segment,
    text,
    isEdited,
    editedAt: isEdited ? editedAt : null,
  }
}

export function resetTranscriptSegmentText(segment: LocalTranscriptSegment): LocalTranscriptSegment {
  return {
    ...segment,
    text: segment.originalText,
    isEdited: false,
    editedAt: null,
  }
}

export function buildTranscriptFullText(segments: LocalTranscriptSegment[]) {
  return segments.map((segment) => segment.text).join(' ')
}

export function normalizeTranscriptSegmentText(text: string) {
  return text.replace(/\r\n?/g, '\n').trim()
}
