import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'

const MODEL_ID = 'small-q5_1'
const MODEL_FILE = 'ggml-small-q5_1.bin'
const EXPECTED_SHA1 = '6fe57ddcfdd1c6b07cdcc73aaf620810ce5fc771'
const DOWNLOAD_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin'

const requestTimeoutMs = 120000
const force = process.argv.includes('--force')
const modelsDir = path.resolve('resources/whisper/models')
const modelPath = path.join(modelsDir, MODEL_FILE)
const modelPartPath = `${modelPath}.part`
const metadataPath = path.join(modelsDir, 'model.json')

try {
  await mkdir(modelsDir, { recursive: true })

  if (!force && await hasExpectedModel()) {
    console.log(`Whisper model ${MODEL_ID} already prepared at ${modelPath}`)
    process.exit(0)
  }

  await unlink(modelPartPath).catch((error) => {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  })

  await downloadModel(modelPartPath)
  await verifySha1(modelPartPath)
  await rename(modelPartPath, modelPath)
  await writeModelMetadata()

  console.log(`Whisper model ${MODEL_ID} prepared at ${modelPath}`)
} catch (error) {
  await rm(modelPartPath, { force: true }).catch(() => undefined)
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

async function hasExpectedModel() {
  try {
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
    const modelStats = await stat(modelPath)

    return metadata.id === MODEL_ID
      && metadata.fileName === MODEL_FILE
      && metadata.languageMode === 'multilingual'
      && metadata.defaultLanguage === 'ro'
      && modelStats.isFile()
      && modelStats.size > 0
  } catch {
    return false
  }
}

async function downloadModel(targetPath) {
  console.log(`Downloading ${DOWNLOAD_URL}`)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)

  try {
    const response = await fetch(DOWNLOAD_URL, {
      redirect: 'follow',
      signal: controller.signal,
    })

    if (!response.ok || !response.body) {
      throw new Error(`Failed to download ${MODEL_FILE}: HTTP ${response.status}`)
    }

    const totalBytes = Number(response.headers.get('content-length') ?? 0)
    let downloadedBytes = 0
    let lastProgressPercent = -1

    const progressStream = new TransformStream({
      transform(chunk, streamController) {
        downloadedBytes += chunk.byteLength
        printProgress(downloadedBytes, totalBytes, lastProgressPercent, (nextPercent) => {
          lastProgressPercent = nextPercent
        })
        streamController.enqueue(chunk)
      },
    })

    await pipeline(
      Readable.fromWeb(response.body.pipeThrough(progressStream)),
      createWriteStream(targetPath),
    )

    process.stdout.write('\n')
  } finally {
    clearTimeout(timeout)
  }
}

function printProgress(downloadedBytes, totalBytes, lastProgressPercent, updateLastProgressPercent) {
  if (totalBytes > 0) {
    const percent = Math.floor((downloadedBytes / totalBytes) * 100)

    if (percent !== lastProgressPercent && percent % 5 === 0) {
      process.stdout.write(`\rDownloaded ${percent}%`)
      updateLastProgressPercent(percent)
    }

    return
  }

  const downloadedMb = Math.floor(downloadedBytes / 1024 / 1024)

  if (downloadedMb > 0 && downloadedMb !== lastProgressPercent) {
    process.stdout.write(`\rDownloaded ${downloadedMb} MB`)
    updateLastProgressPercent(downloadedMb)
  }
}

async function verifySha1(filePath) {
  const fileBuffer = await readFile(filePath)
  const actualSha1 = createHash('sha1').update(fileBuffer).digest('hex')

  if (actualSha1 !== EXPECTED_SHA1) {
    throw new Error(`SHA-1 mismatch for ${MODEL_FILE}. Expected ${EXPECTED_SHA1}, got ${actualSha1}.`)
  }
}

async function writeModelMetadata() {
  await writeFile(metadataPath, `${JSON.stringify({
    id: MODEL_ID,
    fileName: MODEL_FILE,
    languageMode: 'multilingual',
    defaultLanguage: 'ro',
  }, null, 2)}\n`, 'utf8')
}
