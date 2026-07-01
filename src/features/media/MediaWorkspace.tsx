import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AudioLines,
  Brackets,
  Captions,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  FileVideo,
  Film,
  FolderOpen,
  Gauge,
  Play,
  Square,
  X,
} from 'lucide-react'
import type {
  LocalTranscriptSegment,
  LocalTranscriptionProgress,
  LocalTranscriptionResult,
  TranscriptBlocksAvailableEvent,
} from '@/shared/local-transcription/types'
import type { SegmentSelection, SelectedVideoSource } from '@/shared/media/types'
import type { StoredLocalTranscription } from '@/shared/projects/types'
import { SegmentTimeline } from '@/features/segments/SegmentTimeline'
import { isTranscriptCurrent } from '@/features/transcription/isTranscriptCurrent'
import { VideoPlayer, type VideoPlayerHandle } from './VideoPlayer'
import { calculateSeekTarget } from './calculateSeekTarget'
import { PLAYBACK_RATES, type PlaybackRate } from './playbackRate'
import { useVideoHotkeys } from './useVideoHotkeys'
import type { VideoHotkeyAction } from './videoHotkeys'
import { isValidSegmentSelection, normalizeSegmentSelection } from './segmentSelection'

interface MediaWorkspaceProps {
  selectedVideo: SelectedVideoSource | null
  playbackRate: PlaybackRate
  onPlaybackRateChange: (playbackRate: PlaybackRate) => void
  onSelectVideo: () => void | Promise<void>
  onTranscriptionStarted: () => void
  onTranscriptionProgressChange: (progress: LocalTranscriptionProgress | null) => void
  onTranscriptionCompleted: (result: LocalTranscriptionResult, transcriptionCreatedAt: string | null) => void
  onTranscriptionBlocksAvailable: (result: LocalTranscriptionResult) => void
  onTranscriptionInterrupted: (reason: 'cancelled' | 'error') => void
  onTranscriptionRestored: (result: LocalTranscriptionResult, isCurrent: boolean) => void
  onTranscriptionStaleChange: (isStale: boolean) => void
  onTranscriptionCleared: () => void
  onPlaybackTimeChange: (timeSeconds: number) => void
  onPlayerActionsChange: (actions: {
    seekAndPlay: (timeSeconds: number) => void
    playRange: (startSeconds: number, endSeconds: number) => void
  } | null) => void
}

export function MediaWorkspace({
  selectedVideo,
  playbackRate,
  onPlaybackRateChange,
  onSelectVideo,
  onTranscriptionStarted,
  onTranscriptionProgressChange,
  onTranscriptionCompleted,
  onTranscriptionBlocksAvailable,
  onTranscriptionInterrupted,
  onTranscriptionRestored,
  onTranscriptionStaleChange,
  onTranscriptionCleared,
  onPlaybackTimeChange,
  onPlayerActionsChange,
}: MediaWorkspaceProps) {
  const playerRef = useRef<VideoPlayerHandle | null>(null)
  const saveDebounceRef = useRef<number | null>(null)
  const selectedVideoIdRef = useRef<string | null>(null)
  const activeTranscriptionJobIdRef = useRef<string | null>(null)
  const [playbackState, setPlaybackState] = useState({ currentTime: 0, duration: 0 })
  const [segment, setSegment] = useState<SegmentSelection | null>(null)
  const [segmentVideoId, setSegmentVideoId] = useState<string | null>(null)
  const [isPlayingSegment, setIsPlayingSegment] = useState(false)
  const [activeTranscriptionJobId, setActiveTranscriptionJobId] = useState<string | null>(null)
  const [transcriptionProgress, setTranscriptionProgress] = useState<LocalTranscriptionProgress | null>(null)
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null)
  const [storedTranscription, setStoredTranscription] = useState<StoredLocalTranscription | null>(null)

  const handlePlaybackStateChange = useCallback((state: { currentTime: number; duration: number }) => {
    setPlaybackState(state)
    onPlaybackTimeChange(state.currentTime)

    if (!selectedVideo || state.duration <= 0) {
      return
    }

    setSegmentVideoId((currentVideoId) => {
      if (currentVideoId === selectedVideo.id) {
        return currentVideoId
      }

      void restoreSegmentForVideo(selectedVideo.id, state.duration)

      return selectedVideo.id
    })
  }, [onPlaybackTimeChange, selectedVideo])

  const handleVideoHotkey = useCallback((action: VideoHotkeyAction) => {
    switch (action.type) {
      case 'seek-by':
        seekVideoBy(action.deltaSeconds)
        break
      case 'toggle-playback':
        void togglePlayback()
        break
      case 'set-in':
        setIn()
        break
      case 'set-out':
        setOut()
        break
      case 'go-to-in':
        goToIn()
        break
      case 'go-to-out':
        goToOut()
        break
      case 'set-playback-rate':
        onPlaybackRateChange(action.playbackRate)
        break
    }
  }, [onPlaybackRateChange, playbackState.currentTime, playbackState.duration, segment, isPlayingSegment])

  useVideoHotkeys({
    enabled: Boolean(selectedVideo),
    onAction: handleVideoHotkey,
  })

  useEffect(() => {
    onPlayerActionsChange({
      seekAndPlay(timeSeconds) {
        void seekAndPlay(timeSeconds)
      },
      playRange(startSeconds, endSeconds) {
        void playAbsoluteRange(startSeconds, endSeconds)
      },
    })

    return () => {
      onPlayerActionsChange(null)
    }
  }, [onPlayerActionsChange])

  useEffect(() => {
    const jobId = activeTranscriptionJobIdRef.current

    if (jobId) {
      void window.transcriptionApi.cancel(jobId)
    }

    activeTranscriptionJobIdRef.current = null
    setActiveTranscriptionJobId(null)
    setTranscriptionProgress(null)
    onTranscriptionProgressChange(null)
    setTranscriptionError(null)
    setStoredTranscription(null)
    onTranscriptionCleared()

    selectedVideoIdRef.current = selectedVideo?.id ?? null
    setPlaybackState({ currentTime: 0, duration: 0 })
    setSegment(null)
    setSegmentVideoId(null)
    setIsPlayingSegment(false)

    if (saveDebounceRef.current !== null) {
      window.clearTimeout(saveDebounceRef.current)
      saveDebounceRef.current = null
    }
  }, [selectedVideo?.id])

  useEffect(() => {
    return () => {
      const jobId = activeTranscriptionJobIdRef.current

      if (jobId) {
        void window.transcriptionApi.cancel(jobId)
      }
    }
  }, [])

  useEffect(() => {
    const unsubscribeProgress = window.transcriptionApi.onProgress((progress) => {
      if (progress.jobId === activeTranscriptionJobIdRef.current) {
        setTranscriptionProgress(progress)
        onTranscriptionProgressChange(progress)
        setTranscriptionError(null)
      }
    })
    const unsubscribeBlocksAvailable = window.transcriptionApi.onBlocksAvailable((event) => {
      if (event.jobId === activeTranscriptionJobIdRef.current && segment) {
        onTranscriptionBlocksAvailable(blocksEventToResult(event, segment))
      }
    })
    const unsubscribeCompleted = window.transcriptionApi.onCompleted((result) => {
      if (!activeTranscriptionJobIdRef.current) {
        return
      }

      activeTranscriptionJobIdRef.current = null
      setActiveTranscriptionJobId(null)
      setTranscriptionProgress(null)
      onTranscriptionProgressChange(null)
      setTranscriptionError(null)
      void handleCompletedTranscription(result)
    })
    const unsubscribeError = window.transcriptionApi.onError((payload) => {
      if (payload.jobId && payload.jobId !== activeTranscriptionJobIdRef.current) {
        return
      }

      activeTranscriptionJobIdRef.current = null
      setActiveTranscriptionJobId(null)
      setTranscriptionProgress(null)
      onTranscriptionProgressChange(null)
      setTranscriptionError(toFriendlyTranscriptionError(payload.message))
      onTranscriptionInterrupted('error')
    })
    const unsubscribeCancelled = window.transcriptionApi.onCancelled((payload) => {
      if (payload.jobId !== activeTranscriptionJobIdRef.current) {
        return
      }

      activeTranscriptionJobIdRef.current = null
      setActiveTranscriptionJobId(null)
      setTranscriptionProgress(null)
      onTranscriptionProgressChange(null)
      setTranscriptionError('Transcriere anulata.')
      onTranscriptionInterrupted('cancelled')
    })

    return () => {
      unsubscribeProgress()
      unsubscribeBlocksAvailable()
      unsubscribeCompleted()
      unsubscribeError()
      unsubscribeCancelled()
    }
  }, [onTranscriptionBlocksAvailable, onTranscriptionCleared, onTranscriptionCompleted, onTranscriptionInterrupted, onTranscriptionProgressChange, onTranscriptionRestored, segment, storedTranscription])

  useEffect(() => {
    if (!isPlayingSegment || !segment) {
      return
    }

    const video = playerRef.current?.videoElement

    if (!video) {
      return
    }

    const activeVideo = video

    function stopAtSegmentOut() {
      if (!segment || activeVideo.currentTime < segment.outSeconds) {
        return
      }

      activeVideo.pause()
      activeVideo.currentTime = segment.outSeconds
      setIsPlayingSegment(false)
    }

    activeVideo.addEventListener('timeupdate', stopAtSegmentOut)
    activeVideo.addEventListener('ended', stopAtSegmentOut)

    return () => {
      activeVideo.removeEventListener('timeupdate', stopAtSegmentOut)
      activeVideo.removeEventListener('ended', stopAtSegmentOut)
    }
  }, [isPlayingSegment, segment])

  function setIn() {
    updateSegment({
      inSeconds: playbackState.currentTime,
      outSeconds: segment?.outSeconds ?? playbackState.duration,
    }, true)
  }

  function setOut() {
    updateSegment({
      inSeconds: segment?.inSeconds ?? 0,
      outSeconds: playbackState.currentTime,
    }, true)
  }

  function goToIn() {
    if (segment) {
      playerRef.current?.seek(segment.inSeconds)
    }
  }

  function goToOut() {
    if (segment) {
      playerRef.current?.seek(segment.outSeconds)
    }
  }

  async function playSegment() {
    const video = playerRef.current?.videoElement

    if (!video || !segment) {
      return
    }

    setIsPlayingSegment(true)
    video.pause()
    video.currentTime = segment.inSeconds

    try {
      await video.play()
    } catch {
      setIsPlayingSegment(false)
    }
  }

  async function togglePlayback() {
    const video = playerRef.current?.videoElement

    if (!video) {
      return
    }

    if (video.paused) {
      try {
        await video.play()
      } catch {
        // Native controls remain available if playback is rejected.
      }
      return
    }

    video.pause()
  }

  async function seekAndPlay(timeSeconds: number) {
    const video = playerRef.current?.videoElement

    if (!video) {
      return
    }

    setIsPlayingSegment(false)
    video.currentTime = timeSeconds

    try {
      await video.play()
    } catch {
      // Native controls remain available if autoplay is rejected.
    }
  }

  async function playAbsoluteRange(startSeconds: number, endSeconds: number) {
    const video = playerRef.current?.videoElement

    if (!video || endSeconds <= startSeconds) {
      return
    }

    setIsPlayingSegment(true)
    video.pause()
    video.currentTime = startSeconds

    const stopAtEnd = () => {
      if (video.currentTime < endSeconds) {
        return
      }

      video.pause()
      video.currentTime = endSeconds
      setIsPlayingSegment(false)
      video.removeEventListener('timeupdate', stopAtEnd)
      video.removeEventListener('ended', stopAtEnd)
    }

    video.addEventListener('timeupdate', stopAtEnd)
    video.addEventListener('ended', stopAtEnd)

    try {
      await video.play()
    } catch {
      setIsPlayingSegment(false)
      video.removeEventListener('timeupdate', stopAtEnd)
      video.removeEventListener('ended', stopAtEnd)
    }
  }

  function stopSegment() {
    const video = playerRef.current?.videoElement

    setIsPlayingSegment(false)
    video?.pause()
  }

  function seekVideoBy(deltaSeconds: number) {
    const video = playerRef.current?.videoElement

    if (!video) {
      return
    }

    const minimum = isPlayingSegment && segment ? segment.inSeconds : 0
    const maximum = isPlayingSegment && segment ? segment.outSeconds : playbackState.duration

    video.currentTime = calculateSeekTarget(video.currentTime, deltaSeconds, minimum, maximum)
  }

  async function restoreSegmentForVideo(videoId: string, duration: number) {
    const project = await window.projectApi.load(videoId)

    if (selectedVideoIdRef.current !== videoId) {
      return
    }

    const restoredSelection = project?.selection && isValidSegmentSelection(project.selection, duration)
      ? project.selection
      : {
        inSeconds: 0,
        outSeconds: duration,
      }
    const normalized = normalizeSegmentSelection(restoredSelection, duration)
    const normalizedSelection = normalized ?? normalizeSegmentSelection({
      inSeconds: 0,
      outSeconds: duration,
    }, duration)

    setSegment(normalizedSelection)

    if (!project?.transcription || !normalizedSelection) {
      setStoredTranscription(null)
      onTranscriptionCleared()
      return
    }

    setStoredTranscription(project.transcription)
    onTranscriptionRestored(
      storedTranscriptionToResult(project.transcription),
      isTranscriptCurrent(project.transcription, normalizedSelection),
    )
  }

  function updateSegment(nextSegment: SegmentSelection, shouldSave = false) {
    const normalized = normalizeSegmentSelection(nextSegment, playbackState.duration)

    if (normalized) {
      setSegment(normalized)
      updateRestoredTranscriptionState(normalized)

      if (shouldSave) {
        scheduleSelectionSave(normalized)
      }
    }
  }

  function scheduleSelectionSave(nextSegment: SegmentSelection) {
    if (!selectedVideo) {
      return
    }

    if (saveDebounceRef.current !== null) {
      window.clearTimeout(saveDebounceRef.current)
    }

    const videoId = selectedVideo.id
    saveDebounceRef.current = window.setTimeout(() => {
      void window.projectApi.saveSelection(videoId, nextSegment)
      saveDebounceRef.current = null
    }, 250)
  }

  async function transcribeSegment() {
    if (!selectedVideo || !segment || activeTranscriptionJobId) {
      return
    }

    setTranscriptionError(null)
    onTranscriptionStarted()

    try {
      const response = await window.transcriptionApi.start({
        videoId: selectedVideo.id,
        inSeconds: segment.inSeconds,
        outSeconds: segment.outSeconds,
        language: 'ro',
      })

      activeTranscriptionJobIdRef.current = response.jobId
      setActiveTranscriptionJobId(response.jobId)
      setTranscriptionProgress({
        jobId: response.jobId,
        phase: 'preparing',
        percent: 0,
        chunkIndex: 0,
        chunkCount: 1,
      })
      onTranscriptionProgressChange({
        jobId: response.jobId,
        phase: 'preparing',
        percent: 0,
        chunkIndex: 0,
        chunkCount: 1,
      })
    } catch (error) {
      setTranscriptionError(toFriendlyTranscriptionError(error instanceof Error ? error.message : 'Transcrierea nu a putut porni.'))
      onTranscriptionProgressChange(null)
      onTranscriptionInterrupted('error')
    }
  }

  async function handleCompletedTranscription(result: LocalTranscriptionResult) {
    const videoId = selectedVideoIdRef.current

    if (!videoId) {
      onTranscriptionCompleted(result, null)
      return
    }

    let transcriptionCreatedAt: string | null = null

    try {
      const project = await window.projectApi.saveTranscription(videoId, result)
      setStoredTranscription(project.transcription ?? null)
      transcriptionCreatedAt = project.transcription?.createdAt ?? null
    } catch {
      setTranscriptionError('Transcriptul a fost generat, dar nu a putut fi salvat local.')
    }

    onTranscriptionCompleted(result, transcriptionCreatedAt)
  }

  function handleTimelineSegmentChange(nextSegment: SegmentSelection) {
    setSegment(nextSegment)
    updateRestoredTranscriptionState(nextSegment)
  }

  function handleTimelineSegmentCommit(nextSegment: SegmentSelection) {
    updateRestoredTranscriptionState(nextSegment)
    scheduleSelectionSave(nextSegment)
  }

  function updateRestoredTranscriptionState(nextSegment: SegmentSelection) {
    if (storedTranscription) {
      onTranscriptionStaleChange(!isTranscriptCurrent(storedTranscription, nextSegment))
    }
  }

  function cancelTranscription() {
    const jobId = activeTranscriptionJobIdRef.current

    if (jobId) {
      void window.transcriptionApi.cancel(jobId)
    }
  }

  const selectedFileExtension = selectedVideo ? getFileExtension(selectedVideo.fileName) : null
  const transcriptionPercent = Math.round(transcriptionProgress?.percent ?? 0)
  const transcriptionTone = transcriptionError ? 'error' : transcriptionProgress?.phase === 'completed' ? 'completed' : 'active'
  const transcriptionPhaseLabel = transcriptionError
    ? getTranscriptionErrorLabel(transcriptionError)
    : transcriptionProgress
      ? getProgressPhaseLabel(transcriptionProgress.phase)
      : 'Pregatit pentru transcriere'

  return (
    <section className='media-workspace flex min-h-0 flex-col gap-2 overflow-hidden rounded-monitor border border-editorial-line bg-studio-900/76 p-3 shadow-panel lg:rounded-r-none lg:border-r-0' aria-label='Spatiu video'>
      <header className='media-workspace__toolbar flex shrink-0 items-center justify-between gap-3 rounded-studio border border-editorial-line bg-studio-850/72 px-3 py-1.5'>
        <div className='flex min-w-0 items-center gap-3'>
          <button className='select-video-button studio-button bg-signal-cyan text-studio-950 hover:bg-signal-cyan/90' type='button' onClick={() => void onSelectVideo()}>
          <FolderOpen size={16} />
          Select Video
        </button>
          <div className='min-w-0'>
            <div className='flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-editorial-subtle'>
              <FileVideo size={13} />
              Fisier selectat
            </div>
            {selectedVideo ? (
              <div className='mt-0.5 flex min-w-0 items-center gap-2'>
                <span className='truncate text-sm font-bold text-editorial-text' title={selectedVideo.fileName}>{selectedVideo.fileName}</span>
                {selectedFileExtension && (
                  <span className='studio-badge shrink-0 px-2 py-0.5 font-mono text-[10px] uppercase text-signal-amber'>{selectedFileExtension}</span>
                )}
              </div>
            ) : (
              <p className='m-0 text-sm text-editorial-muted'>Niciun fisier incarcat.</p>
            )}
          </div>
        </div>
      </header>

      {selectedVideo ? (
        <VideoPlayer
          key={selectedVideo.id}
          ref={playerRef}
          source={selectedVideo}
          playbackRate={playbackRate}
          onPlaybackStateChange={handlePlaybackStateChange}
        />
      ) : (
        <div className='player-stage relative flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden rounded-monitor border border-dashed border-editorial-line bg-studio-850/80 p-8 text-center text-editorial-muted'>
          <div className='pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(86,216,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(86,216,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]' aria-hidden='true' />
          <div className='relative flex h-14 w-14 items-center justify-center rounded-studio border border-signal-cyan/30 bg-studio-900 text-signal-cyan shadow-monitor'>
            <Film size={30} />
          </div>
          <div className='relative grid max-w-[420px] gap-2'>
            <h2 className='m-0 text-lg font-extrabold text-editorial-text'>Pregateste materialul</h2>
            <p className='m-0 text-sm text-editorial-muted'>Selecteaza un fisier video si marcheaza fragmentul care trebuie transcris.</p>
          </div>
          <button className='select-video-button studio-button relative bg-signal-cyan text-studio-950 hover:bg-signal-cyan/90' type='button' onClick={() => void onSelectVideo()}>
            <FolderOpen size={16} />
            Select Video
          </button>
        </div>
      )}

      {selectedVideo && (
        <div className='segment-controls flex shrink-0 flex-col gap-2 border-t border-editorial-line pt-2'>
          {segment && (
            <SegmentTimeline
              duration={playbackState.duration}
              currentTime={playbackState.currentTime}
              segment={segment}
              onSegmentChange={handleTimelineSegmentChange}
              onSegmentCommit={handleTimelineSegmentCommit}
              onSeek={(timeSeconds) => playerRef.current?.seek(timeSeconds)}
            />
          )}
          <div className='segment-controls__console grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)_minmax(280px,0.8fr)]'>
            <section className='studio-panel flex flex-wrap items-center gap-2 p-2' aria-label='Navigare video'>
              <div className='mr-1 text-[10px] font-black uppercase tracking-[0.18em] text-editorial-subtle'>Navigare</div>
              <button className='studio-button min-w-0 px-2.5 active:scale-95' type='button' aria-label='Inapoi 5 secunde' title='Inapoi 5 secunde' onClick={() => seekVideoBy(-5)} disabled={!selectedVideo}><ChevronsLeft size={15} />-5s</button>
              <button className='studio-button min-w-0 px-2.5 active:scale-95' type='button' aria-label='Inapoi 1 secunda' title='Inapoi 1 secunda' onClick={() => seekVideoBy(-1)} disabled={!selectedVideo}><ChevronLeft size={15} />-1s</button>
              <button className='studio-button bg-signal-cyan text-studio-950 hover:bg-signal-cyan/90 active:scale-95' type='button' title='Reda segmentul selectat' onClick={() => void playSegment()} disabled={!segment}><Play size={15} />Play Segment</button>
              <button className='studio-button min-w-0 px-2.5 active:scale-95' type='button' aria-label='Inainte 1 secunda' title='Inainte 1 secunda' onClick={() => seekVideoBy(1)} disabled={!selectedVideo}>+1s</button>
              <button className='studio-button min-w-0 px-2.5 active:scale-95' type='button' aria-label='Inainte 5 secunde' title='Inainte 5 secunde' onClick={() => seekVideoBy(5)} disabled={!selectedVideo}>+5s<ChevronsRight size={15} /></button>
            </section>

            <section className='studio-panel flex flex-wrap items-center gap-2 p-2' aria-label='Comenzi segment'>
              <div className='mr-1 text-[10px] font-black uppercase tracking-[0.18em] text-editorial-subtle'>Segment</div>
              <button className='studio-button border-signal-amber/45 bg-signal-amber/10 text-signal-amber active:scale-95' type='button' title='Seteaza markerul IN la pozitia curenta' onClick={setIn} disabled={!segment}><Brackets size={15} />Set IN</button>
              <button className='studio-button border-signal-coral/45 bg-signal-coral/10 text-signal-coral active:scale-95' type='button' title='Seteaza markerul OUT la pozitia curenta' onClick={setOut} disabled={!segment}><Brackets size={15} />Set OUT</button>
              <button className='studio-button active:scale-95' type='button' title='Mergi la markerul IN' onClick={goToIn} disabled={!segment}><ChevronLeft size={15} />Go to IN</button>
              <button className='studio-button active:scale-95' type='button' title='Mergi la markerul OUT' onClick={goToOut} disabled={!segment}>Go to OUT<ChevronsRight size={15} /></button>
              <button className='studio-button border-signal-coral/35 bg-signal-coral/10 text-signal-coral active:scale-95' type='button' title='Opreste redarea segmentului' onClick={stopSegment} disabled={!segment || !isPlayingSegment}><Square size={15} />Stop Segment</button>
            </section>

            <section className='studio-panel grid gap-2 p-2' aria-label='Transcriere si viteza'>
              <div className='flex flex-wrap items-center gap-2'>
                <button className='studio-button flex-1 border-signal-amber/55 bg-signal-amber text-studio-950 hover:bg-signal-amber/90 active:scale-95 disabled:bg-studio-750 disabled:text-editorial-muted' type='button' title='Transcrie segmentul selectat local' onClick={() => void transcribeSegment()} disabled={!selectedVideo || !segment || !!activeTranscriptionJobId}>
                  <AudioLines size={16} className={activeTranscriptionJobId ? 'animate-progressPulse' : ''} />
                  {activeTranscriptionJobId ? 'Transcribing...' : 'Transcribe Segment'}
                </button>
                <button className='studio-button border-signal-coral/45 bg-signal-coral/10 text-signal-coral active:scale-95' type='button' title='Anuleaza transcrierea activa' onClick={cancelTranscription} disabled={!activeTranscriptionJobId}><X size={15} />Cancel</button>
              </div>
              <label className='playback-rate-control flex items-center justify-between gap-3 rounded-control border border-editorial-line bg-studio-900/70 px-3 py-1.5'>
                <span className='flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-editorial-subtle'>
                  <Gauge size={14} className='text-signal-amber' />
                  Viteza
                </span>
                <select
                  className='rounded-md border border-editorial-line bg-studio-900 px-2 py-1 font-mono text-sm text-signal-amber studio-focus'
                  value={String(playbackRate)}
                  onChange={(event) => onPlaybackRateChange(Number(event.target.value) as PlaybackRate)}
                  title='Schimba viteza de redare'
                  aria-label='Viteza de redare'
                >
                  {PLAYBACK_RATES.map((rate) => (
                    <option key={rate} value={String(rate)}>{rate}×</option>
                  ))}
                </select>
              </label>
            </section>
          </div>
          <div className='transcription-status studio-panel grid gap-2 p-2.5' aria-label='Stare transcriere locala' aria-live='polite'>
            <div className='transcription-status__meta flex flex-wrap gap-2 text-xs'>
              <span className='studio-badge rounded-control px-3 py-1.5'><span className='text-[10px] font-black uppercase tracking-[0.16em] text-editorial-subtle'>Model</span><span className='font-mono text-editorial-text'>small-q5_1</span></span>
              <span className='studio-badge rounded-control px-3 py-1.5'><span className='text-[10px] font-black uppercase tracking-[0.16em] text-editorial-subtle'>Limba</span><span className='font-mono text-editorial-text'>RO</span></span>
              <span className='studio-badge rounded-control px-3 py-1.5'><span className='text-[10px] font-black uppercase tracking-[0.16em] text-editorial-subtle'>Engine</span><span className='h-1.5 w-1.5 rounded-full bg-signal-green' aria-hidden='true' /><span className='font-mono text-signal-green'>LOCAL</span></span>
              {transcriptionError && <span className='studio-badge rounded-control border-signal-coral/45 bg-signal-coral/10 px-3 py-1.5 text-signal-coral'>INCOMPLET</span>}
            </div>
            <div className='transcription-status__progress grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center'>
              <div className='min-w-0'>
                <div className='flex items-center gap-2 text-sm font-semibold text-editorial-text'>
                  {transcriptionProgress && !transcriptionError && <span className='h-2 w-2 rounded-full bg-signal-cyan animate-recordingSignal' aria-hidden='true' />}
                  <span>{transcriptionPhaseLabel}</span>
                </div>
                {transcriptionProgress && (
                  <p className='m-0 mt-1 text-xs text-editorial-muted'>
                    Fereastra {transcriptionProgress.chunkIndex + 1} din {transcriptionProgress.chunkCount}
                  </p>
                )}
                {transcriptionError && <p className='m-0 mt-1 text-xs text-signal-coral'>{transcriptionError}</p>}
              </div>
              <span className={`font-mono text-xl font-black tabular-nums ${getProgressTextClass(transcriptionTone)}`}>{transcriptionPercent}%</span>
            </div>
            <div
              className='transcription-status__bar h-2.5 overflow-hidden rounded-full bg-studio-700'
              role='progressbar'
              aria-valuenow={transcriptionPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={`h-full rounded-full transition-[width] duration-300 ease-out ${getProgressBarClass(transcriptionTone)}`} style={{ width: `${transcriptionPercent}%` }} />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function getProgressPhaseLabel(phase: LocalTranscriptionProgress['phase']) {
  switch (phase) {
    case 'preparing':
      return 'Pregatire audio'
    case 'extracting-chunk':
      return 'Extragere audio'
    case 'transcribing-chunk':
      return 'Transcriere locala'
    case 'merging':
      return 'Consolidare rezultat'
    case 'completed':
      return 'Transcriere finalizata'
  }
}

function getTranscriptionErrorLabel(message: string) {
  return /anulat/i.test(message) || /anulata/i.test(message)
    ? 'Transcriere anulata'
    : 'Eroare'
}

function getProgressBarClass(tone: 'active' | 'completed' | 'error') {
  switch (tone) {
    case 'completed':
      return 'bg-signal-green'
    case 'error':
      return 'bg-signal-coral'
    case 'active':
      return 'bg-signal-cyan'
  }
}

function getProgressTextClass(tone: 'active' | 'completed' | 'error') {
  switch (tone) {
    case 'completed':
      return 'text-signal-green'
    case 'error':
      return 'text-signal-coral'
    case 'active':
      return 'text-signal-cyan'
  }
}

function toFriendlyTranscriptionError(message: string) {
  if (/already running/i.test(message)) {
    return 'Exista deja o transcriere in curs.'
  }

  if (/cancel/i.test(message)) {
    return 'Transcriere anulata.'
  }

  if (/selected video/i.test(message)) {
    return 'Videoclipul selectat nu mai este disponibil.'
  }

  return 'Transcrierea locala a esuat.'
}

function storedTranscriptionToResult(transcription: StoredLocalTranscription): LocalTranscriptionResult {
  return {
    engine: transcription.engine,
    model: transcription.model,
    language: transcription.language,
    sourceInSeconds: transcription.sourceSelection.inSeconds,
    sourceOutSeconds: transcription.sourceSelection.outSeconds,
    fullText: transcription.fullText,
    segments: transcription.segments.map(cloneTranscriptSegment),
    createdAt: transcription.createdAt,
  }
}

function blocksEventToResult(
  event: TranscriptBlocksAvailableEvent,
  selection: SegmentSelection,
): LocalTranscriptionResult {
  return {
    engine: 'whisper.cpp',
    model: 'small-q5_1',
    language: 'ro',
    sourceInSeconds: selection.inSeconds,
    sourceOutSeconds: selection.outSeconds,
    fullText: event.blocks.map((block) => block.text).join(' '),
    segments: event.blocks.map(cloneTranscriptSegment),
  }
}

function cloneTranscriptSegment(segment: LocalTranscriptSegment): LocalTranscriptSegment {
  return { ...segment }
}

function getFileExtension(fileName: string) {
  const extension = fileName.split('.').pop()

  if (!extension || extension === fileName) {
    return null
  }

  return extension
}
