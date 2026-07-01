import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createLocalTranscriptionAssetPaths } from '../../../electron/main/modules/local-transcription/resolveLocalTranscriptionAssets'

describe('createLocalTranscriptionAssetPaths', () => {
  it('builds development paths from the project resources directory', () => {
    const assets = createLocalTranscriptionAssetPaths({
      isPackaged: false,
      developmentRoot: path.join('D:', 'Apps', 'video-transcriber'),
      packagedResourcesRoot: path.join('C:', 'unused'),
    })

    expect(assets).toEqual({
      ffmpegPath: path.join('D:', 'Apps', 'video-transcriber', 'resources', 'media-tools', 'win-x64', 'ffmpeg.exe'),
      ffprobePath: path.join('D:', 'Apps', 'video-transcriber', 'resources', 'media-tools', 'win-x64', 'ffprobe.exe'),
      whisperCliPath: path.join('D:', 'Apps', 'video-transcriber', 'resources', 'whisper', 'bin', 'win-x64', 'whisper-cli.exe'),
      whisperModelPath: path.join('D:', 'Apps', 'video-transcriber', 'resources', 'whisper', 'models', 'ggml-small-q5_1.bin'),
    })
  })

  it('builds packaged paths from process resources root', () => {
    const assets = createLocalTranscriptionAssetPaths({
      isPackaged: true,
      developmentRoot: path.join('D:', 'unused'),
      packagedResourcesRoot: path.join('C:', 'Program Files', 'Video Transcriber', 'resources'),
    })

    expect(assets).toEqual({
      ffmpegPath: path.join('C:', 'Program Files', 'Video Transcriber', 'resources', 'media-tools', 'win-x64', 'ffmpeg.exe'),
      ffprobePath: path.join('C:', 'Program Files', 'Video Transcriber', 'resources', 'media-tools', 'win-x64', 'ffprobe.exe'),
      whisperCliPath: path.join('C:', 'Program Files', 'Video Transcriber', 'resources', 'whisper', 'bin', 'win-x64', 'whisper-cli.exe'),
      whisperModelPath: path.join('C:', 'Program Files', 'Video Transcriber', 'resources', 'whisper', 'models', 'ggml-small-q5_1.bin'),
    })
  })
})
