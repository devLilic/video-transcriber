import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { LocalTranscriptSegment } from '@/shared/local-transcription/types'
import { formatTimecode } from '@/features/media/timecode'

interface EditableTranscriptSegmentProps {
  segment: LocalTranscriptSegment
  isActive: boolean
  isEditable: boolean
  isTemporary: boolean
  isIncomplete: boolean
  onSeekToSegment: (segment: LocalTranscriptSegment) => void
  onCommitText: (segment: LocalTranscriptSegment, nextText: string) => void | Promise<void>
}

export function EditableTranscriptSegment({
  segment,
  isActive,
  isEditable,
  isTemporary,
  isIncomplete,
  onSeekToSegment,
  onCommitText,
}: EditableTranscriptSegmentProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [draftText, setDraftText] = useState(segment.text)

  useEffect(() => {
    setDraftText(segment.text)
  }, [segment.id, segment.text])

  useEffect(() => {
    resizeTextarea(textareaRef.current)
  }, [draftText])

  useEffect(() => {
    if (draftText === segment.text) {
      return
    }

    if (!canEdit) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      onCommitText(segment, draftText)
    }, 500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [draftText, onCommitText, segment])

  function commitNow() {
    if (canEdit && draftText !== segment.text) {
      onCommitText(segment, draftText)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault()
      commitNow()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setDraftText(segment.text)
    }
  }

  const canEdit = isEditable && !isTemporary

  return (
    <article className={`transcript-segment relative mb-3 grid gap-3 rounded-studio border p-4 text-left shadow-sm animate-transcriptIn ${isActive ? 'transcript-segment--active border-signal-cyan/70 bg-signal-cyan/10' : 'border-editorial-line bg-studio-850/70 hover:border-editorial-subtle/80'} ${isTemporary ? 'opacity-75' : ''} ${isIncomplete ? 'border-signal-coral/45' : ''}`}>
      {isActive && <span className='absolute inset-y-3 left-0 w-1 rounded-r-full bg-signal-cyan shadow-[0_0_16px_rgba(86,216,255,0.5)]' aria-hidden='true' />}
      <header className='transcript-segment__header flex items-start justify-between gap-3'>
        <button
          className='transcript-segment__time studio-focus flex shrink-0 cursor-pointer items-center gap-2 rounded-control border border-editorial-line bg-studio-900/70 px-2.5 py-1.5 text-left font-mono text-xs text-signal-cyan transition hover:border-signal-cyan/60 hover:bg-signal-cyan/10'
          type='button'
          onClick={() => onSeekToSegment(segment)}
          title='Mergi la inceputul blocului'
        >
          <span>{formatTimecode(segment.absoluteStartSeconds)}</span>
          <span className='text-editorial-subtle'>-</span>
          <span>{formatTimecode(segment.absoluteEndSeconds)}</span>
        </button>
        <div className='transcript-segment__actions flex flex-wrap items-center justify-end gap-2'>
          {isActive && <span className='studio-badge border-signal-cyan/35 bg-signal-cyan/10 px-2 py-0.5 text-[10px] text-signal-cyan'>ACUM</span>}
          {segment.isEdited && <span className='transcript-segment__edited studio-badge border-signal-amber/45 bg-signal-amber/10 px-2 py-0.5 text-[10px] text-signal-amber'>EDITAT</span>}
          {isTemporary && <span className='studio-badge border-editorial-line bg-studio-900/80 px-2 py-0.5 text-[10px] text-editorial-muted'>SE CONFIRMA</span>}
          {isIncomplete && <span className='studio-badge border-signal-coral/45 bg-signal-coral/10 px-2 py-0.5 text-[10px] text-signal-coral'>INCOMPLET</span>}
        </div>
      </header>
      <textarea
        ref={textareaRef}
        className='transcript-segment__editor studio-focus min-h-[112px] w-full resize-none overflow-hidden rounded-control border border-editorial-line bg-studio-900/55 px-3 py-3 text-sm leading-[1.65] text-editorial-text placeholder:text-editorial-subtle selection:bg-signal-cyan/25 read-only:opacity-70'
        rows={3}
        value={draftText}
        readOnly={!canEdit}
        spellCheck
        lang='ro'
        onChange={(event) => setDraftText(event.target.value)}
        onBlur={commitNow}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      />
    </article>
  )
}

function resizeTextarea(textarea: HTMLTextAreaElement | null) {
  if (!textarea) {
    return
  }

  textarea.style.height = 'auto'
  textarea.style.height = `${textarea.scrollHeight}px`
}
