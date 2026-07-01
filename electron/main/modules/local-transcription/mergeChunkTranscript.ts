import type { RawWhisperSegment } from './buildNaturalTranscriptBlocks'

const TIMECODE_PROXIMITY_SECONDS = 0.75
const LEXICAL_SIMILARITY_THRESHOLD = 0.75

export function mergeChunkTranscript(
  acceptedSegments: RawWhisperSegment[],
  incomingSegments: RawWhisperSegment[],
  overlapStartSeconds: number,
  overlapEndSeconds: number,
): RawWhisperSegment[] {
  if (overlapEndSeconds <= overlapStartSeconds) {
    return sortSegments([...acceptedSegments, ...incomingSegments])
  }

  const mergedSegments = [...acceptedSegments]

  for (const incomingSegment of incomingSegments) {
    const duplicateIndex = mergedSegments.findIndex((acceptedSegment) => (
      isInOverlap(acceptedSegment, overlapStartSeconds, overlapEndSeconds)
      && isInOverlap(incomingSegment, overlapStartSeconds, overlapEndSeconds)
      && areLikelyDuplicateSegments(acceptedSegment, incomingSegment)
    ))

    if (duplicateIndex < 0) {
      mergedSegments.push(incomingSegment)
      continue
    }

    mergedSegments[duplicateIndex] = choosePreferredSegment(mergedSegments[duplicateIndex], incomingSegment)
  }

  return sortSegments(mergedSegments)
}

function areLikelyDuplicateSegments(first: RawWhisperSegment, second: RawWhisperSegment) {
  if (!haveCloseTimecodes(first, second)) {
    return false
  }

  const firstText = normalizeComparableText(first.text)
  const secondText = normalizeComparableText(second.text)

  return firstText === secondText
    || hasSubsetTokenMatch(firstText, secondText)
    || calculateLexicalSimilarity(firstText, secondText) >= LEXICAL_SIMILARITY_THRESHOLD
}

function choosePreferredSegment(acceptedSegment: RawWhisperSegment, incomingSegment: RawWhisperSegment) {
  const acceptedDuration = acceptedSegment.endSeconds - acceptedSegment.startSeconds
  const incomingDuration = incomingSegment.endSeconds - incomingSegment.startSeconds

  if (incomingDuration > acceptedDuration + 0.25) {
    return incomingSegment
  }

  if (acceptedDuration > incomingDuration + 0.25) {
    return acceptedSegment
  }

  if (incomingSegment.text.trim().length > acceptedSegment.text.trim().length * 1.2) {
    return incomingSegment
  }

  return acceptedSegment
}

function haveCloseTimecodes(first: RawWhisperSegment, second: RawWhisperSegment) {
  return Math.abs(first.startSeconds - second.startSeconds) <= TIMECODE_PROXIMITY_SECONDS
    || Math.abs(first.endSeconds - second.endSeconds) <= TIMECODE_PROXIMITY_SECONDS
    || rangesOverlap(first, second)
}

function rangesOverlap(first: RawWhisperSegment, second: RawWhisperSegment) {
  return first.startSeconds < second.endSeconds && second.startSeconds < first.endSeconds
}

function isInOverlap(segment: RawWhisperSegment, overlapStartSeconds: number, overlapEndSeconds: number) {
  return segment.startSeconds < overlapEndSeconds && segment.endSeconds > overlapStartSeconds
}

function calculateLexicalSimilarity(firstText: string, secondText: string) {
  const firstTokens = tokenizeComparableText(firstText)
  const secondTokens = tokenizeComparableText(secondText)
  const firstSet = new Set(firstTokens)
  const secondSet = new Set(secondTokens)
  const union = new Set([...firstSet, ...secondSet])

  if (union.size === 0) {
    return 0
  }

  let commonWords = 0

  for (const token of firstSet) {
    if (secondSet.has(token)) {
      commonWords += 1
    }
  }

  return commonWords / union.size
}

function hasSubsetTokenMatch(firstText: string, secondText: string) {
  const firstTokens = tokenizeComparableText(firstText)
  const secondTokens = tokenizeComparableText(secondText)

  if (firstTokens.length === 0 || secondTokens.length === 0) {
    return false
  }

  const shorterTokens = firstTokens.length <= secondTokens.length ? firstTokens : secondTokens
  const longerSet = new Set(firstTokens.length <= secondTokens.length ? secondTokens : firstTokens)
  const matchingTokens = shorterTokens.filter((token) => longerSet.has(token)).length

  return matchingTokens / shorterTokens.length >= 0.9
}

function tokenizeComparableText(text: string) {
  return normalizeComparableText(text).split(/\s+/).filter(Boolean)
}

function normalizeComparableText(text: string) {
  return text
    .toLocaleLowerCase('ro-RO')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sortSegments(segments: RawWhisperSegment[]) {
  return [...segments].sort((first, second) => (
    first.startSeconds - second.startSeconds || first.endSeconds - second.endSeconds
  ))
}
