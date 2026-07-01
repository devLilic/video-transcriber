import { describe, expect, it } from 'vitest'
import fixture from './fixtures/whisperResult.json'
import { parseWhisperResult } from '../../../electron/main/modules/local-transcription/parseWhisperResult'

describe('parseWhisperResult', () => {
  it('converts millisecond offsets to relative seconds', () => {
    const result = parseWhisperResult(fixture, 10, 16)

    expect(result.segments[0].relativeStartSeconds).toBe(0)
    expect(result.segments[0].relativeEndSeconds).toBe(1.25)
    expect(result.segments[1].relativeStartSeconds).toBe(2.5)
    expect(result.segments[1].relativeEndSeconds).toBe(5)
  })

  it('calculates absolute timecodes from source IN', () => {
    const result = parseWhisperResult(fixture, 10, 16)

    expect(result.segments[0].absoluteStartSeconds).toBe(10)
    expect(result.segments[0].absoluteEndSeconds).toBe(11.25)
    expect(result.segments[1].absoluteStartSeconds).toBe(12.5)
    expect(result.segments[1].absoluteEndSeconds).toBe(15)
  })

  it('removes empty segments and trims text without removing punctuation', () => {
    const result = parseWhisperResult(fixture, 10, 16)

    expect(result.segments).toHaveLength(3)
    expect(result.segments.map((segment) => segment.text)).toEqual([
      'Bună ziua!',
      'Acesta este un test.',
      'Final.',
    ])
  })

  it('builds normalized fullText', () => {
    const result = parseWhisperResult(fixture, 10, 16)

    expect(result.fullText).toBe('Bună ziua! Acesta este un test. Final.')
  })

  it('clamps segment times to the selected source segment', () => {
    const result = parseWhisperResult(fixture, 10, 16)

    expect(result.segments[2].relativeEndSeconds).toBe(6)
    expect(result.segments[2].absoluteEndSeconds).toBe(16)
  })

  it('rejects invalid JSON structure', () => {
    expect(() => parseWhisperResult({}, 10, 16)).toThrow(/transcription must be an array/)
    expect(() => parseWhisperResult({ transcription: [{ text: 'bad' }] }, 10, 16)).toThrow(/offsets must be numbers/)
  })
})
