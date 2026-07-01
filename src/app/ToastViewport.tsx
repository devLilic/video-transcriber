import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

export type AppToastTone = 'info' | 'success' | 'error'

export interface AppToast {
  id: string
  tone: AppToastTone
  message: string
}

interface ToastViewportProps {
  toasts: AppToast[]
  onDismiss: (id: string) => void
}

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div className='fixed right-4 top-20 z-50 grid w-[min(360px,calc(100vw-32px))] gap-2' aria-live='polite' aria-label='Notificari'>
      {toasts.map((toast) => (
        <div key={toast.id} className={`flex items-start gap-3 rounded-studio border bg-studio-900/96 p-3 text-sm shadow-popup backdrop-blur ${getToastToneClass(toast.tone)}`}>
          <ToastIcon tone={toast.tone} />
          <p className='m-0 min-w-0 flex-1 text-editorial-text'>{toast.message}</p>
          <button
            className='studio-icon-button h-7 w-7 shrink-0'
            type='button'
            aria-label='Inchide notificarea'
            onClick={() => onDismiss(toast.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

function ToastIcon({ tone }: { tone: AppToastTone }) {
  if (tone === 'success') {
    return <CheckCircle2 className='mt-0.5 shrink-0 text-signal-green' size={18} aria-hidden='true' />
  }

  if (tone === 'error') {
    return <AlertTriangle className='mt-0.5 shrink-0 text-signal-coral' size={18} aria-hidden='true' />
  }

  return <Info className='mt-0.5 shrink-0 text-signal-cyan' size={18} aria-hidden='true' />
}

function getToastToneClass(tone: AppToastTone) {
  switch (tone) {
    case 'success':
      return 'border-signal-green/35'
    case 'error':
      return 'border-signal-coral/45'
    case 'info':
      return 'border-signal-cyan/35'
  }
}
