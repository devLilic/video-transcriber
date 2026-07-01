import { createHash } from 'node:crypto'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { dialog, ipcMain, type BrowserWindow } from 'electron'
import { ipcInvokeChannels } from '../../../../src/shared/ipc/contracts'
import type { SelectedVideoSource } from '../../../../src/shared/media/types'
import { mediaSourceRegistry } from './MediaSourceRegistry'

const videoExtensions = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'mxf', 'mts', 'm2ts', 'ts']

let mediaHandlersRegistered = false

export function registerMediaModule(getMainWindow: () => BrowserWindow | null) {
  if (mediaHandlersRegistered) {
    return
  }

  mediaHandlersRegistered = true

  ipcMain.handle(ipcInvokeChannels.mediaSelectVideo, async () => {
    const options: Electron.OpenDialogOptions = {
      title: 'Select Video',
      properties: ['openFile'],
      filters: [
        {
          name: 'Video files',
          extensions: videoExtensions,
        },
      ],
    }
    const window = getMainWindow()
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const filePath = path.normalize(result.filePaths[0])
    const fileStat = await stat(filePath)
    const id = createStableVideoId(filePath, fileStat.size, fileStat.mtimeMs)

    mediaSourceRegistry.register(id, filePath)

    return {
      id,
      fileName: path.basename(filePath),
      mediaUrl: mediaSourceRegistry.createMediaUrl(id),
      sizeBytes: fileStat.size,
      modifiedAt: fileStat.mtimeMs,
    } satisfies SelectedVideoSource
  })
}

function createStableVideoId(filePath: string, sizeBytes: number, modifiedAt: number) {
  return createHash('sha256')
    .update(filePath)
    .update('\0')
    .update(String(sizeBytes))
    .update('\0')
    .update(String(modifiedAt))
    .digest('hex')
}
