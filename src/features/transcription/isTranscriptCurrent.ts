import type { SegmentSelection } from '@/shared/media/types'
import type { StoredLocalTranscription } from '@/shared/projects/types'

export const TRANSCRIPT_SELECTION_TOLERANCE_SECONDS = 0.001

export function isTranscriptCurrent(
  transcription: unknown,
  selection: SegmentSelection | null | undefined,
): transcription is StoredLocalTranscription {
  if (!isStoredLocalTranscription(transcription) || !isSelection(selection)) {
    return false
  }

  return Math.abs(transcription.sourceSelection.inSeconds - selection.inSeconds) <= TRANSCRIPT_SELECTION_TOLERANCE_SECONDS
    && Math.abs(transcription.sourceSelection.outSeconds - selection.outSeconds) <= TRANSCRIPT_SELECTION_TOLERANCE_SECONDS
}

function isStoredLocalTranscription(value: unknown): value is StoredLocalTranscription {
  return isRecord(value)
    && value.engine === 'whisper.cpp'
    && value.model === 'small-q5_1'
    && value.language === 'ro'
    && isSelection(value.sourceSelection)
    && typeof value.fullText === 'string'
    && Array.isArray(value.segments)
    && typeof value.createdAt === 'string'
}

function isSelection(value: unknown): value is SegmentSelection {
  if (!isRecord(value)) {
    return false
  }

  const { inSeconds, outSeconds } = value

  return typeof inSeconds === 'number'
    && typeof outSeconds === 'number'
    && Number.isFinite(inSeconds)
    && Number.isFinite(outSeconds)
    && inSeconds >= 0
    && inSeconds < outSeconds
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
