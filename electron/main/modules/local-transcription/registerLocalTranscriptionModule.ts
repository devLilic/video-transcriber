import { app, ipcMain, type BrowserWindow, type WebContents } from 'electron'
import {
  ipcEventChannels,
  ipcInvokeChannels,
  type CancelLocalTranscriptionRequest,
  type ResetTranscriptSegmentTextRequest,
  type StartLocalTranscriptionRequest,
  type TranscriptionErrorPayload,
  type UpdateTranscriptSegmentTextRequest,
} from '../../../../src/shared/ipc/contracts'
import { isTranscriptBlocksAvailableEvent } from '../../../../src/shared/local-transcription/validators'
import { ProjectStore } from '../projects/ProjectStore'
import { LocalTranscriptionService, type LocalTranscriptionJob } from './LocalTranscriptionService'

let localTranscriptionHandlersRegistered = false

export function registerLocalTranscriptionModule(getMainWindow: () => BrowserWindow | null) {
  if (localTranscriptionHandlersRegistered) {
    return
  }

  localTranscriptionHandlersRegistered = true

  const service = new LocalTranscriptionService()
  const projectStore = new ProjectStore(app.getPath('userData'))
  let activeJob: LocalTranscriptionJob | null = null

  ipcMain.handle(ipcInvokeChannels.transcriptionStart, (event, payload: StartLocalTranscriptionRequest) => {
    try {
      validateStartRequest(payload)
      const jobWebContents = event.sender

      const job = service.startTranscription({
        videoId: payload.videoId,
        inSeconds: payload.inSeconds,
        outSeconds: payload.outSeconds,
        onProgress(progress) {
          sendToJobWindow(jobWebContents, ipcEventChannels.transcriptionProgress, progress)
        },
        onBlocksAvailable(payload) {
          if (isTranscriptBlocksAvailableEvent(payload)) {
            sendToJobWindow(jobWebContents, ipcEventChannels.transcriptionBlocksAvailable, payload)
          }
        },
      })

      activeJob = job
      void job.promise
        .then((result) => {
          sendToJobWindow(jobWebContents, ipcEventChannels.transcriptionCompleted, result)
        })
        .catch((error) => {
          const payload = normalizeTranscriptionError(error, job.jobId)

          if (payload.code === 'TRANSCRIPTION_CANCELLED') {
            sendToJobWindow(jobWebContents, ipcEventChannels.transcriptionCancelled, { jobId: job.jobId })
            return
          }

          sendToJobWindow(jobWebContents, ipcEventChannels.transcriptionError, payload)
        })
        .finally(() => {
          if (activeJob?.jobId === job.jobId) {
            activeJob = null
          }
        })

      return { jobId: job.jobId }
    } catch (error) {
      throw normalizeTranscriptionError(error)
    }
  })

  ipcMain.handle(ipcInvokeChannels.transcriptionCancel, (_event, payload: CancelLocalTranscriptionRequest) => {
    if (!payload || typeof payload.jobId !== 'string' || payload.jobId.length === 0) {
      throw normalizeTranscriptionError(new Error('Invalid transcription job id.'), payload?.jobId)
    }

    if (activeJob?.jobId === payload.jobId) {
      activeJob.cancel()
    }
  })

  ipcMain.handle(ipcInvokeChannels.transcriptionUpdateSegmentText, (_event, payload: UpdateTranscriptSegmentTextRequest) => {
    try {
      validateUpdateSegmentTextRequest(payload)

      return projectStore.updateTranscriptSegmentText(
        payload.videoId,
        payload.transcriptionCreatedAt,
        payload.segmentId,
        payload.text,
      )
    } catch (error) {
      throw normalizeTranscriptionError(error)
    }
  })

  ipcMain.handle(ipcInvokeChannels.transcriptionResetSegmentText, (_event, payload: ResetTranscriptSegmentTextRequest) => {
    try {
      validateResetSegmentTextRequest(payload)

      return projectStore.resetTranscriptSegmentText(
        payload.videoId,
        payload.transcriptionCreatedAt,
        payload.segmentId,
      )
    } catch (error) {
      throw normalizeTranscriptionError(error)
    }
  })
}

function sendToJobWindow<TChannel extends keyof typeof ipcEventChannels>(
  webContents: WebContents,
  channel: (typeof ipcEventChannels)[TChannel],
  payload: unknown,
) {
  if (!webContents.isDestroyed()) {
    webContents.send(channel, payload)
  }
}

function validateStartRequest(payload: StartLocalTranscriptionRequest) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid transcription request.')
  }

  if (typeof payload.videoId !== 'string' || payload.videoId.length === 0) {
    throw new Error('Invalid video id.')
  }

  if (!Number.isFinite(payload.inSeconds) || !Number.isFinite(payload.outSeconds)) {
    throw new Error('Invalid transcription segment.')
  }

  if (payload.language !== 'ro') {
    throw new Error('Only Romanian transcription is supported.')
  }
}

function validateUpdateSegmentTextRequest(payload: UpdateTranscriptSegmentTextRequest) {
  validateResetSegmentTextRequest(payload)

  if (typeof payload.text !== 'string') {
    throw new Error('Invalid transcript segment text.')
  }
}

function validateResetSegmentTextRequest(payload: ResetTranscriptSegmentTextRequest) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid transcript edit request.')
  }

  if (typeof payload.videoId !== 'string' || payload.videoId.length === 0) {
    throw new Error('Invalid video id.')
  }

  if (typeof payload.transcriptionCreatedAt !== 'string' || payload.transcriptionCreatedAt.length === 0) {
    throw new Error('Invalid transcript version.')
  }

  if (typeof payload.segmentId !== 'string' || payload.segmentId.length === 0) {
    throw new Error('Invalid transcript segment id.')
  }
}

function normalizeTranscriptionError(error: unknown, jobId?: string): TranscriptionErrorPayload {
  const message = error instanceof Error ? error.message : 'Local transcription failed.'

  if (/cancelled/i.test(message)) {
    return {
      jobId,
      code: 'TRANSCRIPTION_CANCELLED',
      message: 'Local transcription was cancelled.',
    }
  }

  if (/already running/i.test(message)) {
    return {
      jobId,
      code: 'TRANSCRIPTION_BUSY',
      message,
    }
  }

  return {
    jobId,
    code: 'TRANSCRIPTION_FAILED',
    message,
  }
}
