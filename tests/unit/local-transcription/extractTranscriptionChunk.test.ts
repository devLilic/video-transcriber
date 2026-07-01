import { describe, expect, it } from 'vitest'
import {
  buildExtractTranscriptionChunkArgs,
  createTranscriptionChunkFileName,
  getTranscriptionChunkDuration,
} from '../../../electron/main/modules/local-transcription/extractTranscriptionChunk'

describe('buildExtractTranscriptionChunkArgs', () => {
  it('builds FFmpeg arguments for a transcription chunk', () => {
    expect(buildExtractTranscriptionChunkArgs({
      sourcePath: 'D:/video/input.mp4',
      outputPath: 'D:/chunks/chunk-000.wav',
      chunkStartSeconds: 10.5,
      chunkEndSeconds: 40.25,
      sourceInSeconds: 10,
    })).toEqual([
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      '10.5',
      '-i',
      'D:/video/input.mp4',
      '-t',
      '29.75',
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'pcm_s16le',
      '-y',
      'D:/chunks/chunk-000.wav',
    ])
  })

  it('keeps paths with spaces as individual spawn arguments', () => {
    const args = buildExtractTranscriptionChunkArgs({
      sourcePath: 'D:/video files/input video.mp4',
      outputPath: 'D:/chunk files/chunk-001.wav',
      chunkStartSeconds: 0,
      chunkEndSeconds: 30,
      sourceInSeconds: 0,
    })

    expect(args).toContain('D:/video files/input video.mp4')
    expect(args).toContain('D:/chunk files/chunk-001.wav')
  })
})

describe('getTranscriptionChunkDuration', () => {
  it('calculates duration from chunk end minus chunk start', () => {
    expect(getTranscriptionChunkDuration({
      chunkStartSeconds: 12.25,
      chunkEndSeconds: 18.75,
    })).toBe(6.5)
  })
})

describe('createTranscriptionChunkFileName', () => {
  it('formats chunk file names with three digits', () => {
    expect(createTranscriptionChunkFileName(0)).toBe('chunk-000.wav')
    expect(createTranscriptionChunkFileName(1)).toBe('chunk-001.wav')
    expect(createTranscriptionChunkFileName(12)).toBe('chunk-012.wav')
  })
})

describe('transcription chunk validation', () => {
  it('rejects invalid values', () => {
    expect(() => getTranscriptionChunkDuration({ chunkStartSeconds: -1, chunkEndSeconds: 2 })).toThrow(/greater than or equal to 0/)
    expect(() => getTranscriptionChunkDuration({ chunkStartSeconds: 2, chunkEndSeconds: 2 })).toThrow(/greater than start/)
    expect(() => getTranscriptionChunkDuration({ chunkStartSeconds: 1, chunkEndSeconds: 1.25 })).toThrow(/at least 0.5/)
    expect(() => getTranscriptionChunkDuration({ chunkStartSeconds: 0, chunkEndSeconds: 1800.1 })).toThrow(/cannot exceed 1800/)
    expect(() => buildExtractTranscriptionChunkArgs({
      sourcePath: 'D:/video/input.mp4',
      outputPath: 'D:/chunks/chunk-000.wav',
      chunkStartSeconds: 9,
      chunkEndSeconds: 12,
      sourceInSeconds: 10,
    })).toThrow(/before source IN/)
    expect(() => createTranscriptionChunkFileName(-1)).toThrow(/non-negative/)
  })
})
