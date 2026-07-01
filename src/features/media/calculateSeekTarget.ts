export function calculateSeekTarget(
  currentTime: number,
  deltaSeconds: number,
  minimum: number,
  maximum: number,
) {
  if (
    !Number.isFinite(currentTime)
    || !Number.isFinite(deltaSeconds)
    || !Number.isFinite(minimum)
    || !Number.isFinite(maximum)
    || maximum < minimum
  ) {
    return Number.isFinite(minimum) ? minimum : 0
  }

  return Math.min(Math.max(currentTime + deltaSeconds, minimum), maximum)
}
