import { contextBridge } from 'electron'
import { ipcInvokeChannels } from '../../../src/shared/ipc/contracts'
import { invoke } from './shared'

export function registerMediaApi() {
  contextBridge.exposeInMainWorld('mediaApi', {
    selectVideo() {
      return invoke(ipcInvokeChannels.mediaSelectVideo)
    },
  })
}
