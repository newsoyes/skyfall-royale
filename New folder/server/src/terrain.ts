/** Stylized island height — cheap analytic terrain for authoritative ground tests. */

const MAP_HALF = 190

export function terrainHeight(x: number, z: number): number {
  // Island falloff — ocean ring
  const d = Math.sqrt(x * x + z * z)
  if (d > MAP_HALF) {
    return -40 - (d - MAP_HALF) * 0.8
  }
  const base = 2
  const hills =
    Math.sin(x * 0.018) * 4 +
    Math.cos(z * 0.021) * 4 +
    Math.sin((x + z) * 0.012) * 3 +
    Math.cos(x * 0.04) * 1.2
  const river = Math.exp(-((x - 25) ** 2 + (z + 40) ** 2) / 900) * -3
  return base + hills + river
}

export function clampToMap(x: number, z: number): { x: number; z: number } {
  const d = Math.sqrt(x * x + z * z)
  const max = MAP_HALF - 2
  if (d <= max) return { x, z }
  const s = max / d
  return { x: x * s, z: z * s }
}

export { MAP_HALF }
