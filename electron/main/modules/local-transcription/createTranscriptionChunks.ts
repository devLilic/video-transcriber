export interface TranscriptionChunk {
  index: number
  startSeconds: number
  endSeconds: number
  durationSeconds: number
  overlapBeforeSeconds: number
  overlapAfterSeconds: number
}

export interface CreateTranscriptionChunksInput {
  inSeconds: number
  outSeconds: number
  targetChunkSeconds?: number
  overlapSeconds?: number
}

const DEFAULT_TARGET_CHUNK_SECONDS = 30
const DEFAULT_OVERLAP_SECONDS = 1
const MAX_SEGMENT_SECONDS = 1800
const MIN_FINAL_CHUNK_SECONDS = 2

export function createTranscriptionChunks(input: CreateTranscriptionChunksInput): TranscriptionChunk[] {
  const targetChunkSeconds = input.targetChunkSeconds ?? DEFAULT_TARGET_CHUNK_SECONDS
  const overlapSeconds = input.overlapSeconds ?? DEFAULT_OVERLAP_SECONDS

  validateInput(input.inSeconds, input.outSeconds, targetChunkSeconds, overlapSeconds)

  const durationSeconds = input.outSeconds - input.inSeconds

  if (durationSeconds <= targetChunkSeconds) {
    return [createChunk(0, input.inSeconds, input.outSeconds, undefined, undefined)]
  }

  const chunks: Array<Pick<TranscriptionChunk, 'startSeconds' | 'endSeconds'>> = []
  let startSeconds = input.inSeconds

  while (startSeconds < input.outSeconds) {
    const endSeconds = Math.min(startSeconds + targetChunkSeconds, input.outSeconds)
    chunks.push({ startSeconds, endSeconds })

    if (endSeconds === input.outSeconds) {
      break
    }

    startSeconds = endSeconds - overlapSeconds
  }

  const lastChunk = chunks.at(-1)
  const previousChunk = chunks.at(-2)

  if (
    lastChunk
    && previousChunk
    && lastChunk.endSeconds - lastChunk.startSeconds < MIN_FINAL_CHUNK_SECONDS
  ) {
    previousChunk.endSeconds = input.outSeconds
    chunks.pop()
  }

  return chunks.map((chunk, index) => createChunk(
    index,
    chunk.startSeconds,
    chunk.endSeconds,
    chunks[index - 1],
    chunks[index + 1],
  ))
}

function createChunk(
  index: number,
  startSeconds: number,
  endSeconds: number,
  previousChunk: Pick<TranscriptionChunk, 'startSeconds' | 'endSeconds'> | undefined,
  nextChunk: Pick<TranscriptionChunk, 'startSeconds' | 'endSeconds'> | undefined,
): TranscriptionChunk {
  return {
    index,
    startSeconds,
    endSeconds,
    durationSeconds: endSeconds - startSeconds,
    overlapBeforeSeconds: previousChunk
      ? Math.max(0, previousChunk.endSeconds - startSeconds)
      : 0,
    overlapAfterSeconds: nextChunk
      ? Math.max(0, endSeconds - nextChunk.startSeconds)
      : 0,
  }
}

function validateInput(
  inSeconds: number,
  outSeconds: number,
  targetChunkSeconds: number,
  overlapSeconds: number,
) {
  if (!Number.isFinite(inSeconds) || inSeconds < 0) {
    throw new Error('Invalid transcription chunk IN time.')
  }

  if (!Number.isFinite(outSeconds) || outSeconds <= inSeconds) {
    throw new Error('Invalid transcription chunk OUT time.')
  }

  if (outSeconds - inSeconds > MAX_SEGMENT_SECONDS) {
    throw new Error('Transcription segment is too long.')
  }

  if (!Number.isFinite(targetChunkSeconds) || targetChunkSeconds <= 0) {
    throw new Error('Invalid transcription chunk size.')
  }

  if (!Number.isFinite(overlapSeconds) || overlapSeconds < 0) {
    throw new Error('Invalid transcription chunk overlap.')
  }

  if (overlapSeconds >= targetChunkSeconds / 2) {
    throw new Error('Transcription chunk overlap must be smaller than half of the chunk size.')
  }
}
