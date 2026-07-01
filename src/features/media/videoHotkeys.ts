import type { PlaybackRate } from './playbackRate'

export type VideoHotkeyAction =
  | { type: 'seek-by'; deltaSeconds: -5 | -1 | 1 | 5 }
  | { type: 'toggle-playback' }
  | { type: 'set-in' }
  | { type: 'set-out' }
  | { type: 'go-to-in' }
  | { type: 'go-to-out' }
  | { type: 'set-playback-rate'; playbackRate: PlaybackRate }

export interface VideoHotkeyEventLike {
  key: string
  shiftKey?: boolean
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  repeat?: boolean
  target?: unknown
}

interface VideoHotkeyDefinition {
  key: string
  shiftKey?: boolean
  altKey?: boolean
  allowRepeat: boolean
  action: VideoHotkeyAction
  display: {
    keys: string
    label: string
  }
}

export const VIDEO_HOTKEYS: readonly VideoHotkeyDefinition[] = [
  { key: 'ArrowLeft', allowRepeat: true, action: { type: 'seek-by', deltaSeconds: -1 }, display: { keys: '←', label: 'Înapoi 1 secundă' } },
  { key: 'ArrowRight', allowRepeat: true, action: { type: 'seek-by', deltaSeconds: 1 }, display: { keys: '→', label: 'Înainte 1 secundă' } },
  { key: 'ArrowLeft', shiftKey: true, allowRepeat: true, action: { type: 'seek-by', deltaSeconds: -5 }, display: { keys: 'Shift + ←', label: 'Înapoi 5 secunde' } },
  { key: 'ArrowRight', shiftKey: true, allowRepeat: true, action: { type: 'seek-by', deltaSeconds: 5 }, display: { keys: 'Shift + →', label: 'Înainte 5 secunde' } },
  { key: ' ', allowRepeat: false, action: { type: 'toggle-playback' }, display: { keys: 'Spațiu', label: 'Play / Pauză' } },
  { key: 'Space', allowRepeat: false, action: { type: 'toggle-playback' }, display: { keys: 'Spațiu', label: 'Play / Pauză' } },
  { key: 'i', allowRepeat: false, action: { type: 'set-in' }, display: { keys: 'I', label: 'Setează IN' } },
  { key: 'o', allowRepeat: false, action: { type: 'set-out' }, display: { keys: 'O', label: 'Setează OUT' } },
  { key: 'i', shiftKey: true, allowRepeat: false, action: { type: 'go-to-in' }, display: { keys: 'Shift + I', label: 'Mergi la IN' } },
  { key: 'o', shiftKey: true, allowRepeat: false, action: { type: 'go-to-out' }, display: { keys: 'Shift + O', label: 'Mergi la OUT' } },
  { key: '0', altKey: true, allowRepeat: false, action: { type: 'set-playback-rate', playbackRate: 0.75 }, display: { keys: 'Alt + 0', label: 'Viteză 0.75×' } },
  { key: '1', altKey: true, allowRepeat: false, action: { type: 'set-playback-rate', playbackRate: 1 }, display: { keys: 'Alt + 1', label: 'Viteză 1×' } },
  { key: '2', altKey: true, allowRepeat: false, action: { type: 'set-playback-rate', playbackRate: 1.2 }, display: { keys: 'Alt + 2', label: 'Viteză 1.2×' } },
  { key: '3', altKey: true, allowRepeat: false, action: { type: 'set-playback-rate', playbackRate: 1.5 }, display: { keys: 'Alt + 3', label: 'Viteză 1.5×' } },
  { key: '4', altKey: true, allowRepeat: false, action: { type: 'set-playback-rate', playbackRate: 2 }, display: { keys: 'Alt + 4', label: 'Viteză 2×' } },
]

export const VIDEO_HOTKEY_HELP_ITEMS = VIDEO_HOTKEYS
  .filter((hotkey, index, hotkeys) => hotkeys.findIndex((item) => item.display.keys === hotkey.display.keys) === index)
  .map((hotkey) => hotkey.display)

export function resolveVideoHotkey(event: VideoHotkeyEventLike): VideoHotkeyAction | null {
  if (event.ctrlKey || event.metaKey || isEditableHotkeyTarget(event.target)) {
    return null
  }

  const normalizedKey = normalizeKey(event.key)
  const definition = VIDEO_HOTKEYS.find((hotkey) => (
    hotkey.key === normalizedKey
    && Boolean(hotkey.shiftKey) === Boolean(event.shiftKey)
    && Boolean(hotkey.altKey) === Boolean(event.altKey)
  ))

  if (!definition || (event.repeat && !definition.allowRepeat)) {
    return null
  }

  return definition.action
}

function normalizeKey(key: string) {
  return key.length === 1 ? key.toLowerCase() : key
}

function isEditableHotkeyTarget(target: unknown) {
  if (!isRecord(target)) {
    return false
  }

  const tagName = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : ''

  return target.isContentEditable === true
    || tagName === 'INPUT'
    || tagName === 'TEXTAREA'
    || tagName === 'SELECT'
    || tagName === 'BUTTON'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
