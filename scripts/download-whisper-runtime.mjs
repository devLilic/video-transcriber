import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import extract from 'extract-zip'

const WHISPER_VERSION = 'v1.9.1'
const ASSET_NAME = 'whisper-bin-x64.zip'
const EXPECTED_SHA256 = '7d8be46ecd31828e1eb7a2ecdd0d6b314feafd82163038ab6092594b0a063539'
const downloadUrl = `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_VERSION}/${ASSET_NAME}`

const force = process.argv.includes('--force')
const runtimeDir = path.resolve('resources/whisper/bin/win-x64')
const runtimeMetadataPath = path.join(runtimeDir, 'runtime.json')
const tempParentDir = path.resolve('resources/whisper')

let tempRoot = null

try {
  if (!force && await hasExpectedRuntime()) {
    console.log(`whisper.cpp runtime ${WHISPER_VERSION} already prepared at ${runtimeDir}`)
    process.exit(0)
  }

  await mkdir(tempParentDir, { recursive: true })
  tempRoot = await mkdtemp(path.join(tempParentDir, '.tmp-whisper-'))
  const archivePath = path.join(tempRoot, ASSET_NAME)
  const archivePartPath = `${archivePath}.part`
  const extractDir = path.join(tempRoot, 'extract')
  const preparedDir = path.join(tempRoot, 'prepared')

  await downloadArchive(archivePartPath)
  await rename(archivePartPath, archivePath)
  await verifySha256(archivePath)
  await mkdir(extractDir, { recursive: true })
  await extract(archivePath, { dir: extractDir })

  const whisperCliPath = await findFile(extractDir, 'whisper-cli.exe')

  if (!whisperCliPath) {
    throw new Error('whisper-cli.exe was not found in the downloaded archive.')
  }

  await cp(path.dirname(whisperCliPath), preparedDir, { recursive: true })
  await writeFile(path.join(preparedDir, 'runtime.json'), `${JSON.stringify({
    engine: 'whisper.cpp',
    version: WHISPER_VERSION,
    architecture: 'x64',
  }, null, 2)}\n`, 'utf8')
  await writeFile(path.join(preparedDir, '.gitkeep'), '\n', 'utf8')

  await mkdir(path.dirname(runtimeDir), { recursive: true })
  await rm(runtimeDir, { recursive: true, force: true })
  await rename(preparedDir, runtimeDir)

  console.log(`whisper.cpp runtime ${WHISPER_VERSION} prepared at ${runtimeDir}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function hasExpectedRuntime() {
  try {
    const metadata = JSON.parse(await readFile(runtimeMetadataPath, 'utf8'))
    const executable = await stat(path.join(runtimeDir, 'whisper-cli.exe'))

    return metadata.engine === 'whisper.cpp'
      && metadata.version === WHISPER_VERSION
      && metadata.architecture === 'x64'
      && executable.isFile()
      && executable.size > 0
  } catch {
    return false
  }
}

async function downloadArchive(targetPartPath) {
  console.log(`Downloading ${downloadUrl}`)

  const response = await fetch(downloadUrl)

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${ASSET_NAME}: HTTP ${response.status}`)
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(targetPartPath))
}

async function verifySha256(filePath) {
  const fileBuffer = await readFile(filePath)
  const actualSha256 = createHash('sha256').update(fileBuffer).digest('hex')

  if (actualSha256 !== EXPECTED_SHA256) {
    throw new Error(`SHA-256 mismatch for ${ASSET_NAME}. Expected ${EXPECTED_SHA256}, got ${actualSha256}.`)
  }
}

async function findFile(rootDir, fileName) {
  const entries = await import('node:fs/promises').then(({ readdir }) => readdir(rootDir, { withFileTypes: true }))

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name)

    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
      return entryPath
    }

    if (entry.isDirectory()) {
      const found = await findFile(entryPath, fileName)

      if (found) {
        return found
      }
    }
  }

  return null
}
