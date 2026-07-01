import { describe, expect, it } from 'vitest'
import { mergeChunkTranscript } from '../../../electron/main/modules/local-transcription/mergeChunkTranscript'
import type { RawWhisperSegment } from '../../../electron/main/modules/local-transcription/buildNaturalTranscriptBlocks'

describe('mergeChunkTranscript', () => {
  it('removes an identical duplicate in the overlap', () => {
    expect(mergeChunkTranscript(
      [segment(0, 2, 'Buna ziua')],
      [segment(0.1, 2.1, 'Buna ziua')],
      0,
      3,
    )).toEqual([segment(0, 2, 'Buna ziua')])
  })

  it('removes a duplicate with different punctuation', () => {
    expect(mergeChunkTranscript(
      [segment(10, 12, 'Judecatoria Chisinau.')],
      [segment(10.1, 12.1, 'Judecatoria Chisinau')],
      9,
      13,
    )).toEqual([segment(10, 12, 'Judecatoria Chisinau.')])
  })

  it('removes a duplicate with different casing', () => {
    expect(mergeChunkTranscript(
      [segment(10, 12, 'Curtea de Apel Chisinau')],
      [segment(10.2, 12.2, 'curtea de apel chisinau')],
      9,
      13,
    )).toEqual([segment(10, 12, 'Curtea de Apel Chisinau')])
  })

  it('prefers a complete segment over a truncated one', () => {
    expect(mergeChunkTranscript(
      [segment(10, 11, 'Procuratura Anticoruptie')],
      [segment(9.9, 12.2, 'Procuratura Anticoruptie a anuntat cauza')],
      9,
      13,
    )).toEqual([segment(9.9, 12.2, 'Procuratura Anticoruptie a anuntat cauza')])
  })

  it('keeps different text in the same overlap area', () => {
    expect(mergeChunkTranscript(
      [segment(10, 12, 'Judecatorul intra in sala')],
      [segment(10.1, 12.1, 'Avocatul cere amanarea')],
      9,
      13,
    )).toEqual([
      segment(10, 12, 'Judecatorul intra in sala'),
      segment(10.1, 12.1, 'Avocatul cere amanarea'),
    ])
  })

  it('does not compare segments when there is no overlap window', () => {
    expect(mergeChunkTranscript(
      [segment(10, 12, 'Text identic')],
      [segment(10.1, 12.1, 'Text identic')],
      20,
      20,
    )).toEqual([
      segment(10, 12, 'Text identic'),
      segment(10.1, 12.1, 'Text identic'),
    ])
  })

  it('sorts the merged result by start time', () => {
    expect(mergeChunkTranscript(
      [segment(20, 21, 'Al doilea')],
      [segment(10, 11, 'Primul')],
      0,
      0,
    )).toEqual([
      segment(10, 11, 'Primul'),
      segment(20, 21, 'Al doilea'),
    ])
  })
})

function segment(startSeconds: number, endSeconds: number, text: string): RawWhisperSegment {
  return {
    startSeconds,
    endSeconds,
    text,
  }
}
