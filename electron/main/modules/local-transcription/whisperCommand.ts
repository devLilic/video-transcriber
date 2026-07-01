export interface WhisperCommandInput {
  modelPath: string
  audioPath: string
  outputBasePath: string
  language: 'ro'
  threads: number
}

export function buildWhisperArgs(input: WhisperCommandInput): string[] {
  return [
    '--model',
    input.modelPath,
    '--file',
    input.audioPath,
    '--language',
    input.language,
    '--output-json-full',
    '--output-file',
    input.outputBasePath,
    '--print-progress',
    '--no-gpu',
    '--suppress-nst',
    '--threads',
    String(input.threads),
    '--temperature',
    '0',
    '--beam-size',
    '5',
  ]
}

export function parseWhisperProgressLine(line: string): number | null {
  const match = /progress\s*=\s*(-?\d+(?:\.\d+)?)%/.exec(line)

  if (!match) {
    return null
  }

  const progress = Number(match[1])

  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    return null
  }

  return progress
}

export function resolveWhisperThreadCount(cpuCount: number): number {
  if (!Number.isFinite(cpuCount) || cpuCount <= 1) {
    return 1
  }

  const availableThreads = cpuCount > 2 ? Math.floor(cpuCount) - 1 : Math.floor(cpuCount)
  return Math.min(Math.max(availableThreads, 1), 8)
}
