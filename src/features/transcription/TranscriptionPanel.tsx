import { useEffect, useRef } from 'react'
import { Captions, FileText, Trash2 } from 'lucide-react'
import type {
  LocalTranscriptSegment,
  LocalTranscriptionProgress,
  LocalTranscriptionResult,
} from '@/shared/local-transcription/types'
import { EditableTranscriptSegment } from './EditableTranscriptSegment'
import { findActiveTranscriptSegment } from './findActiveTranscriptSegment'

interface TranscriptionPanelProps {
  result: LocalTranscriptionResult | null
  isStale: boolean
  editError: string | null
  progress: LocalTranscriptionProgress | null
  displayStatus: 'idle' | 'transcribing' | 'partial-cancelled' | 'partial-error' | 'complete'
  isEditable: boolean
  currentTime: number
  onClearPartialResult: () => void
  onSeekToSegment: (segment: LocalTranscriptSegment) => void
  onCommitSegmentText: (segment: LocalTranscriptSegment, nextText: string) => void | Promise<void>
}

export function TranscriptionPanel({
  result,
  isStale,
  editError,
  progress,
  displayStatus,
  isEditable,
  currentTime,
  onClearPartialResult,
  onSeekToSegment,
  onCommitSegmentText,
}: TranscriptionPanelProps) {
  const activeSegment = result
    ? findActiveTranscriptSegment(result.segments, currentTime)
    : null
  const contentRef = useRef<HTMLDivElement | null>(null)
  const segmentCount = result?.segments.length ?? 0
  const isIncomplete = displayStatus === 'partial-cancelled' || displayStatus === 'partial-error'

  useEffect(() => {
    const content = contentRef.current

    if (!content || !result) {
      return
    }

    const activeElement = document.activeElement
    const isEditing = activeElement instanceof HTMLTextAreaElement
    const distanceFromBottom = content.scrollHeight - content.scrollTop - content.clientHeight

    if (!isEditing && distanceFromBottom < 96) {
      content.scrollTop = content.scrollHeight
    }
  }, [result?.segments.length])

  return (
    <aside className='transcription-panel flex min-h-[320px] flex-col overflow-hidden rounded-monitor border border-editorial-line bg-studio-900/80 shadow-panel lg:min-h-0 lg:rounded-l-none lg:border-l-0' aria-label='Transcriere'>
      <header className='transcription-panel__header sticky top-0 z-10 border-b border-editorial-line bg-studio-900/95 p-4 backdrop-blur'>
        <div className='flex flex-wrap items-center gap-2'>
          <h2 className='m-0 flex items-center gap-2 text-lg font-extrabold text-editorial-text'>
            <Captions size={19} className='text-signal-cyan' />
            Transcriere
          </h2>
          <span className='studio-badge px-2 py-0.5 font-mono text-[10px] text-signal-cyan'>RO</span>
          <span className='studio-badge px-2 py-0.5 font-mono text-[10px] text-signal-green'>LOCAL</span>
          <span className='studio-badge px-2 py-0.5 font-mono text-[10px]'>{segmentCount} {segmentCount === 1 ? 'bloc' : 'blocuri'}</span>
          <span className={`studio-badge px-2 py-0.5 text-[10px] ${getStatusBadgeClass(displayStatus)}`}>{getStatusLabel(displayStatus)}</span>
        </div>
        {displayStatus === 'transcribing' && (
          <div className='mt-3 flex items-center justify-between gap-3 rounded-control border border-editorial-line bg-studio-850/75 px-3 py-2 text-sm' aria-live='polite'>
            <span className='flex items-center gap-2 text-editorial-text'>
              <span className='h-2 w-2 rounded-full bg-signal-cyan animate-recordingSignal' aria-hidden='true' />
              Transcriere locala
            </span>
            <span className='text-editorial-muted'>{progress ? `Fereastra ${progress.chunkIndex + 1} din ${progress.chunkCount}` : 'Fereastra 1 din 1'}</span>
            <strong className='font-mono text-signal-cyan animate-progressPulse'>{Math.round(progress?.percent ?? 0)}%</strong>
          </div>
        )}
      </header>
      {result ? (
        <div ref={contentRef} className='transcription-panel__content min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4 text-editorial-text'>
          {isStale && (
            <p className='transcription-panel__notice mb-3 rounded-control border border-signal-amber/45 bg-signal-amber/10 px-3 py-2 text-sm text-signal-amber'>Transcript pentru o selectie anterioara.</p>
          )}
          {displayStatus === 'partial-cancelled' && (
            <div className='transcription-panel__notice mb-3 flex items-center justify-between gap-3 rounded-control border border-signal-amber/45 bg-signal-amber/10 px-3 py-2 text-sm text-signal-amber'>
              <span>Transcriere incompleta.</span>
              <button className='studio-button py-1.5 text-xs' type='button' onClick={onClearPartialResult}><Trash2 size={13} />Sterge rezultatul partial</button>
            </div>
          )}
          {displayStatus === 'partial-error' && (
            <p className='transcription-panel__error mb-3 rounded-control border border-signal-coral/45 bg-signal-coral/10 px-3 py-2 text-sm text-signal-coral'>Transcriere incompleta.</p>
          )}
          {editError && (
            <p className='transcription-panel__error mb-3 rounded-control border border-signal-coral/45 bg-signal-coral/10 px-3 py-2 text-sm text-signal-coral'>{editError}</p>
          )}
          {result.segments.map((segment) => (
            <EditableTranscriptSegment
              key={segment.id}
              segment={segment}
              isActive={activeSegment?.id === segment.id}
              isEditable={isEditable}
              isTemporary={displayStatus === 'transcribing'}
              isIncomplete={isIncomplete}
              onSeekToSegment={onSeekToSegment}
              onCommitText={onCommitSegmentText}
            />
          ))}
        </div>
      ) : (
        <div className='m-4 grid place-items-center rounded-studio border border-dashed border-editorial-line bg-studio-850/70 p-6 text-center text-editorial-muted'>
          <div className='grid max-w-[320px] gap-3'>
            <FileText className='mx-auto text-signal-cyan' size={32} />
            <h3 className='m-0 text-base font-extrabold text-editorial-text'>Transcriptul va aparea aici</h3>
            <p className='m-0 text-sm'>Dupa transcriere, blocurile vor putea fi citite, accesate si corectate aici.</p>
            <ol className='m-0 grid gap-1 pl-5 text-left text-sm'>
              <li>seteaza IN</li>
              <li>seteaza OUT</li>
              <li>apasa Transcribe Segment</li>
            </ol>
          </div>
        </div>
      )}
    </aside>
  )
}

function getStatusLabel(status: TranscriptionPanelProps['displayStatus']) {
  switch (status) {
    case 'transcribing':
      return 'In lucru'
    case 'partial-cancelled':
    case 'partial-error':
      return 'Incomplet'
    case 'complete':
      return 'Salvat'
    case 'idle':
      return 'Idle'
  }
}

function getStatusBadgeClass(status: TranscriptionPanelProps['displayStatus']) {
  switch (status) {
    case 'transcribing':
      return 'border-signal-cyan/35 bg-signal-cyan/10 text-signal-cyan'
    case 'partial-cancelled':
    case 'partial-error':
      return 'border-signal-coral/45 bg-signal-coral/10 text-signal-coral'
    case 'complete':
      return 'border-signal-green/35 bg-signal-green/10 text-signal-green'
    case 'idle':
      return 'text-editorial-muted'
  }
}
