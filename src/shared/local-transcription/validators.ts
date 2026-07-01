import type { LocalTranscriptSegment, TranscriptBlocksAvailableEvent } from './types'

export function isLocalTranscriptSegment(value: unknown): value is LocalTranscriptSegment {
  if (!isRecord(value)) {
    return false
  }

  return typeof value.id === 'string'
    && isFiniteNumber(value.relativeStartSeconds)
    && isFiniteNumber(value.relativeEndSeconds)
    && isFiniteNumber(value.absoluteStartSeconds)
    && isFiniteNumber(value.absoluteEndSeconds)
    && value.relativeStartSeconds >= 0
    && value.relativeStartSeconds <= value.relativeEndSeconds
    && value.absoluteStartSeconds >= 0
    && value.absoluteStartSeconds <= value.absoluteEndSeconds
    && typeof value.originalText === 'string'
    && typeof value.text === 'string'
    && typeof value.isEdited === 'boolean'
    && (value.editedAt === null || typeof value.editedAt === 'string')
}

export function isTranscriptBlocksAvailableEvent(value: unknown): value is TranscriptBlocksAvailableEvent {
  if (!isRecord(value)) {
    return false
  }

  const { chunkIndex, completedDurationSeconds, totalDurationSeconds } = value

  return typeof value.jobId === 'string'
    && value.jobId.length > 0
    && typeof chunkIndex === 'number'
    && Number.isInteger(chunkIndex)
    && chunkIndex >= 0
    && Array.isArray(value.blocks)
    && value.blocks.every(isLocalTranscriptSegment)
    && isFiniteNumber(completedDurationSeconds)
    && completedDurationSeconds >= 0
    && isFiniteNumber(totalDurationSeconds)
    && totalDurationSeconds > 0
    && completedDurationSeconds <= totalDurationSeconds
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
