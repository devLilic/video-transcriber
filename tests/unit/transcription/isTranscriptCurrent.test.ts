import { describe, expect, it } from 'vitest'
import { isTranscriptCurrent } from '../../../src/features/transcription/isTranscriptCurrent'
import type { StoredLocalTranscription } from '../../../src/shared/projects/types'

const baseTranscription: StoredLocalTranscription = {
  engine: 'whisper.cpp',
  model: 'small-q5_1',
  language: 'ro',
  sourceSelection: {
    inSeconds: 10,
    outSeconds: 20,
  },
  fullText: 'Salut.',
  segments: [],
  createdAt: '2026-07-01T00:00:00.000Z',
}

describe('isTranscriptCurrent', () => {
  it('accepts an identical selection', () => {
    expect(isTranscriptCurrent(baseTranscription, { inSeconds: 10, outSeconds: 20 })).toBe(true)
  })

  it('accepts a difference below tolerance', () => {
    expect(isTranscriptCurrent(baseTranscription, { inSeconds: 10.0005, outSeconds: 19.9995 })).toBe(true)
  })

  it('rejects a difference above tolerance', () => {
    expect(isTranscriptCurrent(baseTranscription, { inSeconds: 10.002, outSeconds: 20 })).toBe(false)
  })

  it('rejects invalid data', () => {
    expect(isTranscriptCurrent({ ...baseTranscription, sourceSelection: { inSeconds: 20, outSeconds: 10 } }, { inSeconds: 10, outSeconds: 20 })).toBe(false)
    expect(isTranscriptCurrent(baseTranscription, { inSeconds: Number.NaN, outSeconds: 20 })).toBe(false)
    expect(isTranscriptCurrent(null, { inSeconds: 10, outSeconds: 20 })).toBe(false)
  })
})
