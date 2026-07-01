import path from 'node:path'
import ffmpegStaticPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'

export interface MediaToolsPaths {
  ffmpegPath: string
  ffprobePath: string
}

export function resolveMediaTools(): MediaToolsPaths {
  return {
    ffmpegPath: resolvePackagedBinaryPath(ffmpegStaticPath),
    ffprobePath: resolvePackagedBinaryPath(ffprobeStatic.path),
  }
}

function resolvePackagedBinaryPath(binaryPath: string | null): string {
  if (!binaryPath) {
    throw new Error('Media tool binary path could not be resolved.')
  }

  return path.normalize(binaryPath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`))
}
