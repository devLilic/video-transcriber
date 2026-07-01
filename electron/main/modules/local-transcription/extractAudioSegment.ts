import { spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { mediaSourceRegistry, type MediaSourceRegistry } from '../media/MediaSourceRegistry'
import { resolveLocalTranscriptionAssets } from './resolveLocalTranscriptionAssets'

const MIN_SEGMENT_DURATION_SECONDS = 0.5
const MAX_SEGMENT_DURATION_SECONDS = 1800
const MAX_STDERR_LENGTH = 8192

export interface ExtractAudioInput {
  sourcePath: string
  outputPath: string
  inSeconds: number
  outSeconds: number
}

export interface ExtractRegisteredAudioSegmentInput {
  videoId: string
  outputPath: string
  inSeconds: number
  outSeconds: number
  signal?: AbortSignal
  registry?: MediaSourceRegistry
  ffmpegPath?: string
}

export function getExtractAudioDuration(input: Pick<ExtractAudioInput, 'inSeconds' | 'outSeconds'>) {
  validateExtractAudioRange(input.inSeconds, input.outSeconds)
  return input.outSeconds - input.inSeconds
}

export function validateExtractAudioRange(inSeconds: number, outSeconds: number) {
  if (!Number.isFinite(inSeconds) || !Number.isFinite(outSeconds)) {
    throw new Error('Audio segment bounds must be finite numbers.')
  }

  if (inSeconds < 0) {
    throw new Error('Audio segment IN must be greater than or equal to 0.')
  }

  if (outSeconds <= inSeconds) {
    throw new Error('Audio segment OUT must be greater than IN.')
  }

  const duration = outSeconds - inSeconds

  if (duration < MIN_SEGMENT_DURATION_SECONDS) {
    throw new Error('Audio segment must be at least 0.5 seconds long.')
  }

  if (duration > MAX_SEGMENT_DURATION_SECONDS) {
    throw new Error('Audio segment cannot exceed 1800 seconds.')
  }
}

export function buildExtractAudioArgs(input: ExtractAudioInput): string[] {
  const duration = getExtractAudioDuration(input)

  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    formatSeconds(input.inSeconds),
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

export async function extractRegisteredAudioSegment({
  videoId,
  outputPath,
  inSeconds,
  outSeconds,
  signal,
  registry = mediaSourceRegistry,
  ffmpegPath,
}: ExtractRegisteredAudioSegmentInput) {
  const sourcePath = registry.get(videoId)

  if (!sourcePath) {
    throw new Error('Selected video is no longer available in the media registry.')
  }

  const mediaTools = ffmpegPath ? { ffmpegPath } : await resolveLocalTranscriptionAssets()
  const args = buildExtractAudioArgs({
    sourcePath,
    outputPath,
    inSeconds,
    outSeconds,
  })

  try {
    await runFfmpeg(mediaTools.ffmpegPath, args, signal)
  } catch (error) {
    await rm(outputPath, { force: true }).catch(() => undefined)
    throw error
  }
}

function runFfmpeg(ffmpegPath: string, args: string[], signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Audio extraction was cancelled.'))
      return
    }

    const child = spawn(ffmpegPath, args, {
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''

    const abort = () => {
      child.kill()
      reject(new Error('Audio extraction was cancelled.'))
    }

    signal?.addEventListener('abort', abort, { once: true })

    child.stderr.on('data', (chunk) => {
      stderr = appendLimited(stderr, chunk.toString())
    })
    child.on('error', (error) => {
      signal?.removeEventListener('abort', abort)
      reject(new Error(`FFmpeg failed to start: ${error.message}`))
    })
    child.on('close', (code) => {
      signal?.removeEventListener('abort', abort)

      if (signal?.aborted) {
        return
      }

      if (code !== 0) {
        reject(new Error(`FFmpeg audio extraction failed with exit code ${code}. ${stderr}`.trim()))
        return
      }

      resolve()
    })
  })
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
