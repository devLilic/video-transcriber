import type { SegmentSelection } from '@/shared/media/types'

export const MIN_SEGMENT_SECONDS = 0.05

export function normalizeSegmentSelection(
  selection: SegmentSelection,
  duration: number,
): SegmentSelection | null {
  if (!Number.isFinite(duration) || duration <= 0) {
    return null
  }

  const maxOut = Math.max(duration, MIN_SEGMENT_SECONDS)
  let inSeconds = clampFinite(selection.inSeconds, 0, Math.max(0, maxOut - MIN_SEGMENT_SECONDS))
  let outSeconds = clampFinite(selection.outSeconds, MIN_SEGMENT_SECONDS, maxOut)

  if (inSeconds >= outSeconds) {
    if (selection.outSeconds <= selection.inSeconds) {
      outSeconds = Math.min(maxOut, inSeconds + MIN_SEGMENT_SECONDS)
    }

    if (inSeconds >= outSeconds) {
      inSeconds = Math.max(0, outSeconds - MIN_SEGMENT_SECONDS)
    }
  }

  return {
    inSeconds,
    outSeconds,
  }
}

export function isValidSegmentSelection(selection: SegmentSelection, duration: number) {
  return Number.isFinite(duration)
    && duration > 0
    && Number.isFinite(selection.inSeconds)
    && Number.isFinite(selection.outSeconds)
    && selection.inSeconds >= 0
    && selection.inSeconds < selection.outSeconds
    && selection.outSeconds <= duration
}

function clampFinite(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}
