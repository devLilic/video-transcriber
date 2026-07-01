export function formatTimecode(valueSeconds: number) {
  const safeSeconds = Number.isFinite(valueSeconds) && valueSeconds > 0 ? valueSeconds : 0
  const totalMilliseconds = Math.floor(safeSeconds * 1000)
  const milliseconds = totalMilliseconds % 1000
  const totalSeconds = Math.floor(totalMilliseconds / 1000)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(milliseconds, 3)}`
}

function pad(value: number, width: number) {
  return String(value).padStart(width, '0')
}
