import type { LocalTranscriptSegment } from '@/shared/local-transcription/types'

export function findActiveTranscriptSegment(
  segments: LocalTranscriptSegment[],
  currentTime: number,
): LocalTranscriptSegment | null {
  if (!Number.isFinite(currentTime)) {
    return null
  }

  return segments.find((segment) => (
    currentTime >= segment.absoluteStartSeconds
    && currentTime < segment.absoluteEndSeconds
  )) ?? null
}
