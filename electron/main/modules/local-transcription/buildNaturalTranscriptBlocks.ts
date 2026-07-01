export interface RawWhisperSegment {
  startSeconds: number
  endSeconds: number
  text: string
}

export interface NaturalTranscriptBlock {
  id: string
  relativeStartSeconds: number
  relativeEndSeconds: number
  absoluteStartSeconds: number
  absoluteEndSeconds: number
  originalText: string
  text: string
  isEdited: boolean
  editedAt: string | null
}

const TARGET_MIN_WORDS = 8
const TARGET_MAX_WORDS = 15
const TARGET_MIN_SECONDS = 6
const TARGET_MAX_SECONDS = 10
const NATURAL_PAUSE_SECONDS = 0.65
const HARD_PAUSE_SECONDS = 1.2

export function buildNaturalTranscriptBlocks(
  segments: RawWhisperSegment[],
  sourceInSeconds: number,
): NaturalTranscriptBlock[] {
  validateSourceIn(sourceInSeconds)

  const blocks: NaturalTranscriptBlock[] = []
  let currentSegments: RawWhisperSegment[] = []

  for (const segment of segments) {
    const normalizedSegment = normalizeRawSegment(segment)

    if (!normalizedSegment) {
      continue
    }

    const previousSegment = currentSegments.at(-1)
    const pauseBeforeSeconds = previousSegment
      ? normalizedSegment.startSeconds - previousSegment.endSeconds
      : 0

    if (currentSegments.length > 0 && pauseBeforeSeconds > HARD_PAUSE_SECONDS) {
      blocks.push(createBlock(blocks.length, currentSegments, sourceInSeconds))
      currentSegments = []
    } else if (currentSegments.length > 0 && hasTerminalPunctuation(joinSegmentText(currentSegments))) {
      blocks.push(createBlock(blocks.length, currentSegments, sourceInSeconds))
      currentSegments = []
    }

    currentSegments.push(normalizedSegment)

    if (shouldCloseBlock(currentSegments, pauseBeforeSeconds)) {
      blocks.push(createBlock(blocks.length, currentSegments, sourceInSeconds))
      currentSegments = []
    }
  }

  if (currentSegments.length > 0) {
    blocks.push(createBlock(blocks.length, currentSegments, sourceInSeconds))
  }

  return blocks
}

function shouldCloseBlock(segments: RawWhisperSegment[], pauseBeforeLastSeconds: number) {
  const text = joinSegmentText(segments)
  const wordCount = countWords(text)
  const durationSeconds = getBlockDuration(segments)
  const endsAtPunctuation = hasTerminalPunctuation(text)
  const hasNaturalPause = pauseBeforeLastSeconds >= NATURAL_PAUSE_SECONDS
  const hasMultipleSegments = segments.length > 1

  if (durationSeconds >= TARGET_MAX_SECONDS) {
    return true
  }

  if (hasMultipleSegments && wordCount > TARGET_MAX_WORDS && (endsAtPunctuation || hasNaturalPause)) {
    return true
  }

  if (wordCount >= TARGET_MIN_WORDS && (endsAtPunctuation || hasNaturalPause)) {
    return true
  }

  if (durationSeconds >= TARGET_MIN_SECONDS && (endsAtPunctuation || hasNaturalPause)) {
    return true
  }

  return false
}

function hasTerminalPunctuation(text: string) {
  return /[.!?:;]$/.test(text)
}

function createBlock(
  index: number,
  segments: RawWhisperSegment[],
  sourceInSeconds: number,
): NaturalTranscriptBlock {
  const relativeStartSeconds = segments[0].startSeconds
  const relativeEndSeconds = segments.at(-1)?.endSeconds ?? relativeStartSeconds
  const text = joinSegmentText(segments)

  return {
    id: `block-${index}-${formatStableTime(relativeStartSeconds)}-${formatStableTime(relativeEndSeconds)}`,
    relativeStartSeconds,
    relativeEndSeconds,
    absoluteStartSeconds: sourceInSeconds + relativeStartSeconds,
    absoluteEndSeconds: sourceInSeconds + relativeEndSeconds,
    originalText: text,
    text,
    isEdited: false,
    editedAt: null,
  }
}

function normalizeRawSegment(segment: RawWhisperSegment): RawWhisperSegment | null {
  if (
    !Number.isFinite(segment.startSeconds)
    || !Number.isFinite(segment.endSeconds)
    || segment.startSeconds < 0
    || segment.endSeconds < segment.startSeconds
  ) {
    throw new Error('Invalid raw whisper segment timecodes.')
  }

  const text = normalizeText(segment.text)

  if (!text) {
    return null
  }

  return {
    startSeconds: segment.startSeconds,
    endSeconds: segment.endSeconds,
    text,
  }
}

function joinSegmentText(segments: RawWhisperSegment[]) {
  return normalizeText(segments.map((segment) => segment.text).join(' '))
}

function normalizeText(text: string) {
  return text.trim().replace(/\s+/g, ' ')
}

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length
}

function getBlockDuration(segments: RawWhisperSegment[]) {
  const firstSegment = segments[0]
  const lastSegment = segments.at(-1)

  if (!firstSegment || !lastSegment) {
    return 0
  }

  return lastSegment.endSeconds - firstSegment.startSeconds
}

function validateSourceIn(sourceInSeconds: number) {
  if (!Number.isFinite(sourceInSeconds) || sourceInSeconds < 0) {
    throw new Error('Invalid source IN for natural transcript blocks.')
  }
}

function formatStableTime(value: number) {
  return Math.round(value * 1000)
}
