import { useEffect } from 'react'
import { resolveVideoHotkey, type VideoHotkeyAction } from './videoHotkeys'

interface UseVideoHotkeysInput {
  enabled: boolean
  isModalOpen?: boolean
  onAction: (action: VideoHotkeyAction) => void
}

export function useVideoHotkeys({
  enabled,
  isModalOpen = false,
  onAction,
}: UseVideoHotkeysInput) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!enabled || isModalOpen) {
        return
      }

      const action = resolveVideoHotkey(event)

      if (!action) {
        return
      }

      event.preventDefault()
      onAction(action)
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, isModalOpen, onAction])
}
