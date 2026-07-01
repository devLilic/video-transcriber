import { useEffect, useState } from 'react'
import { AudioWaveform } from 'lucide-react'
import { MediaWorkspace } from '@/features/media/MediaWorkspace'
import type {
  LocalTranscriptSegment,
  LocalTranscriptionProgress,
  LocalTranscriptionResult,
} from '@/shared/local-transcription/types'
import type { SelectedVideoSource } from '@/shared/media/types'
import { normalizePlaybackRate, type PlaybackRate } from '@/features/media/playbackRate'
import {
  buildTranscriptFullText,
} from '@/features/transcription/transcriptSegmentText'
import { TranscriptionPanel } from '@/features/transcription/TranscriptionPanel'
import { UpdateControl } from '@/features/updater/UpdateControl'
import { ToastViewport, type AppToastTone } from './ToastViewport'
import './App.css'

type TranscriptionDisplayStatus = 'idle' | 'transcribing' | 'partial-cancelled' | 'partial-error' | 'complete'

export function AppShell() {
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideoSource | null>(null)
  const [transcriptionResult, setTranscriptionResult] = useState<LocalTranscriptionResult | null>(null)
  const [transcriptionCreatedAt, setTranscriptionCreatedAt] = useState<string | null>(null)
  const [isTranscriptStale, setIsTranscriptStale] = useState(false)
  const [transcriptEditError, setTranscriptEditError] = useState<string | null>(null)
  const [transcriptionProgress, setTranscriptionProgress] = useState<LocalTranscriptionProgress | null>(null)
  const [displayStatus, setDisplayStatus] = useState<TranscriptionDisplayStatus>('idle')
  const [hasProgressiveBlocks, setHasProgressiveBlocks] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1)
  const [toasts, setToasts] = useState<Array<{ id: string; tone: AppToastTone; message: string }>>([])
  const [playerActions, setPlayerActions] = useState<{
    seekAndPlay: (timeSeconds: number) => void
    playRange: (startSeconds: number, endSeconds: number) => void
  } | null>(null)

  useEffect(() => {
    let isMounted = true

    void window.settingsApi.getUiPreferences().then((preferences) => {
      if (isMounted) {
        setPlaybackRate(normalizePlaybackRate(preferences.playbackRate))
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  function notify(tone: AppToastTone, message: string) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`

    setToasts((currentToasts) => [...currentToasts.slice(-3), { id, tone, message }])
    window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id))
    }, 5200)
  }

  async function handleSelectVideo() {
    let videoSource: SelectedVideoSource | null = null

    try {
      videoSource = await window.mediaApi.selectVideo()
    } catch {
      notify('error', 'Selectarea video nu a putut fi finalizata.')
      return
    }

    if (videoSource) {
      setSelectedVideo(videoSource)
      setTranscriptionResult(null)
      setTranscriptionCreatedAt(null)
      setIsTranscriptStale(false)
      setTranscriptEditError(null)
      setTranscriptionProgress(null)
      setDisplayStatus('idle')
      setHasProgressiveBlocks(false)
    }
  }

  async function handleCommitSegmentText(segment: LocalTranscriptSegment, nextText: string) {
    if (!selectedVideo || !transcriptionCreatedAt) {
      setTranscriptEditError('Transcriptul nu poate fi salvat momentan.')
      notify('error', 'Corectura nu poate fi salvata momentan.')
      return
    }

    try {
      const response = await window.transcriptionApi.updateSegmentText({
        videoId: selectedVideo.id,
        transcriptionCreatedAt,
        segmentId: segment.id,
        text: nextText,
      })

      applyTranscriptSegmentUpdate(response.segment, response.fullText)
      setTranscriptEditError(null)
    } catch {
      setTranscriptEditError('Corectura nu a putut fi salvata.')
      notify('error', 'Corectura nu a putut fi salvata.')
    }
  }

  function applyTranscriptSegmentUpdate(segment: LocalTranscriptSegment, fullText: string) {
    if (!transcriptionResult) {
      return
    }

    const segments = transcriptionResult.segments.map((currentSegment) => (
      currentSegment.id === segment.id ? segment : currentSegment
    ))
    const nextResult: LocalTranscriptionResult = {
      ...transcriptionResult,
      segments,
      fullText: fullText || buildTranscriptFullText(segments),
    }

    setTranscriptionResult(nextResult)
  }

  function handleTranscriptionStarted() {
    if (displayStatus === 'partial-cancelled' || displayStatus === 'partial-error') {
      setTranscriptionResult(null)
      setTranscriptionCreatedAt(null)
    }

    setDisplayStatus('transcribing')
    setHasProgressiveBlocks(false)
    setTranscriptionProgress(null)
    setTranscriptEditError(null)
  }

  function handleProgressiveTranscriptionResult(result: LocalTranscriptionResult) {
    setTranscriptionResult((currentResult) => {
      if (!hasProgressiveBlocks) {
        return result
      }

      const existingSegments = currentResult?.segments ?? []
      const existingIds = new Set(existingSegments.map((segment) => segment.id))
      const mergedSegments = [
        ...existingSegments,
        ...result.segments.filter((segment) => !existingIds.has(segment.id)),
      ].sort((first, second) => first.absoluteStartSeconds - second.absoluteStartSeconds)

      return {
        ...result,
        fullText: mergedSegments.map((segment) => segment.text).join(' '),
        segments: mergedSegments,
      }
    })
    setHasProgressiveBlocks(true)
    setTranscriptionCreatedAt(null)
    setIsTranscriptStale(false)
    setTranscriptEditError(null)
  }

  function handleTranscriptionInterrupted(reason: 'cancelled' | 'error') {
    setTranscriptionProgress(null)
    notify(reason === 'cancelled' ? 'info' : 'error', reason === 'cancelled' ? 'Transcriere anulata.' : 'Motorul local de transcriere a raportat o eroare.')

    if (hasProgressiveBlocks) {
      setDisplayStatus(reason === 'cancelled' ? 'partial-cancelled' : 'partial-error')
      setTranscriptionCreatedAt(null)
      return
    }

    setDisplayStatus(transcriptionResult ? 'complete' : 'idle')
  }

  function clearPartialResult() {
    setTranscriptionResult(null)
    setTranscriptionCreatedAt(null)
    setDisplayStatus('idle')
    setHasProgressiveBlocks(false)
    setTranscriptEditError(null)
  }

  function handlePlaybackRateChange(nextPlaybackRate: PlaybackRate) {
    const normalized = normalizePlaybackRate(nextPlaybackRate)

    setPlaybackRate(normalized)
    void window.settingsApi.getUiPreferences().then((preferences) => (
      window.settingsApi.setUiPreferences({
        ...preferences,
        playbackRate: normalized,
      })
    ))
  }

  return (
    <div className='app-shell flex h-full w-full flex-col overflow-hidden bg-studio-950 text-editorial-text'>
      <header className='app-header relative flex h-16 shrink-0 items-center justify-between gap-4 overflow-hidden border-b border-editorial-line bg-studio-900 px-5 shadow-panel'>
        <div className='absolute bottom-0 left-5 h-0.5 w-28 rounded-full bg-signal-cyan' aria-hidden='true' />
        <div className='app-title-group flex min-w-0 items-center gap-3'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-signal-cyan/35 bg-studio-800 text-signal-cyan shadow-monitor'>
            <AudioWaveform size={22} strokeWidth={2.3} />
          </div>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <h1 className='m-0 truncate text-lg font-extrabold leading-tight text-editorial-text'>Video Transcriber</h1>
              <span className='studio-badge border-signal-green/35 bg-signal-green/10 px-2 py-0.5 text-[10px] text-signal-green'>
                <span className='h-1.5 w-1.5 rounded-full bg-signal-green' aria-hidden='true' />
                LOCAL
              </span>
            </div>
            <p className='m-0 text-xs font-semibold text-editorial-muted'>Local editorial workspace</p>
          </div>
        </div>
        <UpdateControl onNotify={notify} />
      </header>

      <main className='app-main grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden bg-studio-950 p-3 lg:grid-cols-[minmax(0,1fr)_1px_minmax(380px,clamp(420px,30vw,480px))]'>
        <MediaWorkspace
          selectedVideo={selectedVideo}
          playbackRate={playbackRate}
          onPlaybackRateChange={handlePlaybackRateChange}
          onSelectVideo={handleSelectVideo}
          onTranscriptionStarted={handleTranscriptionStarted}
          onTranscriptionProgressChange={setTranscriptionProgress}
          onTranscriptionCompleted={(result, createdAt) => {
            setTranscriptionResult(result)
            setTranscriptionCreatedAt(createdAt)
            setIsTranscriptStale(false)
            setTranscriptEditError(null)
            setTranscriptionProgress(null)
            setDisplayStatus('complete')
            setHasProgressiveBlocks(false)
          }}
          onTranscriptionBlocksAvailable={handleProgressiveTranscriptionResult}
          onTranscriptionInterrupted={handleTranscriptionInterrupted}
          onTranscriptionRestored={(result, isCurrent) => {
            setTranscriptionResult(result)
            setTranscriptionCreatedAt(result.createdAt ?? null)
            setIsTranscriptStale(!isCurrent)
            setTranscriptEditError(null)
            setDisplayStatus('complete')
            setHasProgressiveBlocks(false)
          }}
          onTranscriptionStaleChange={setIsTranscriptStale}
          onTranscriptionCleared={() => {
            setTranscriptionResult(null)
            setTranscriptionCreatedAt(null)
            setIsTranscriptStale(false)
            setTranscriptEditError(null)
            setTranscriptionProgress(null)
            setDisplayStatus('idle')
            setHasProgressiveBlocks(false)
          }}
          onPlaybackTimeChange={setCurrentTime}
          onPlayerActionsChange={setPlayerActions}
        />
        <div className='workspace-separator hidden bg-editorial-line/80 lg:block' aria-hidden='true' />
        <TranscriptionPanel
          result={transcriptionResult}
          isStale={isTranscriptStale}
          editError={transcriptEditError}
          progress={transcriptionProgress}
          displayStatus={displayStatus}
          isEditable={displayStatus === 'complete' && !!transcriptionCreatedAt}
          currentTime={currentTime}
          onClearPartialResult={clearPartialResult}
          onSeekToSegment={(segment) => playerActions?.seekAndPlay(segment.absoluteStartSeconds)}
          onCommitSegmentText={handleCommitSegmentText}
        />
      </main>
      <ToastViewport
        toasts={toasts}
        onDismiss={(id) => setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id))}
      />
    </div>
  )
}
