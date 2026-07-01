export interface LocalTranscriptSegment {
  id: string
  relativeStartSeconds: number
  relativeEndSeconds: number
  absoluteStartSeconds: number
  absoluteEndSeconds: number
  originalText: string
  text: string
  isEdited: boolean
  editedAt: string | null
}

export interface LocalTranscriptionResult {
  engine: 'whisper.cpp'
  model: 'small-q5_1'
  language: 'ro'
  sourceInSeconds: number
  sourceOutSeconds: number
  fullText: string
  segments: LocalTranscriptSegment[]
  createdAt?: string
}

export interface LocalTranscriptionProgress {
  jobId: string
  phase: TranscriptionPhase
  percent: number
  chunkIndex: number
  chunkCount: number
}

export type TranscriptionPhase =
  | 'preparing'
  | 'extracting-chunk'
  | 'transcribing-chunk'
  | 'merging'
  | 'completed'

export interface TranscriptBlocksAvailableEvent {
  jobId: string
  chunkIndex: number
  blocks: LocalTranscriptSegment[]
  completedDurationSeconds: number
  totalDurationSeconds: number
}
