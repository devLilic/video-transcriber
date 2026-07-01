import { describe, expect, it } from 'vitest'
import {
  buildWhisperArgs,
  parseWhisperProgressLine,
  resolveWhisperThreadCount,
} from '../../../electron/main/modules/local-transcription/whisperCommand'

describe('buildWhisperArgs', () => {
  it('builds spawn-ready whisper.cpp arguments', () => {
    expect(buildWhisperArgs({
      modelPath: 'D:/models/ggml-small-q5_1.bin',
      audioPath: 'D:/audio/segment.wav',
      outputBasePath: 'D:/output/transcript',
      language: 'ro',
      threads: 6,
    })).toEqual([
      '--model',
      'D:/models/ggml-small-q5_1.bin',
      '--file',
      'D:/audio/segment.wav',
      '--language',
      'ro',
      '--output-json-full',
      '--output-file',
      'D:/output/transcript',
      '--print-progress',
      '--no-gpu',
      '--suppress-nst',
      '--threads',
      '6',
      '--temperature',
      '0',
      '--beam-size',
      '5',
    ])
  })
})

describe('parseWhisperProgressLine', () => {
  it('parses progress percentages from whisper output', () => {
    expect(parseWhisperProgressLine('progress =  35%')).toBe(35)
    expect(parseWhisperProgressLine('progress = 100%')).toBe(100)
  })

  it('returns null for unrelated or invalid lines', () => {
    expect(parseWhisperProgressLine('loading model')).toBeNull()
    expect(parseWhisperProgressLine('progress = -1%')).toBeNull()
    expect(parseWhisperProgressLine('progress = 101%')).toBeNull()
  })
})

describe('resolveWhisperThreadCount', () => {
  it('keeps at least one thread and at most eight', () => {
    expect(resolveWhisperThreadCount(0)).toBe(1)
    expect(resolveWhisperThreadCount(1)).toBe(1)
    expect(resolveWhisperThreadCount(32)).toBe(8)
  })

  it('leaves one CPU free when more than two CPUs are available', () => {
    expect(resolveWhisperThreadCount(2)).toBe(2)
    expect(resolveWhisperThreadCount(4)).toBe(3)
    expect(resolveWhisperThreadCount(8)).toBe(7)
  })
})
