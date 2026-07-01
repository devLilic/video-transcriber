import type { SegmentSelection } from '../media/types'
import type { LocalTranscriptSegment } from '../local-transcription/types'

export interface StoredLocalTranscription {
  engine: 'whisper.cpp'
  model: 'small-q5_1'
  language: 'ro'
  sourceSelection: SegmentSelection
  fullText: string
  segments: LocalTranscriptSegment[]
  createdAt: string
}

export interface VideoProject {
  selection: SegmentSelection
  transcription?: StoredLocalTranscription
  updatedAt: string
}

export interface ProjectStoreData {
  version: 1
  projects: Record<string, VideoProject>
}
