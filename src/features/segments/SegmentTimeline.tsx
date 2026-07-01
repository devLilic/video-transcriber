import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { SegmentSelection } from '@/shared/media/types'
import { MIN_SEGMENT_SECONDS, normalizeSegmentSelection } from '@/features/media/segmentSelection'
import { formatTimecode } from '@/features/media/timecode'

type DragTarget = 'in' | 'out' | null

interface SegmentTimelineProps {
  duration: number
  currentTime: number
  segment: SegmentSelection
  onSegmentChange: (segment: SegmentSelection) => void
  onSegmentCommit?: (segment: SegmentSelection) => void
  onSeek: (timeSeconds: number) => void
}

export function SegmentTimeline({
  duration,
  currentTime,
  segment,
  onSegmentChange,
  onSegmentCommit,
  onSeek,
}: SegmentTimelineProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const latestSegmentRef = useRef(segment)
  const [dragTarget, setDragTarget] = useState<DragTarget>(null)

  useEffect(() => {
    latestSegmentRef.current = segment
  }, [segment])

  useEffect(() => {
    if (!dragTarget) {
      return
    }

    const activeDragTarget = dragTarget

    function handlePointerMove(event: globalThis.PointerEvent) {
      updateDraggedMarker(event.clientX, activeDragTarget)
    }

    function handlePointerUp() {
      setDragTarget(null)
      onSegmentCommit?.(latestSegmentRef.current)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragTarget, segment, duration, onSegmentCommit])

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0
  const inPercent = toPercent(segment.inSeconds, safeDuration)
  const outPercent = toPercent(segment.outSeconds, safeDuration)
  const currentPercent = toPercent(currentTime, safeDuration)
  const selectedDuration = Math.max(segment.outSeconds - segment.inSeconds, 0)

  function handleTrackPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return
    }

    onSeek(getTimeFromClientX(event.clientX))
  }

  function handleMarkerPointerDown(event: PointerEvent<HTMLButtonElement>, target: Exclude<DragTarget, null>) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragTarget(target)
    updateDraggedMarker(event.clientX, target)
  }

  function updateDraggedMarker(clientX: number, target: Exclude<DragTarget, null>) {
    const time = getTimeFromClientX(clientX)
    const nextSegment = target === 'in'
      ? { inSeconds: Math.min(time, segment.outSeconds - MIN_SEGMENT_SECONDS), outSeconds: segment.outSeconds }
      : { inSeconds: segment.inSeconds, outSeconds: Math.max(time, segment.inSeconds + MIN_SEGMENT_SECONDS) }
    const normalized = normalizeSegmentSelection(nextSegment, safeDuration)

    if (normalized) {
      onSegmentChange(normalized)
    }
  }

  function getTimeFromClientX(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect()

    if (!rect || rect.width <= 0 || safeDuration <= 0) {
      return 0
    }

    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    return ratio * safeDuration
  }

  return (
    <div className='segment-timeline w-full rounded-studio border border-editorial-line bg-studio-850/72 px-4 py-2.5 shadow-inner' aria-label='Segment timeline'>
      <div
        ref={trackRef}
        className='segment-timeline__track relative mt-5 h-2 cursor-pointer rounded-full bg-studio-700 shadow-inner'
        onPointerDown={handleTrackPointerDown}
      >
        <div
          className='segment-timeline__played pointer-events-none absolute inset-y-0 left-0 rounded-full bg-signal-cyan/55'
          style={{ width: `${currentPercent}%` }}
        />
        <div
          className='segment-timeline__outside segment-timeline__outside--before pointer-events-none absolute inset-y-0 left-0 rounded-l-full bg-studio-950/50'
          style={{ width: `${inPercent}%` }}
        />
        <div
          className='segment-timeline__selection pointer-events-none absolute inset-y-0 rounded-full bg-signal-amber/35 ring-1 ring-inset ring-signal-amber/25'
          style={{
            left: `${inPercent}%`,
            width: `${Math.max(outPercent - inPercent, 0)}%`,
          }}
        />
        <div
          className='segment-timeline__outside segment-timeline__outside--after pointer-events-none absolute inset-y-0 right-0 rounded-r-full bg-studio-950/50'
          style={{ width: `${Math.max(100 - outPercent, 0)}%` }}
        />
        <div
          className='segment-timeline__playhead pointer-events-none absolute -top-4 -bottom-4 z-20 w-0.5 bg-signal-cyan shadow-[0_0_16px_rgba(86,216,255,0.62)]'
          style={{ left: `${currentPercent}%` }}
        >
          <span className='absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-studio-950 bg-signal-cyan shadow-[0_0_14px_rgba(86,216,255,0.7)]' />
        </div>
        <button
          className='segment-timeline__marker segment-timeline__marker--in group absolute top-1/2 z-30 flex h-7 w-5 cursor-ew-resize items-center justify-center rounded-md border border-studio-950 bg-signal-amber p-0 font-mono text-[8px] font-black text-studio-950 shadow-monitor transition hover:ring-2 hover:ring-signal-amber/40 studio-focus'
          type='button'
          aria-label='Marker IN'
          title={`IN ${formatTimecode(segment.inSeconds)}`}
          style={{ left: `${inPercent}%` }}
          onPointerDown={(event) => handleMarkerPointerDown(event, 'in')}
        >
          IN
        </button>
        <button
          className='segment-timeline__marker segment-timeline__marker--out group absolute top-1/2 z-30 flex h-7 w-5 cursor-ew-resize items-center justify-center rounded-md border border-studio-950 bg-signal-coral p-0 font-mono text-[8px] font-black text-studio-950 shadow-monitor transition hover:ring-2 hover:ring-signal-coral/40 studio-focus'
          type='button'
          aria-label='Marker OUT'
          title={`OUT ${formatTimecode(segment.outSeconds)}`}
          style={{ left: `${outPercent}%` }}
          onPointerDown={(event) => handleMarkerPointerDown(event, 'out')}
        >
          OUT
        </button>
      </div>
      <div className='segment-timeline__timecodes mt-5 grid gap-2 text-xs sm:grid-cols-3'>
        <TimecodeCapsule label='IN' value={formatTimecode(segment.inSeconds)} tone='amber' />
        <TimecodeCapsule label='OUT' value={formatTimecode(segment.outSeconds)} tone='coral' />
        <TimecodeCapsule label='DUR' value={formatTimecode(selectedDuration)} tone='cyan' />
      </div>
    </div>
  )
}

function TimecodeCapsule({ label, value, tone }: { label: string; value: string; tone: 'amber' | 'coral' | 'cyan' }) {
  const toneClass = {
    amber: 'border-signal-amber/45 bg-signal-amber/10 text-signal-amber',
    coral: 'border-signal-coral/45 bg-signal-coral/10 text-signal-coral',
    cyan: 'border-signal-cyan/35 bg-signal-cyan/10 text-signal-cyan',
  }[tone]

  return (
    <div className={`segment-timeline__timecode flex items-center justify-between gap-3 rounded-full border px-3 py-1 ${toneClass}`}>
      <span className='text-[10px] font-black uppercase tracking-[0.18em]'>{label}</span>
      <span className='font-mono text-xs tabular-nums'>{value}</span>
    </div>
  )
}

function toPercent(value: number, duration: number) {
  if (!Number.isFinite(value) || duration <= 0) {
    return 0
  }

  return Math.min(Math.max((value / duration) * 100, 0), 100)
}
