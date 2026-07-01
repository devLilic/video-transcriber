import path from 'node:path'

export class MediaSourceRegistry {
  private readonly sources = new Map<string, string>()

  register(videoId: string, absoluteFilePath: string) {
    if (!path.isAbsolute(absoluteFilePath)) {
      throw new Error('Media source paths must be absolute.')
    }

    this.sources.set(videoId, path.normalize(absoluteFilePath))
  }

  get(videoId: string) {
    return this.sources.get(videoId) ?? null
  }

  has(videoId: string) {
    return this.sources.has(videoId)
  }

  unregister(videoId: string) {
    this.sources.delete(videoId)
  }

  clear() {
    this.sources.clear()
  }

  createMediaUrl(videoId: string) {
    return `media://local/${encodeURIComponent(videoId)}`
  }
}

export const mediaSourceRegistry = new MediaSourceRegistry()
