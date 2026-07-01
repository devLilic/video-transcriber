import { describe, expect, it } from 'vitest'
import {
  buildNaturalTranscriptBlocks,
  type RawWhisperSegment,
} from '../../../electron/main/modules/local-transcription/buildNaturalTranscriptBlocks'

describe('buildNaturalTranscriptBlocks', () => {
  it('groups segments after reaching the target word count at punctuation', () => {
    const blocks = buildNaturalTranscriptBlocks([
      segment(0, 2, 'Acesta este un test simplu'),
      segment(2, 4, 'pentru gruparea blocurilor naturale.'),
      segment(4, 6, 'Urmatorul incepe separat.'),
    ], 10)

    expect(blocks).toHaveLength(2)
    expect(blocks[0].text).toBe('Acesta este un test simplu pentru gruparea blocurilor naturale.')
  })

  it('groups segments after reaching the target duration at punctuation', () => {
    const blocks = buildNaturalTranscriptBlocks([
      segment(0, 3, 'Prima parte'),
      segment(3, 6.2, 'continua pana aici.'),
      segment(6.2, 8, 'Alta fraza.'),
    ], 0)

    expect(blocks).toHaveLength(2)
    expect(blocks[0].relativeEndSeconds).toBe(6.2)
  })

  it('separates blocks after sentence punctuation', () => {
    const blocks = buildNaturalTranscriptBlocks([
      segment(0, 1, 'Buna ziua.'),
      segment(1, 2, 'Acesta este al doilea bloc.'),
    ], 0)

    expect(blocks.map((block) => block.text)).toEqual([
      'Buna ziua.',
      'Acesta este al doilea bloc.',
    ])
  })

  it('separates blocks after a clear temporal pause', () => {
    const blocks = buildNaturalTranscriptBlocks([
      segment(0, 2, 'Vorbim despre dosarul civil'),
      segment(2.8, 4, 'si despre termen.'),
      segment(5.3, 6, 'Dupa pauza.'),
    ], 0)

    expect(blocks.map((block) => block.text)).toEqual([
      'Vorbim despre dosarul civil si despre termen.',
      'Dupa pauza.',
    ])
  })

  it('keeps a short final block', () => {
    const blocks = buildNaturalTranscriptBlocks([
      segment(0, 2, 'Acesta este un bloc complet.'),
      segment(2, 3, 'Final scurt'),
    ], 0)

    expect(blocks.at(-1)?.text).toBe('Final scurt')
  })

  it('keeps a very long single whisper segment intact', () => {
    const text = 'Acesta este un segment foarte lung care depaseste tinta de cincisprezece cuvinte dar ramane un singur segment whisper.'
    const blocks = buildNaturalTranscriptBlocks([
      segment(0, 11, text),
    ], 0)

    expect(blocks).toHaveLength(1)
    expect(blocks[0].text).toBe(text)
  })

  it('preserves Romanian diacritics and only normalizes spacing', () => {
    const blocks = buildNaturalTranscriptBlocks([
      segment(0, 1, '  Judecătoria   Chișinău  '),
      segment(1, 2, 'sediul Buiucani.'),
    ], 0)

    expect(blocks[0].text).toBe('Judecătoria Chișinău sediul Buiucani.')
    expect(blocks[0]).toMatchObject({
      originalText: 'Judecătoria Chișinău sediul Buiucani.',
      isEdited: false,
      editedAt: null,
    })
  })

  it('calculates absolute timecodes from source IN', () => {
    const blocks = buildNaturalTranscriptBlocks([
      segment(2.5, 8, 'Text cu timecode absolut.'),
    ], 100)

    expect(blocks[0]).toMatchObject({
      relativeStartSeconds: 2.5,
      relativeEndSeconds: 8,
      absoluteStartSeconds: 102.5,
      absoluteEndSeconds: 108,
    })
  })
})

function segment(startSeconds: number, endSeconds: number, text: string): RawWhisperSegment {
  return {
    startSeconds,
    endSeconds,
    text,
  }
}
