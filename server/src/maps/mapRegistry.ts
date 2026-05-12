/**
 * Map registry — defines all playable maps.
 * Each map has its own terrain function, prop seeds, sky/fog colors, and display name.
 */

export type MapId = 'island' | 'desert' | 'snow' | 'city'

export interface MapDef {
  id: MapId
  nameTH: string          // Thai display name
  descTH: string
  mapHalf: number
  skyColor: string
  fogColor: string
  waterColor: string
  terrainHeight: (x: number, z: number) => number
  clampToMap: (x: number, z: number) => { x: number; z: number }
  /** Prop generation seeds */
  seeds: {
    trees: number
    rocks: number
    ruins: number
    treeCount: number
    rockCount: number
    ruinCount: number
  }
}

// ─── Terrain functions ────────────────────────────────────────────────────────

function islandHeight(x: number, z: number): number {
  const MAP_HALF = 190
  const d = Math.sqrt(x * x + z * z)
  if (d > MAP_HALF) return -40 - (d - MAP_HALF) * 0.8
  const base = 2
  const hills =
    Math.sin(x * 0.018) * 4 +
    Math.cos(z * 0.021) * 4 +
    Math.sin((x + z) * 0.012) * 3 +
    Math.cos(x * 0.04) * 1.2
  const river = Math.exp(-((x - 25) ** 2 + (z + 40) ** 2) / 900) * -3
  return base + hills + river
}

function desertHeight(x: number, z: number): number {
  const MAP_HALF = 200
  const d = Math.sqrt(x * x + z * z)
  if (d > MAP_HALF) return -30 - (d - MAP_HALF) * 0.6
  // Flat with dunes — low frequency, high amplitude waves
  const dunes =
    Math.sin(x * 0.025) * 6 +
    Math.cos(z * 0.022) * 5 +
    Math.sin((x - z) * 0.015) * 3 +
    Math.sin(x * 0.055) * 1.5
  // Central depression (oasis)
  const oasis = Math.exp(-(x * x + z * z) / 1800) * -4
  return 1 + dunes + oasis
}

function snowHeight(x: number, z: number): number {
  const MAP_HALF = 185
  const d = Math.sqrt(x * x + z * z)
  if (d > MAP_HALF) return -50 - (d - MAP_HALF) * 1.2
  // Jagged mountain terrain — higher amplitude, sharper peaks
  const mountains =
    Math.sin(x * 0.022) * 8 +
    Math.cos(z * 0.019) * 7 +
    Math.sin((x + z) * 0.014) * 5 +
    Math.cos(x * 0.045) * 3 +
    Math.sin(z * 0.06) * 2
  // Central peak
  const peak = Math.exp(-(x * x + z * z) / 2500) * 12
  return 3 + mountains + peak
}

function cityHeight(x: number, z: number): number {
  const MAP_HALF = 195
  const d = Math.sqrt(x * x + z * z)
  if (d > MAP_HALF) return -20 - (d - MAP_HALF) * 0.5
  // Mostly flat city grid with slight undulation
  const base = 0.5
  const roads =
    Math.sin(x * 0.012) * 1.2 +
    Math.cos(z * 0.012) * 1.2
  return base + roads
}

// ─── clampToMap helpers ───────────────────────────────────────────────────────

function makeClamp(half: number) {
  return (x: number, z: number) => {
    const d = Math.sqrt(x * x + z * z)
    const max = half - 2
    if (d <= max) return { x, z }
    const s = max / d
    return { x: x * s, z: z * s }
  }
}

// ─── Map definitions ──────────────────────────────────────────────────────────

export const MAPS: Record<MapId, MapDef> = {
  island: {
    id: 'island',
    nameTH: '🏝️ เกาะเขตร้อน',
    descTH: 'เกาะกลางทะเล มีป่าไม้และซากปรักหักพัง',
    mapHalf: 190,
    skyColor: '#87bfff',
    fogColor: '#87bfff',
    waterColor: '#2b6fb3',
    terrainHeight: islandHeight,
    clampToMap: makeClamp(190),
    seeds: { trees: 42, rocks: 7, ruins: 99, treeCount: 220, rockCount: 90, ruinCount: 70 },
  },
  desert: {
    id: 'desert',
    nameTH: '🏜️ ทะเลทราย',
    descTH: 'ทะเลทรายกว้างใหญ่ มีเนินทรายและโอเอซิส',
    mapHalf: 200,
    skyColor: '#e8c97a',
    fogColor: '#d4a853',
    waterColor: '#1a6b3a',
    terrainHeight: desertHeight,
    clampToMap: makeClamp(200),
    seeds: { trees: 13, rocks: 55, ruins: 77, treeCount: 40, rockCount: 160, ruinCount: 90 },
  },
  snow: {
    id: 'snow',
    nameTH: '❄️ ภูเขาหิมะ',
    descTH: 'ภูเขาสูงปกคลุมด้วยหิมะ ภูมิประเทศขรุขระ',
    mapHalf: 185,
    skyColor: '#c8dff5',
    fogColor: '#ddeeff',
    waterColor: '#4a8fc4',
    terrainHeight: snowHeight,
    clampToMap: makeClamp(185),
    seeds: { trees: 88, rocks: 33, ruins: 11, treeCount: 120, rockCount: 200, ruinCount: 50 },
  },
  city: {
    id: 'city',
    nameTH: '🏙️ เมืองร้าง',
    descTH: 'เมืองร้างที่เต็มไปด้วยตึกและซากอาคาร',
    mapHalf: 195,
    skyColor: '#6b7a8d',
    fogColor: '#4a5568',
    waterColor: '#1a2535',
    terrainHeight: cityHeight,
    clampToMap: makeClamp(195),
    seeds: { trees: 5, rocks: 22, ruins: 66, treeCount: 30, rockCount: 60, ruinCount: 150 },
  },
}

export function getMap(id: MapId): MapDef {
  return MAPS[id] ?? MAPS.island
}
