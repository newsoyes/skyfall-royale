/**
 * Map registry — defines all playable maps.
 * Each map has its own terrain function, prop seeds, sky/fog colors, and display name.
 */

export type MapId = 'island' | 'desert' | 'snow' | 'city' | 'volcano' | 'jungle' | 'arctic' | 'mars'

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
  const base = 0.5
  const roads =
    Math.sin(x * 0.012) * 1.2 +
    Math.cos(z * 0.012) * 1.2
  return base + roads
}

function volcanoHeight(x: number, z: number): number {
  const MAP_HALF = 180
  const d = Math.sqrt(x * x + z * z)
  if (d > MAP_HALF) return -35 - (d - MAP_HALF) * 0.9
  const cone = Math.max(0, 18 - d * 0.09)
  const crater = d < 20 ? -Math.exp(-d * 0.15) * 8 : 0
  const lava = Math.sin(x * 0.03) * 2.5 + Math.cos(z * 0.028) * 2 + Math.sin((x - z) * 0.02) * 1.5
  return 1 + cone + crater + lava
}

function jungleHeight(x: number, z: number): number {
  const MAP_HALF = 205
  const d = Math.sqrt(x * x + z * z)
  if (d > MAP_HALF) return -25 - (d - MAP_HALF) * 0.7
  const base = 1.5
  const undulation = Math.sin(x * 0.016) * 2.5 + Math.cos(z * 0.018) * 2 + Math.sin((x + z) * 0.01) * 1.5
  const river1 = Math.exp(-((x - 30) ** 2) / 400) * -3.5
  const river2 = Math.exp(-((z + 50) ** 2) / 600) * -2.5
  const swamp = Math.exp(-((x + 60) ** 2 + (z - 40) ** 2) / 2000) * -4
  return base + undulation + river1 + river2 + swamp
}

function arcticHeight(x: number, z: number): number {
  const MAP_HALF = 210
  const d = Math.sqrt(x * x + z * z)
  if (d > MAP_HALF) return -60 - (d - MAP_HALF) * 1.5
  const base = 0.2
  const ridges = Math.abs(Math.sin(x * 0.04)) * 3 + Math.abs(Math.cos(z * 0.038)) * 2.5
  const crack1 = Math.exp(-((x * 0.8 - z * 0.6) ** 2) / 50) * 4
  const crack2 = Math.exp(-((x * 0.5 + z * 0.85) ** 2) / 80) * 3
  const lake = Math.exp(-(x * x + z * z) / 3000) * -2
  return base + ridges + crack1 + crack2 + lake
}

function marsHeight(x: number, z: number): number {
  const MAP_HALF = 200
  const d = Math.sqrt(x * x + z * z)
  if (d > MAP_HALF) return -15 - (d - MAP_HALF) * 0.4
  const plains = Math.sin(x * 0.014) * 3 + Math.cos(z * 0.016) * 2.5
  const crater1 = Math.exp(-((x - 50) ** 2 + (z - 30) ** 2) / 800) * -6
  const crater2 = Math.exp(-((x + 40) ** 2 + (z + 60) ** 2) / 1200) * -5
  const crater3 = Math.exp(-((x - 20) ** 2 + (z + 20) ** 2) / 400) * -4
  const canyon = Math.exp(-((x * 0.7 + z * 0.3 - 10) ** 2) / 200) * -7
  const mons = Math.exp(-((x + 70) ** 2 + (z - 70) ** 2) / 5000) * 10
  return 2 + plains + crater1 + crater2 + crater3 + canyon + mons
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
  volcano: {
    id: 'volcano',
    nameTH: '🌋 ภูเขาไฟ',
    descTH: 'ปล่องภูเขาไฟที่ยังคุกรุ่น ลาวาไหลรอบข้าง',
    mapHalf: 180,
    skyColor: '#3d1a0a',
    fogColor: '#6b2a10',
    waterColor: '#cc3300',
    terrainHeight: volcanoHeight,
    clampToMap: makeClamp(180),
    seeds: { trees: 5, rocks: 88, ruins: 44, treeCount: 20, rockCount: 250, ruinCount: 60 },
  },
  jungle: {
    id: 'jungle',
    nameTH: '🌿 ป่าดงดิบ',
    descTH: 'ป่าทึบชื้น มีแม่น้ำและหนองน้ำ ทัศนวิสัยต่ำ',
    mapHalf: 205,
    skyColor: '#1a3a1a',
    fogColor: '#2a4a2a',
    waterColor: '#1a4a2a',
    terrainHeight: jungleHeight,
    clampToMap: makeClamp(205),
    seeds: { trees: 11, rocks: 33, ruins: 55, treeCount: 380, rockCount: 80, ruinCount: 100 },
  },
  arctic: {
    id: 'arctic',
    nameTH: '🧊 ทุ่งน้ำแข็ง',
    descTH: 'ทุ่งน้ำแข็งกว้างใหญ่ มีรอยแตกและสันน้ำแข็งสูง',
    mapHalf: 210,
    skyColor: '#a0c8e8',
    fogColor: '#c8e0f0',
    waterColor: '#2a6a9a',
    terrainHeight: arcticHeight,
    clampToMap: makeClamp(210),
    seeds: { trees: 3, rocks: 66, ruins: 22, treeCount: 15, rockCount: 180, ruinCount: 40 },
  },
  mars: {
    id: 'mars',
    nameTH: '🔴 ดาวอังคาร',
    descTH: 'พื้นผิวดาวอังคาร มีหลุมอุกกาบาตและหน้าผาสูง',
    mapHalf: 200,
    skyColor: '#c87040',
    fogColor: '#a05030',
    waterColor: '#6a2a10',
    terrainHeight: marsHeight,
    clampToMap: makeClamp(200),
    seeds: { trees: 0, rocks: 99, ruins: 33, treeCount: 0, rockCount: 300, ruinCount: 80 },
  },
}

export function getMap(id: MapId): MapDef {
  return MAPS[id] ?? MAPS.island
}
