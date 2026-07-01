import { access } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

const WHISPER_MODEL_FILE = 'ggml-small-q5_1.bin'

export interface LocalTranscriptionAssets {
  ffmpegPath: string
  ffprobePath: string
  whisperCliPath: string
  whisperModelPath: string
}

interface LocalTranscriptionAssetPathOptions {
  isPackaged: boolean
  developmentRoot: string
  packagedResourcesRoot: string
}

export async function resolveLocalTranscriptionAssets(): Promise<LocalTranscriptionAssets> {
  const assets = createLocalTranscriptionAssetPaths({
    isPackaged: app.isPackaged,
    developmentRoot: process.cwd(),
    packagedResourcesRoot: process.resourcesPath,
  })

  await validateLocalTranscriptionAssets(assets)

  return assets
}

export function createLocalTranscriptionAssetPaths({
  isPackaged,
  developmentRoot,
  packagedResourcesRoot,
}: LocalTranscriptionAssetPathOptions): LocalTranscriptionAssets {
  const resourcesRoot = isPackaged
    ? packagedResourcesRoot
    : path.join(developmentRoot, 'resources')

  return {
    ffmpegPath: path.join(resourcesRoot, 'media-tools', 'win-x64', 'ffmpeg.exe'),
    ffprobePath: path.join(resourcesRoot, 'media-tools', 'win-x64', 'ffprobe.exe'),
    whisperCliPath: path.join(resourcesRoot, 'whisper', 'bin', 'win-x64', 'whisper-cli.exe'),
    whisperModelPath: path.join(resourcesRoot, 'whisper', 'models', WHISPER_MODEL_FILE),
  }
}

async function validateLocalTranscriptionAssets(assets: LocalTranscriptionAssets) {
  await Promise.all([
    assertAssetExists('ffmpeg executable', assets.ffmpegPath),
    assertAssetExists('ffprobe executable', assets.ffprobePath),
    assertAssetExists('whisper.cpp executable', assets.whisperCliPath),
    assertAssetExists('whisper model', assets.whisperModelPath),
  ])
}

async function assertAssetExists(label: string, assetPath: string) {
  try {
    await access(assetPath)
  } catch {
    throw new Error(`Missing local transcription asset: ${label}. Run npm run prepare:local-transcription.`)
  }
}
