import { stat } from 'node:fs/promises'
import path from 'node:path'

const requiredAssets = [
  'resources/media-tools/win-x64/ffmpeg.exe',
  'resources/media-tools/win-x64/ffprobe.exe',
  'resources/whisper/bin/win-x64/whisper-cli.exe',
  'resources/whisper/bin/win-x64/runtime.json',
  'resources/whisper/models/ggml-small-q5_1.bin',
  'resources/whisper/models/model.json',
]

try {
  for (const assetPath of requiredAssets) {
    await assertNonEmptyFile(assetPath)
  }

  console.log('Local transcription assets are ready.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

async function assertNonEmptyFile(assetPath) {
  const absolutePath = path.resolve(assetPath)
  const assetStat = await stat(absolutePath).catch((error) => {
    if (error?.code === 'ENOENT') {
      throw new Error(`Missing required asset: ${assetPath}`)
    }

    throw error
  })

  if (!assetStat.isFile() || assetStat.size <= 0) {
    throw new Error(`Required asset is empty or not a file: ${assetPath}`)
  }

  console.log(`${assetPath} (${assetStat.size} bytes)`)
}
