import { spawn, type ChildProcess } from 'node:child_process'
import { cpus } from 'node:os'
import path from 'node:path'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { app } from 'electron'
import { mediaSourceRegistry, type MediaSourceRegistry } from '../media/MediaSourceRegistry'
import { validateExtractAudioRange } from './extractAudioSegment'
import { buildNaturalTranscriptBlocks, type RawWhisperSegment } from './buildNaturalTranscriptBlocks'
import { createTranscriptionChunks, type TranscriptionChunk } from './createTranscriptionChunks'
import {
  createTranscriptionChunkFileName,
  extractTranscriptionChunk,
} from './extractTranscriptionChunk'
import { mergeChunkTranscript } from './mergeChunkTranscript'
import {
  buildWhisperArgs,
  parseWhisperProgressLine,
  resolveWhisperThreadCount,
} from './whisperCommand'
import { resolveLocalTranscriptionAssets } from './resolveLocalTranscriptionAssets'
import type {
  LocalTranscriptSegment,
  LocalTranscriptionProgress,
  LocalTranscriptionResult,
  TranscriptBlocksAvailableEvent,
  TranscriptionPhase,
} from '../../../../src/shared/local-transcription/types'

export interface StartLocalTranscriptionInput {
  videoId: string
  inSeconds: number
  outSeconds: number
  signal?: AbortSignal
  onProgress?: (progress: LocalTranscriptionProgress) => void
  onBlocksAvailable?: (event: TranscriptBlocksAvailableEvent) => void
}

export interface LocalTranscriptionJob {
  jobId: string
  promise: Promise<LocalTranscriptionResult>
  cancel: () => void
}

export class LocalTranscriptionService {
  private activeJob: ActiveLocalTranscriptionJob | null = null

  constructor(private readonly registry: MediaSourceRegistry = mediaSourceRegistry) {}

  startTranscription(input: StartLocalTranscriptionInput): LocalTranscriptionJob {
    if (this.activeJob) {
      throw new Error('A local transcription job is already running.')
    }

    validateExtractAudioRange(input.inSeconds, input.outSeconds)

    const sourcePath = this.registry.get(input.videoId)

    if (!sourcePath) {
      throw new Error('Selected video is no longer available in the media registry.')
    }

    const job = new ActiveLocalTranscriptionJob()
    this.activeJob = job

    const promise = job.run({
      ...input,
      registry: this.registry,
    }).finally(() => {
      if (this.activeJob === job) {
        this.activeJob = null
      }
    })

    return {
      jobId: job.jobId,
      promise,
      cancel: () => job.abort(),
    }
  }

  async transcribeSegment(input: StartLocalTranscriptionInput): Promise<LocalTranscriptionResult> {
    return this.startTranscription(input).promise
  }
}

interface ActiveLocalTranscriptionJobInput extends StartLocalTranscriptionInput {
  registry: MediaSourceRegistry
}

class ActiveLocalTranscriptionJob {
  private readonly abortController = new AbortController()
  private readonly childProcesses = new Set<ChildProcess>()
  private tempDir: string | null = null

  readonly jobId = createJobId()

  async run(input: ActiveLocalTranscriptionJobInput): Promise<LocalTranscriptionResult> {
    const externalSignalAbort = () => this.abort()
    input.signal?.addEventListener('abort', externalSignalAbort, { once: true })

    try {
      this.tempDir = path.join(app.getPath('temp'), 'video-transcriber', this.jobId)
      await mkdir(this.tempDir, { recursive: true })

      const audioPath = path.join(this.tempDir, 'segment.wav')
      const outputBasePath = path.join(this.tempDir, 'transcript')
      const assets = await resolveLocalTranscriptionAssets()
      const sourcePath = input.registry.get(input.videoId)

      if (!sourcePath) {
        throw new Error('Selected video is no longer available in the media registry.')
      }

      const chunks = createTranscriptionChunks({
        inSeconds: input.inSeconds,
        outSeconds: input.outSeconds,
      })
      const totalDurationSeconds = input.outSeconds - input.inSeconds
      let acceptedSegments: RawWhisperSegment[] = []
      let emittedBlockCount = 0

      this.emitProgress(input, 'preparing', 0, 0, chunks.length)

      for (const chunk of chunks) {
        const chunkAudioPath = path.join(this.tempDir, createTranscriptionChunkFileName(chunk.index))
        const chunkOutputBasePath = path.join(this.tempDir, `chunk-${String(chunk.index).padStart(3, '0')}`)
        const chunkJsonPath = `${chunkOutputBasePath}.json`

        this.emitProgress(input, 'extracting-chunk', calculateBaseProgress(chunks, chunk.index), chunk.index, chunks.length)
        await extractTranscriptionChunk({
          sourcePath,
          outputPath: chunkAudioPath,
          chunkStartSeconds: chunk.startSeconds,
          chunkEndSeconds: chunk.endSeconds,
          sourceInSeconds: input.inSeconds,
        }, {
          signal: this.abortController.signal,
          ffmpegPath: assets.ffmpegPath,
        })

        this.emitProgress(input, 'transcribing-chunk', calculateBaseProgress(chunks, chunk.index), chunk.index, chunks.length)
        await this.runWhisper({
          whisperCliPath: assets.whisperCliPath,
          modelPath: assets.whisperModelPath,
          audioPath: chunkAudioPath,
          outputBasePath: chunkOutputBasePath,
          onWhisperProgress: (whisperProgress) => {
            this.emitProgress(
              input,
              'transcribing-chunk',
              calculateProgressWithCurrentChunk(chunks, chunk.index, whisperProgress / 100),
              chunk.index,
              chunks.length,
            )
          },
        })

        this.emitProgress(input, 'merging', calculateProgressWithCurrentChunk(chunks, chunk.index, 1), chunk.index, chunks.length)
        const rawJson = JSON.parse(await readFile(chunkJsonPath, 'utf8')) as unknown
        const incomingSegments = parseWhisperRawSegments(rawJson, chunk, input.inSeconds)
        const previousChunk = chunks[chunk.index - 1]

        acceptedSegments = previousChunk
          ? mergeChunkTranscript(
            acceptedSegments,
            incomingSegments,
            chunk.startSeconds - input.inSeconds,
            previousChunk.endSeconds - input.inSeconds,
          )
          : mergeChunkTranscript(acceptedSegments, incomingSegments, 0, 0)

        const blocks = buildNaturalTranscriptBlocks(acceptedSegments, input.inSeconds)
        const emittableBlocks = getNewEmittableBlocks(blocks, emittedBlockCount, chunks[chunk.index + 1])

        if (emittableBlocks.length > 0) {
          emittedBlockCount += emittableBlocks.length
          input.onBlocksAvailable?.({
            jobId: this.jobId,
            chunkIndex: chunk.index,
            blocks: emittableBlocks,
            completedDurationSeconds: Math.min(chunk.endSeconds, input.outSeconds) - input.inSeconds,
            totalDurationSeconds,
          })
        }

        await rm(chunkAudioPath, { force: true }).catch(() => undefined)
      }

      const finalBlocks = buildNaturalTranscriptBlocks(acceptedSegments, input.inSeconds)
      const result: LocalTranscriptionResult = {
        engine: 'whisper.cpp',
        model: 'small-q5_1',
        language: 'ro',
        sourceInSeconds: input.inSeconds,
        sourceOutSeconds: input.outSeconds,
        fullText: finalBlocks.map((block) => block.text).join(' '),
        segments: finalBlocks,
      }

      this.emitProgress(input, 'completed', 100, Math.max(0, chunks.length - 1), chunks.length)

      return result
    } finally {
      input.signal?.removeEventListener('abort', externalSignalAbort)
      this.stopChildren()

      if (this.tempDir) {
        await rm(this.tempDir, { recursive: true, force: true }).catch(() => undefined)
      }
    }
  }

  abort() {
    this.abortController.abort()
    this.stopChildren()
  }

  private runWhisper({
    whisperCliPath,
    modelPath,
    audioPath,
    outputBasePath,
    onWhisperProgress,
  }: {
    whisperCliPath: string
    modelPath: string
    audioPath: string
    outputBasePath: string
    onWhisperProgress: (percent: number) => void
  }) {
    const args = buildWhisperArgs({
      modelPath,
      audioPath,
      outputBasePath,
      language: 'ro',
      threads: resolveWhisperThreadCount(cpus().length),
    })

    return new Promise<void>((resolve, reject) => {
      if (this.abortController.signal.aborted) {
        reject(new Error('Local transcription was cancelled.'))
        return
      }

      const child = spawn(whisperCliPath, args, {
        windowsHide: true,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let stderr = ''
      let settled = false

      const settle = (callback: () => void) => {
        if (settled) {
          return
        }

        settled = true
        this.abortController.signal.removeEventListener('abort', abort)
        this.childProcesses.delete(child)
        callback()
      }
      const abort = () => {
        child.kill()
        settle(() => reject(new Error('Local transcription was cancelled.')))
      }
      const handleOutput = (chunk: Buffer) => {
        for (const line of chunk.toString().split(/\r?\n/)) {
          const progress = parseWhisperProgressLine(line)

          if (progress !== null) {
            onWhisperProgress(progress)
          }
        }
      }

      this.childProcesses.add(child)
      this.abortController.signal.addEventListener('abort', abort, { once: true })

      child.stdout.on('data', handleOutput)
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = appendLimited(stderr, chunk.toString())
        handleOutput(chunk)
      })
      child.on('error', (error) => {
        settle(() => reject(new Error(`whisper.cpp failed to start: ${error.message}`)))
      })
      child.on('close', (code) => {
        if (this.abortController.signal.aborted) {
          return
        }

        if (code !== 0) {
          settle(() => reject(new Error(`whisper.cpp transcription failed with exit code ${code}. ${stderr}`.trim())))
          return
        }

        settle(resolve)
      })
    })
  }

  private emitProgress(
    input: Pick<StartLocalTranscriptionInput, 'onProgress'>,
    phase: TranscriptionPhase,
    percent: number,
    chunkIndex: number,
    chunkCount: number,
  ) {
    input.onProgress?.({
      jobId: this.jobId,
      phase,
      percent: Math.min(Math.max(Math.round(percent), 0), 100),
      chunkIndex,
      chunkCount,
    })
  }

  private stopChildren() {
    for (const child of this.childProcesses) {
      child.kill()
    }

    this.childProcesses.clear()
  }
}

function createJobId() {
  return `local-transcription-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function appendLimited(current: string, next: string) {
  const combined = current + next
  const maxLength = 8192

  return combined.length > maxLength
    ? combined.slice(combined.length - maxLength)
    : combined
}

interface WhisperJsonSegment {
  offsets?: {
    from?: unknown
    to?: unknown
  }
  text?: unknown
}

function parseWhisperRawSegments(
  rawJson: unknown,
  chunk: TranscriptionChunk,
  sourceInSeconds: number,
): RawWhisperSegment[] {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('Invalid whisper.cpp JSON result: expected an object.')
  }

  const transcription = (rawJson as { transcription?: unknown }).transcription

  if (!Array.isArray(transcription)) {
    throw new Error('Invalid whisper.cpp JSON result: transcription must be an array.')
  }

  const chunkOffsetSeconds = chunk.startSeconds - sourceInSeconds
  const chunkRelativeEndSeconds = chunk.endSeconds - sourceInSeconds

  return (transcription as WhisperJsonSegment[])
    .map((segment) => {
      const text = typeof segment.text === 'string' ? segment.text.trim() : ''

      if (!text) {
        return null
      }

      const fromMs = segment.offsets?.from
      const toMs = segment.offsets?.to

      if (typeof fromMs !== 'number' || typeof toMs !== 'number') {
        throw new Error('Invalid whisper.cpp JSON result: segment offsets must be numbers.')
      }

      const startSeconds = clamp(chunkOffsetSeconds + (fromMs / 1000), chunkOffsetSeconds, chunkRelativeEndSeconds)
      const endSeconds = clamp(chunkOffsetSeconds + (toMs / 1000), startSeconds, chunkRelativeEndSeconds)

      return {
        startSeconds,
        endSeconds,
        text,
      }
    })
    .filter((segment): segment is RawWhisperSegment => segment !== null)
}

function getNewEmittableBlocks(
  blocks: LocalTranscriptSegment[],
  emittedBlockCount: number,
  nextChunk: TranscriptionChunk | undefined,
) {
  let nextEmitLimit = blocks.length

  if (nextChunk && blocks.length > emittedBlockCount) {
    const lastBlock = blocks.at(-1)

    if (lastBlock && lastBlock.absoluteEndSeconds > nextChunk.startSeconds) {
      nextEmitLimit = blocks.length - 1
    }
  }

  return blocks.slice(emittedBlockCount, Math.max(emittedBlockCount, nextEmitLimit))
}

function calculateBaseProgress(chunks: TranscriptionChunk[], chunkIndex: number) {
  const completedDuration = chunks
    .slice(0, chunkIndex)
    .reduce((sum, chunk) => sum + chunk.durationSeconds, 0)
  const totalDuration = chunks.reduce((sum, chunk) => sum + chunk.durationSeconds, 0)

  return totalDuration > 0 ? (completedDuration / totalDuration) * 100 : 0
}

function calculateProgressWithCurrentChunk(
  chunks: TranscriptionChunk[],
  chunkIndex: number,
  currentChunkRatio: number,
) {
  const completedDuration = chunks
    .slice(0, chunkIndex)
    .reduce((sum, chunk) => sum + chunk.durationSeconds, 0)
  const currentChunk = chunks[chunkIndex]
  const totalDuration = chunks.reduce((sum, chunk) => sum + chunk.durationSeconds, 0)

  if (!currentChunk || totalDuration <= 0) {
    return 0
  }

  return ((completedDuration + (currentChunk.durationSeconds * currentChunkRatio)) / totalDuration) * 100
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
