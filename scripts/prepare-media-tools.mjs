import { constants } from 'node:fs'
import { access, copyFile, mkdir, rename, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'

const targetDir = path.resolve('resources/media-tools/win-x64')
const tools = [
  {
    name: 'ffmpeg',
    sourcePath: ffmpegPath,
    targetPath: path.join(targetDir, 'ffmpeg.exe'),
  },
  {
    name: 'ffprobe',
    sourcePath: ffprobeStatic.path,
    targetPath: path.join(targetDir, 'ffprobe.exe'),
  },
]

try {
  await mkdir(targetDir, { recursive: true })

  for (const tool of tools) {
    await copyTool(tool)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

async function copyTool({ name, sourcePath, targetPath }) {
  await assertReadableExecutable(name, sourcePath)

  const targetStats = await stat(targetPath).catch((error) => {
    if (error?.code === 'ENOENT') {
      return null
    }

    throw error
  })

  if (targetStats?.size > 0) {
    console.log(`${name}: replacing existing executable at ${targetPath}`)
  }

  const partPath = `${targetPath}.part`
  await unlink(partPath).catch((error) => {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  })
  await copyFile(sourcePath, partPath)
  await rename(partPath, targetPath)

  const copiedStats = await stat(targetPath)

  if (copiedStats.size <= 0) {
    throw new Error(`${name}: copied executable is empty at ${targetPath}`)
  }

  console.log(`${name}: prepared ${targetPath}`)
}

async function assertReadableExecutable(name, executablePath) {
  if (!executablePath) {
    throw new Error(`${name}: executable path is empty`)
  }

  try {
    await access(executablePath, constants.R_OK)
  } catch {
    throw new Error(`${name}: source executable does not exist or is not readable at ${executablePath}`)
  }

  const sourceStats = await stat(executablePath)

  if (!sourceStats.isFile() || sourceStats.size <= 0) {
    throw new Error(`${name}: source executable is invalid at ${executablePath}`)
  }
}
