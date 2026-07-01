export const PLAYBACK_RATES = [0.75, 1, 1.2, 1.5, 2] as const

export type PlaybackRate = (typeof PLAYBACK_RATES)[number]

export function normalizePlaybackRate(value: unknown): PlaybackRate {
  return PLAYBACK_RATES.find((rate) => rate === value) ?? 1
}
