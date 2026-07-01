import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { Info } from 'lucide-react'
import { VIDEO_HOTKEY_HELP_ITEMS } from './videoHotkeys'

export function VideoHotkeyInfo() {
  const panelId = useId()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})

  useEffect(() => {
    if (!isOpen) {
      return
    }

    updatePanelPosition()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
      }
    }

    function handlePointerDown(event: globalThis.PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node | null)) {
        setIsOpen(false)
      }
    }

    function handleResize() {
      updatePanelPosition()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('resize', handleResize)
    }
  }, [isOpen])

  function updatePanelPosition() {
    const rect = buttonRef.current?.getBoundingClientRect()

    if (!rect) {
      return
    }

    const top = Math.min(rect.bottom + 8, window.innerHeight - 240)
    const right = Math.max(window.innerWidth - rect.right, 16)
    const maxHeight = Math.max(window.innerHeight - top - 16, 220)

    setPanelStyle({
      position: 'fixed',
      top,
      right,
      maxHeight,
    })
  }

  return (
    <div
      ref={containerRef}
      className='video-hotkeys absolute right-3 top-3 z-30'
      onMouseEnter={() => setIsOpen(true)}
      onFocus={() => setIsOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false)
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={buttonRef}
        className='video-hotkeys__button flex h-9 w-9 items-center justify-center rounded-full border border-editorial-line bg-studio-900/90 text-editorial-text shadow-popup backdrop-blur transition hover:border-signal-cyan/70 hover:text-signal-cyan focus:outline-none focus:ring-2 focus:ring-signal-cyan/60'
        type='button'
        aria-label='Afișează comenzile rapide'
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Info size={18} />
      </button>
      {isOpen && (
        <div
          id={panelId}
          className='video-hotkeys__panel w-[min(360px,calc(100vw-72px))] overflow-y-auto rounded-studio border border-editorial-line bg-studio-950/96 p-3 text-sm text-editorial-text shadow-popup backdrop-blur'
          role='tooltip'
          style={panelStyle}
        >
          <div className='mb-2 flex items-center justify-between gap-3 border-b border-editorial-line pb-2'>
            <span className='text-[10px] font-black uppercase tracking-[0.18em] text-editorial-subtle'>Comenzi rapide</span>
            <span className='font-mono text-[10px] text-signal-cyan'>VIDEO</span>
          </div>
          <div className='grid'>
            {VIDEO_HOTKEY_HELP_ITEMS.map((item) => (
              <div key={item.keys} className='video-hotkeys__row grid min-h-9 grid-cols-[118px_minmax(0,1fr)] items-center gap-3 border-b border-editorial-line/70 py-2 last:border-b-0'>
                <kbd className='rounded-md border border-white/15 bg-white/10 px-2 py-1 text-center font-mono text-xs font-bold text-signal-cyan shadow-inner'>{item.keys}</kbd>
                <span className='text-sm text-editorial-muted'>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
