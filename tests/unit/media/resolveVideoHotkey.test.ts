import { describe, expect, it } from 'vitest'
import { resolveVideoHotkey } from '../../../src/features/media/videoHotkeys'

describe('resolveVideoHotkey', () => {
  it('resolves every base hotkey', () => {
    expect(resolveVideoHotkey({ key: 'ArrowLeft' })).toEqual({ type: 'seek-by', deltaSeconds: -1 })
    expect(resolveVideoHotkey({ key: 'ArrowRight' })).toEqual({ type: 'seek-by', deltaSeconds: 1 })
    expect(resolveVideoHotkey({ key: ' ' })).toEqual({ type: 'toggle-playback' })
    expect(resolveVideoHotkey({ key: 'i' })).toEqual({ type: 'set-in' })
    expect(resolveVideoHotkey({ key: 'o' })).toEqual({ type: 'set-out' })
  })

  it('resolves shift hotkeys', () => {
    expect(resolveVideoHotkey({ key: 'ArrowLeft', shiftKey: true })).toEqual({ type: 'seek-by', deltaSeconds: -5 })
    expect(resolveVideoHotkey({ key: 'ArrowRight', shiftKey: true })).toEqual({ type: 'seek-by', deltaSeconds: 5 })
    expect(resolveVideoHotkey({ key: 'I', shiftKey: true })).toEqual({ type: 'go-to-in' })
    expect(resolveVideoHotkey({ key: 'O', shiftKey: true })).toEqual({ type: 'go-to-out' })
  })

  it('resolves alt playback-rate hotkeys', () => {
    expect(resolveVideoHotkey({ key: '1', altKey: true })).toEqual({ type: 'set-playback-rate', playbackRate: 1 })
    expect(resolveVideoHotkey({ key: '2', altKey: true })).toEqual({ type: 'set-playback-rate', playbackRate: 1.2 })
    expect(resolveVideoHotkey({ key: '3', altKey: true })).toEqual({ type: 'set-playback-rate', playbackRate: 1.5 })
    expect(resolveVideoHotkey({ key: '4', altKey: true })).toEqual({ type: 'set-playback-rate', playbackRate: 2 })
    expect(resolveVideoHotkey({ key: '0', altKey: true })).toEqual({ type: 'set-playback-rate', playbackRate: 0.75 })
  })

  it('ignores textarea targets', () => {
    expect(resolveVideoHotkey({ key: 'ArrowLeft', target: { tagName: 'TEXTAREA' } })).toBeNull()
  })

  it('ignores input targets', () => {
    expect(resolveVideoHotkey({ key: 'ArrowRight', target: { tagName: 'INPUT' } })).toBeNull()
  })

  it('allows arrow key repeat and blocks marker/rate repeat', () => {
    expect(resolveVideoHotkey({ key: 'ArrowRight', repeat: true })).toEqual({ type: 'seek-by', deltaSeconds: 1 })
    expect(resolveVideoHotkey({ key: 'i', repeat: true })).toBeNull()
    expect(resolveVideoHotkey({ key: '2', altKey: true, repeat: true })).toBeNull()
  })

  it('ignores unknown and system shortcut keys', () => {
    expect(resolveVideoHotkey({ key: 'x' })).toBeNull()
    expect(resolveVideoHotkey({ key: 'c', ctrlKey: true })).toBeNull()
    expect(resolveVideoHotkey({ key: 'v', ctrlKey: true })).toBeNull()
    expect(resolveVideoHotkey({ key: 'z', ctrlKey: true })).toBeNull()
    expect(resolveVideoHotkey({ key: 'a', ctrlKey: true })).toBeNull()
  })
})
