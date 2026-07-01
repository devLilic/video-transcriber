import { useEffect, useState } from 'react'
import type { ProgressInfo } from 'electron-updater'
import { Download, RefreshCw, RotateCw } from 'lucide-react'
import type { AppInfoPayload } from '@/shared/ipc/contracts'
import type { UpdateErrorPayload, VersionInfo } from '@/shared/types/update'
import type { AppToastTone } from '@/app/ToastViewport'

type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

interface UpdateControlProps {
  onNotify?: (tone: AppToastTone, message: string) => void
}

export function UpdateControl({ onNotify }: UpdateControlProps) {
  const config = window.appApi.getConfig()
  const [appInfo, setAppInfo] = useState<AppInfoPayload | null>(null)
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [progress, setProgress] = useState<Partial<ProgressInfo> | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const canCheckForUpdates = config.environment === 'production' && config.features.autoUpdate && config.update.enabled

  useEffect(() => {
    let active = true

    void window.appApi.getAppInfo().then((info) => {
      if (active) {
        setAppInfo(info)
      }
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const unsubscribeAvailability = window.updateApi.onAvailabilityChanged((payload) => {
      setVersionInfo(payload)
      setErrorMessage(null)
      setStatus(payload.update ? 'available' : 'not-available')

      if (payload.update) {
        onNotify?.('info', `Update disponibil: ${payload.newVersion}.`)
      }
    })
    const unsubscribeProgress = window.updateApi.onDownloadProgress((payload) => {
      setProgress(payload)
      setStatus('downloading')
    })
    const unsubscribeDownloaded = window.updateApi.onDownloaded(() => {
      setProgress({ percent: 100 })
      setStatus('downloaded')
    })
    const unsubscribeError = window.updateApi.onError((payload: UpdateErrorPayload) => {
      setErrorMessage(payload.message)
      setStatus('error')
      onNotify?.('error', 'Update-ul a esuat.')
    })

    return () => {
      unsubscribeAvailability()
      unsubscribeProgress()
      unsubscribeDownloaded()
      unsubscribeError()
    }
  }, [])

  async function checkForUpdates() {
    if (!canCheckForUpdates) {
      return
    }

    setStatus('checking')
    setErrorMessage(null)
    const result = await window.updateApi.checkForUpdates()
    const maybeError = result as { message?: string; error?: unknown } | null

    if (maybeError?.error) {
      setErrorMessage(maybeError.message ?? 'Update check failed.')
      setStatus('error')
      onNotify?.('error', 'Verificarea update-ului a esuat.')
    }
  }

  async function downloadUpdate() {
    setStatus('downloading')
    setProgress({ percent: 0 })
    await window.updateApi.downloadUpdate()
  }

  async function restartAndInstall() {
    await window.updateApi.quitAndInstall()
  }

  return (
    <section className='update-control grid shrink-0 justify-items-end gap-1' aria-label='Auto update'>
      <div className='update-control__version studio-timecode text-xs text-editorial-text'>v{appInfo?.version ?? '...'}</div>
      <div className='update-control__actions flex gap-2'>
        <button className='studio-button py-1.5 text-xs' type='button' onClick={() => void checkForUpdates()} disabled={!canCheckForUpdates || status === 'checking'}>
          <RefreshCw size={13} className={status === 'checking' ? 'animate-spin' : ''} />
          {status === 'checking' ? 'Checking...' : 'Check updates'}
        </button>
        {status === 'available' && (
          <button className='studio-button py-1.5 text-xs' type='button' onClick={() => void downloadUpdate()}>
            <Download size={13} />
            Download
          </button>
        )}
        {status === 'downloaded' && (
          <button className='studio-button border-signal-green/50 bg-signal-green/15 py-1.5 text-xs' type='button' onClick={() => void restartAndInstall()}>
            <RotateCw size={13} />
            Restart and Install
          </button>
        )}
      </div>
      <div className='update-control__status max-w-[460px] truncate text-right text-[11px] text-editorial-subtle' aria-live='polite'>
        {!canCheckForUpdates && 'Updates are available only in packaged production builds.'}
        {canCheckForUpdates && status === 'idle' && 'Ready to check for updates.'}
        {status === 'available' && `Version ${versionInfo?.newVersion ?? ''} is available.`}
        {status === 'not-available' && 'You are on the latest version.'}
        {status === 'downloading' && `Downloading ${Math.round(progress?.percent ?? 0)}%.`}
        {status === 'downloaded' && 'Update downloaded.'}
        {status === 'error' && (errorMessage ?? 'Update failed.')}
      </div>
    </section>
  )
}
