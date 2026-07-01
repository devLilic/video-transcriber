import { describe, expect, it } from 'vitest'
import {
  buildExtractAudioArgs,
  getExtractAudioDuration,
  validateExtractAudioRange,
} from '../../../electron/main/modules/local-transcription/extractAudioSegment'

describe('buildExtractAudioArgs', () => {
  it('builds FFmpeg arguments for mono 16 kHz PCM WAV output', () => {
    expect(buildExtractAudioArgs({
      sourcePath: 'D:/video/input.mp4',
      outputPath: 'D:/audio/output.wav',
      inSeconds: 10.5,
      outSeconds: 45.25,
    })).toEqual([
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      '10.5',
      '-i',
      'D:/video/input.mp4',
      '-t',
      '34.75',
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'pcm_s16le',
      '-y',
      'D:/audio/output.wav',
    ])
  })
})

describe('validateExtractAudioRange', () => {
  it('accepts a valid segment interval', () => {
    expect(() => validateExtractAudioRange(0, 0.5)).not.toThrow()
  })

  it('rejects invalid segment intervals', () => {
    expect(() => validateExtractAudioRange(-1, 2)).toThrow(/greater than or equal to 0/)
    expect(() => validateExtractAudioRange(2, 2)).toThrow(/greater than IN/)
    expect(() => validateExtractAudioRange(1, 1.25)).toThrow(/at least 0.5/)
    expect(() => validateExtractAudioRange(0, 1800.1)).toThrow(/cannot exceed 1800/)
  })
})

describe('getExtractAudioDuration', () => {
  it('calculates segment duration from OUT minus IN', () => {
    expect(getExtractAudioDuration({ inSeconds: 12.25, outSeconds: 18.75 })).toBe(6.5)
  })
})
