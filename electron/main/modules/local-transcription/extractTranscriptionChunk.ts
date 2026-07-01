import { spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { resolveLocalTranscriptionAssets } from './resolveLocalTranscriptionAssets'

const MIN_CHUNK_DURATION_SECONDS = 0.5
const MAX_CHUNK_DURATION_SECONDS = 1800
const MAX_STDERR_LENGTH = 8192

export interface ExtractTranscriptionChunkInput {
  sourcePath: string
  outputPath: string
  chunkStartSeconds: number
  chunkEndSeconds: number
  sourceInSeconds: number
}

export interface ExtractTranscriptionChunkOptions {
  signal?: AbortSignal
  ffmpegPath?: string
}

export function getTranscriptionChunkDuration(
  input: Pick<ExtractTranscriptionChunkInput, 'chunkStartSeconds' | 'chunkEndSeconds'>,
) {
  validateTranscriptionChunkRange(input.chunkStartSeconds, input.chunkEndSeconds)
  return input.chunkEndSeconds - input.chunkStartSeconds
}

export function buildExtractTranscriptionChunkArgs(input: ExtractTranscriptionChunkInput): string[] {
  const duration = getTranscriptionChunkDuration(input)

  validateChunkSourceIn(input)

  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    formatSeconds(input.chunkStartSeconds),
    '-i',
    input.sourcePath,
    '-t',
    formatSeconds(duration),
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    '-y',
    input.outputPath,
  ]
}

export async function extractTranscriptionChunk(
  input: ExtractTranscriptionChunkInput,
  options: ExtractTranscriptionChunkOptions = {},
) {
  const mediaTools = options.ffmpegPath ? { ffmpegPath: options.ffmpegPath } : await resolveLocalTranscriptionAssets()
  const args = buildExtractTranscriptionChunkArgs(input)

  try {
    await runFfmpeg(mediaTools.ffmpegPath, args, options.signal)
  } catch (error) {
    await rm(input.outputPath, { force: true }).catch(() => undefined)
    throw normalizeChunkExtractionError(error)
  }
}

export function createTranscriptionChunkFileName(index: number) {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('Chunk index must be a non-negative integer.')
  }

  return `chunk-${String(index).padStart(3, '0')}.wav`
}

function validateTranscriptionChunkRange(chunkStartSeconds: number, chunkEndSeconds: number) {
  if (!Number.isFinite(chunkStartSeconds) || !Number.isFinite(chunkEndSeconds)) {
    throw new Error('Transcription chunk bounds must be finite numbers.')
  }

  if (chunkStartSeconds < 0) {
    throw new Error('Transcription chunk start must be greater than or equal to 0.')
  }

  if (chunkEndSeconds <= chunkStartSeconds) {
    throw new Error('Transcription chunk end must be greater than start.')
  }

  const duration = chunkEndSeconds - chunkStartSeconds

  if (duration < MIN_CHUNK_DURATION_SECONDS) {
    throw new Error('Transcription chunk must be at least 0.5 seconds long.')
  }

  if (duration > MAX_CHUNK_DURATION_SECONDS) {
    throw new Error('Transcription chunk cannot exceed 1800 seconds.')
  }
}

function validateChunkSourceIn(input: Pick<ExtractTranscriptionChunkInput, 'chunkStartSeconds' | 'sourceInSeconds'>) {
  if (!Number.isFinite(input.sourceInSeconds) || input.sourceInSeconds < 0) {
    throw new Error('Source IN must be greater than or equal to 0.')
  }

  if (input.chunkStartSeconds < input.sourceInSeconds) {
    throw new Error('Transcription chunk cannot start before source IN.')
  }
}

function runFfmpeg(ffmpegPath: string, args: string[], signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Transcription chunk extraction was cancelled.'))
      return
    }

    const child = spawn(ffmpegPath, args, {
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    let settled = false

    const settle = (callback: () => void) => {
      if (settled) {
        return
      }

      settled = true
      signal?.removeEventListener('abort', abort)
      callback()
    }
    const abort = () => {
      child.kill()
      settle(() => reject(new Error('Transcription chunk extraction was cancelled.')))
    }

    signal?.addEventListener('abort', abort, { once: true })

    child.stderr.on('data', (chunk) => {
      stderr = appendLimited(stderr, chunk.toString())
    })
    child.on('error', (error) => {
      settle(() => reject(new Error(`FFmpeg failed to start: ${error.message}`)))
    })
    child.on('close', (code) => {
      if (signal?.aborted) {
        return
      }

      if (code !== 0) {
        settle(() => reject(new Error(`FFmpeg transcription chunk extraction failed with exit code ${code}. ${stderr}`.trim())))
        return
      }

      settle(resolve)
    })
  })
}

function normalizeChunkExtractionError(error: unknown) {
  if (error instanceof Error) {
    return error
  }

  return new Error('Transcription chunk extraction failed.')
}

function appendLimited(current: string, next: string) {
  const combined = current + next
  return combined.length > MAX_STDERR_LENGTH
    ? combined.slice(combined.length - MAX_STDERR_LENGTH)
    : combined
}

function formatSeconds(seconds: number) {
  return Number.isInteger(seconds) ? String(seconds) : String(Number(seconds.toFixed(3)))
}
