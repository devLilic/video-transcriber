import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react'
import { AlertTriangle, CheckCircle2, Signal } from 'lucide-react'
import type { SelectedVideoSource } from '@/shared/media/types'
import { VideoHotkeyInfo } from './VideoHotkeyInfo'

type LoadingState = 'loading' | 'ready' | 'error'

export interface VideoPlayerHandle {
  videoElement: HTMLVideoElement | null
  currentTime: number
  duration: number
  seek: (timeSeconds: number) => void
}

interface VideoPlayerProps {
  source: SelectedVideoSource
  playbackRate: number
  onVideoElementChange?: (element: HTMLVideoElement | null) => void
  onPlaybackStateChange?: (state: { currentTime: number; duration: number }) => void
}

export const VideoPlayer = forwardRef(function VideoPlayer(
  { source, playbackRate, onVideoElementChange, onPlaybackStateChange }: VideoPlayerProps,
  ref: Ref<VideoPlayerHandle>,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')

  useImperativeHandle(ref, () => ({
    videoElement: videoRef.current,
    currentTime,
    duration,
    seek(timeSeconds: number) {
      if (!videoRef.current || !Number.isFinite(timeSeconds)) {
        return
      }

      videoRef.current.currentTime = Math.max(0, Math.min(timeSeconds, duration || timeSeconds))
    },
  }), [currentTime, duration])

  useEffect(() => {
    const video = videoRef.current

    setCurrentTime(0)
    setDuration(0)
    setLoadingState('loading')
    onPlaybackStateChange?.({ currentTime: 0, duration: 0 })

    if (!video) {
      return
    }

    video.pause()
    video.playbackRate = playbackRate
    video.currentTime = 0
    video.load()
  }, [source.id, onPlaybackStateChange])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  useEffect(() => {
    onVideoElementChange?.(videoRef.current)

    return () => {
      if (videoRef.current) {
        videoRef.current.pause()
      }

      onVideoElementChange?.(null)
    }
  }, [onVideoElementChange])

  function updatePlaybackState(nextCurrentTime: number, nextDuration = duration) {
    setCurrentTime(nextCurrentTime)
    setDuration(nextDuration)
    onPlaybackStateChange?.({
      currentTime: nextCurrentTime,
      duration: nextDuration,
    })
  }

  function handleLoadedMetadata() {
    const video = videoRef.current

    if (!video) {
      return
    }

    const nextDuration = Number.isFinite(video.duration) ? video.duration : 0

    setLoadingState('ready')
    updatePlaybackState(video.currentTime, nextDuration)
  }

  function handleTimeUpdate() {
    const video = videoRef.current

    if (!video) {
      return
    }

    updatePlaybackState(video.currentTime)
  }

  function handleError() {
    setLoadingState('error')
  }

  return (
    <div className='video-player grid min-h-[360px] flex-1 grid-rows-[minmax(340px,1fr)_auto] gap-2 2xl:min-h-[440px]'>
      <div className='video-player__surface relative flex min-h-[340px] items-center justify-center overflow-visible rounded-[18px] border border-studio-700 bg-black shadow-monitor ring-1 ring-black/70 2xl:min-h-[390px]'>
        <div className='pointer-events-none absolute left-4 top-3 z-10 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-editorial-muted backdrop-blur'>
          Source monitor
        </div>
        <div className='pointer-events-none absolute bottom-14 left-4 z-10 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-editorial-muted backdrop-blur'>
          Local file
        </div>
        <VideoHotkeyInfo />
        <video
          className='h-full max-h-full w-full rounded-[18px] bg-black'
          ref={videoRef}
          src={source.mediaUrl}
          controls
          preload='metadata'
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onDurationChange={handleLoadedMetadata}
          onWaiting={() => setLoadingState('loading')}
          onCanPlay={() => setLoadingState('ready')}
          onError={handleError}
        />
      </div>

      <div className={`video-player__status video-player__status--${loadingState} flex min-h-6 items-center gap-2 rounded-control border border-editorial-line bg-studio-850/70 px-3 py-1 text-sm text-editorial-muted`}>
        {loadingState === 'loading' && <><Signal className='animate-progressPulse text-editorial-muted' size={15} /> Se incarca metadatele video.</>}
        {loadingState === 'ready' && <><CheckCircle2 className='text-signal-green' size={15} /> Video pregatit pentru redare.</>}
        {loadingState === 'error' && <><AlertTriangle className='text-signal-coral' size={15} /> Videoclipul nu poate fi redat de Chromium in formatul selectat.</>}
      </div>
    </div>
  )
})
