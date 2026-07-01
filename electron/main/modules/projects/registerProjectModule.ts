import { app, ipcMain } from 'electron'
import {
  ipcInvokeChannels,
  type ProjectLoadRequest,
  type ProjectSaveSelectionRequest,
  type ProjectSaveTranscriptionRequest,
} from '../../../../src/shared/ipc/contracts'
import { ProjectStore } from './ProjectStore'

let projectHandlersRegistered = false

export function registerProjectModule() {
  if (projectHandlersRegistered) {
    return
  }

  projectHandlersRegistered = true

  const projectStore = new ProjectStore(app.getPath('userData'))

  ipcMain.handle(ipcInvokeChannels.projectLoad, (_event, payload: ProjectLoadRequest) => {
    return projectStore.load(payload.videoId)
  })

  ipcMain.handle(ipcInvokeChannels.projectSaveSelection, (_event, payload: ProjectSaveSelectionRequest) => {
    return projectStore.saveSelection(payload.videoId, payload.selection)
  })

  ipcMain.handle(ipcInvokeChannels.projectSaveTranscription, (_event, payload: ProjectSaveTranscriptionRequest) => {
    return projectStore.saveTranscription(payload.videoId, payload.transcription)
  })
}
