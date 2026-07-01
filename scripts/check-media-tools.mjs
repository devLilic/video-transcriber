import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'

const timeoutMs = 10000

const tools = [
  ['ffmpeg', ffmpegPath],
  ['ffprobe', ffprobeStatic.path],
]

try {
  for (const [name, executablePath] of tools) {
    await checkTool(name, executablePath)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

async function checkTool(name, executablePath) {
  if (!executablePath || !existsSync(executablePath)) {
    throw new Error(`${name} executable was not found at ${executablePath ?? '<empty>'}.`)
  }

  await runVersionCommand(name, executablePath)
}

function runVersionCommand(name, executablePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, ['-version'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error(`${name} -version timed out after ${timeoutMs}ms.`))
    }, timeoutMs)

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timeout)

      if (code !== 0) {
        reject(new Error(`${name} -version failed with exit code ${code}: ${stderr}`))
        return
      }

      const firstLine = stdout.split(/\r?\n/).find(Boolean)
      console.log(`${name}: ${firstLine}`)
      resolve()
    })
  })
}
