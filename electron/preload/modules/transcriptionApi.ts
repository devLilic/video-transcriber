import { contextBridge } from 'electron'
import {
  ipcEventChannels,
  ipcInvokeChannels,
  type ResetTranscriptSegmentTextRequest,
  type StartLocalTranscriptionRequest,
  type UpdateTranscriptSegmentTextRequest,
} from '../../../src/shared/ipc/contracts'
import type {
  LocalTranscriptionProgress,
  LocalTranscriptionResult,
  TranscriptBlocksAvailableEvent,
} from '../../../src/shared/local-transcription/types'
import type { TranscriptionErrorPayload } from '../../../src/shared/ipc/contracts'
import { isTranscriptBlocksAvailableEvent } from '../../../src/shared/local-transcription/validators'
import { invoke, subscribe } from './shared'

export function registerTranscriptionApi() {
  contextBridge.exposeInMainWorld('transcriptionApi', {
    start(request: StartLocalTranscriptionRequest) {
      return invoke(ipcInvokeChannels.transcriptionStart, request)
    },
    cancel(jobId: string) {
      return invoke(ipcInvokeChannels.transcriptionCancel, { jobId })
    },
    updateSegmentText(request: UpdateTranscriptSegmentTextRequest) {
      return invoke(ipcInvokeChannels.transcriptionUpdateSegmentText, request)
    },
    resetSegmentText(request: ResetTranscriptSegmentTextRequest) {
      return invoke(ipcInvokeChannels.transcriptionResetSegmentText, request)
    },
    onProgress(listener: (payload: LocalTranscriptionProgress) => void) {
      return subscribe(ipcEventChannels.transcriptionProgress, listener)
    },
    onBlocksAvailable(listener: (payload: TranscriptBlocksAvailableEvent) => void) {
      return subscribe(ipcEventChannels.transcriptionBlocksAvailable, (payload) => {
        if (isTranscriptBlocksAvailableEvent(payload)) {
          listener(payload)
        }
      })
    },
    onCompleted(listener: (payload: LocalTranscriptionResult) => void) {
      return subscribe(ipcEventChannels.transcriptionCompleted, listener)
    },
    onError(listener: (payload: TranscriptionErrorPayload) => void) {
      return subscribe(ipcEventChannels.transcriptionError, listener)
    },
    onCancelled(listener: (payload: { jobId: string }) => void) {
      return subscribe(ipcEventChannels.transcriptionCancelled, listener)
    },
  })
}
