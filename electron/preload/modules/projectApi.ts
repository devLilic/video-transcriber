import { contextBridge } from 'electron'
import { ipcInvokeChannels } from '../../../src/shared/ipc/contracts'
import type { LocalTranscriptionResult } from '../../../src/shared/local-transcription/types'
import type { SegmentSelection } from '../../../src/shared/media/types'
import { invoke } from './shared'

export function registerProjectApi() {
  contextBridge.exposeInMainWorld('projectApi', {
    load(videoId: string) {
      return invoke(ipcInvokeChannels.projectLoad, { videoId })
    },
    saveSelection(videoId: string, selection: SegmentSelection) {
      return invoke(ipcInvokeChannels.projectSaveSelection, { videoId, selection })
    },
    saveTranscription(videoId: string, transcription: LocalTranscriptionResult) {
      return invoke(ipcInvokeChannels.projectSaveTranscription, { videoId, transcription })
    },
  })
}
