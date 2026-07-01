import { describe, expect, it } from 'vitest'
import { createTranscriptionChunks } from '../../../electron/main/modules/local-transcription/createTranscriptionChunks'

describe('createTranscriptionChunks', () => {
  it('creates a single chunk for a 10 second segment', () => {
    expect(createTranscriptionChunks({ inSeconds: 5, outSeconds: 15 })).toEqual([
      {
        index: 0,
        startSeconds: 5,
        endSeconds: 15,
        durationSeconds: 10,
        overlapBeforeSeconds: 0,
        overlapAfterSeconds: 0,
      },
    ])
  })

  it('creates a single chunk for a 30 second segment', () => {
    expect(createTranscriptionChunks({ inSeconds: 0, outSeconds: 30 })).toHaveLength(1)
  })

  it('creates overlapping chunks for a 31 second segment', () => {
    expect(createTranscriptionChunks({ inSeconds: 0, outSeconds: 31 }).map(toRange)).toEqual([
      [0, 30],
      [29, 31],
    ])
  })

  it('creates approximately 30 second chunks for a 75 second segment', () => {
    expect(createTranscriptionChunks({ inSeconds: 10, outSeconds: 85 }).map(toRange)).toEqual([
      [10, 40],
      [39, 69],
      [68, 85],
    ])
  })

  it('extends the previous chunk when the final chunk would be too short', () => {
    expect(createTranscriptionChunks({
      inSeconds: 0,
      outSeconds: 58.5,
      targetChunkSeconds: 30,
      overlapSeconds: 1,
    }).map(toRange)).toEqual([
      [0, 30],
      [29, 58.5],
    ])
  })

  it('records overlap between neighboring chunks', () => {
    const chunks = createTranscriptionChunks({ inSeconds: 0, outSeconds: 75 })

    expect(chunks[0].overlapAfterSeconds).toBe(1)
    expect(chunks[1].overlapBeforeSeconds).toBe(1)
    expect(chunks[1].overlapAfterSeconds).toBe(1)
    expect(chunks[2].overlapBeforeSeconds).toBe(1)
  })

  it('rejects invalid input', () => {
    expect(() => createTranscriptionChunks({ inSeconds: -1, outSeconds: 10 })).toThrow(/IN time/)
    expect(() => createTranscriptionChunks({ inSeconds: 10, outSeconds: 10 })).toThrow(/OUT time/)
    expect(() => createTranscriptionChunks({ inSeconds: 0, outSeconds: 1801 })).toThrow(/too long/)
    expect(() => createTranscriptionChunks({ inSeconds: 0, outSeconds: 10, overlapSeconds: -1 })).toThrow(/overlap/)
    expect(() => createTranscriptionChunks({ inSeconds: 0, outSeconds: 10, targetChunkSeconds: 10, overlapSeconds: 5 })).toThrow(/half/)
  })
})

function toRange(chunk: { startSeconds: number; endSeconds: number }) {
  return [chunk.startSeconds, chunk.endSeconds]
}
