import type {
  LocalTranscriptSegment,
  LocalTranscriptionResult,
} from '../../../../src/shared/local-transcription/types'

export type {
  LocalTranscriptSegment,
  LocalTranscriptionResult,
} from '../../../../src/shared/local-transcription/types'

interface WhisperJsonSegment {
  offsets?: {
    from?: unknown
    to?: unknown
  }
  text?: unknown
}

export function parseWhisperResult(
  rawJson: unknown,
  sourceInSeconds: number,
  sourceOutSeconds: number,
): LocalTranscriptionResult {
  validateSourceBounds(sourceInSeconds, sourceOutSeconds)

  const transcription = getWhisperTranscription(rawJson)
  const segmentDuration = sourceOutSeconds - sourceInSeconds
  const segments = transcription
    .map((segment, index) => normalizeWhisperSegment(segment, index, sourceInSeconds, segmentDuration))
    .filter((segment): segment is LocalTranscriptSegment => segment !== null)

  return {
    engine: 'whisper.cpp',
    model: 'small-q5_1',
    language: 'ro',
    sourceInSeconds,
    sourceOutSeconds,
    fullText: segments.map((segment) => segment.text).join(' '),
    segments,
  }
}

function getWhisperTranscription(rawJson: unknown): WhisperJsonSegment[] {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('Invalid whisper.cpp JSON result: expected an object.')
  }

  const transcription = (rawJson as { transcription?: unknown }).transcription

  if (!Array.isArray(transcription)) {
    throw new Error('Invalid whisper.cpp JSON result: transcription must be an array.')
  }

  return transcription as WhisperJsonSegment[]
}

function normalizeWhisperSegment(
  segment: WhisperJsonSegment,
  index: number,
  sourceInSeconds: number,
  segmentDuration: number,
): LocalTranscriptSegment | null {
  const text = typeof segment.text === 'string' ? segment.text.trim() : ''

  if (!text) {
    return null
  }

  const fromMs = segment.offsets?.from
  const toMs = segment.offsets?.to

  if (typeof fromMs !== 'number' || typeof toMs !== 'number') {
    throw new Error('Invalid whisper.cpp JSON result: segment offsets must be numbers.')
  }

  const relativeStartSeconds = clamp(fromMs / 1000, 0, segmentDuration)
  const relativeEndSeconds = clamp(toMs / 1000, relativeStartSeconds, segmentDuration)
  const absoluteStartSeconds = sourceInSeconds + relativeStartSeconds
  const absoluteEndSeconds = sourceInSeconds + relativeEndSeconds

  return {
    id: `seg-${index}-${formatStableTime(relativeStartSeconds)}-${formatStableTime(relativeEndSeconds)}`,
    relativeStartSeconds,
    relativeEndSeconds,
    absoluteStartSeconds,
    absoluteEndSeconds,
    originalText: text,
    text,
    isEdited: false,
    editedAt: null,
  }
}

function validateSourceBounds(sourceInSeconds: number, sourceOutSeconds: number) {
  if (
    !Number.isFinite(sourceInSeconds)
    || !Number.isFinite(sourceOutSeconds)
    || sourceInSeconds < 0
    || sourceOutSeconds <= sourceInSeconds
  ) {
    throw new Error('Invalid source segment bounds for whisper.cpp result.')
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function formatStableTime(value: number) {
  return Math.round(value * 1000)
}
