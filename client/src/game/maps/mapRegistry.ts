/**
 * Client-side map registry — mirrors server/src/maps/mapRegistry.ts
 * Must stay in sync with server definitions.
 */

export type MapId = 'island' | 'desert' | 'snow' | 'city'

export interface MapDef {
  id: MapId
  nameTH: string
  descTH: string
  mapHalf: number
  skyColor: string
  fogColor: string
  waterColor: string
  groundColorLow: string
  groundColorHigh: string
  terrainHeight: (x: number, z: number) => number
  seeds: {
    trees: number
    rocks: number
    ruins: number
    treeCount: number
    rockCount: number
    ruinCount: number
  }
  /** Visual style overrides */
  style: {
    trunkColor: string
    leafColor: string
    rockColor: string
    ruinColor: string
    ambientIntensity: number
    sunPosition: [number, number, number]
  }
}

function islandHeight(x: number, z: number): number {
  const MAP_HALF = 190
  const d = Math.sqrt(x * x + z * z)
  if (d > MAP_HALF) return -40 - (d - MAP_HALF) * 0.8
  const base = 2
  const hills =
    Math.sin(x * 0.018) * 4 + Math.cos(z * 0.021) * 4 +
    Math.sin((x + z) * 0.012) * 3 + Math.cos(x * 0.04) * 1.2
  const river = Math.exp(-((x - 25) ** 2 + (z + 40) ** 2) / 900) * -3
  return base + hills + river
}

function desertHeight(x: number, z: number): number {
  const MAP_HALF = 200
  const d = Math.sqrt(x * x + z * z)
  if (d > MAP_HALF) return -30 - (d - MAP_HALF) * 0.6
  const dunes =
    Math.sin(x * 0.025) * 6 + Math.cos(z * 0.022) * 5 +
    Math.sin((x - z) * 0.015) * 3 + Math.sin(x * 0.055) * 1.5
  const oasis = Math.exp(-(x * x + z * z) / 1800) * -4
  return 1 + dunes + oasis
}

function snowHeight(x: number, z: number): number {
  const MAP_HALF = 185
  const d = Math.sqrt(x * x + z * z)
  if (d > MAP_HALF) return -50 - (d - MAP_HALF) * 1.2
  const mountains =
    Math.sin(x * 0.022) * 8 + Math.cos(z * 0.019) * 7 +
    Math.sin((x + z) * 0.014) * 5 + Math.cos(x * 0.045) * 3 +
    Math.sin(z * 0.06) * 2
  const peak = Math.exp(-(x * x + z * z) / 2500) * 12
  return 3 + mountains + peak
}

function cityHeight(x: number, z: number): number {
  const MAP_HALF = 195
  const d = Math.sqrt(x * x + z * z)
  if (d > MAP_HALF) return -20 - (d - MAP_HALF) * 0.5
  return 0.5 + Math.sin(x * 0.012) * 1.2 + Math.cos(z * 0.012) * 1.2
}

export const MAPS: Record<MapId, MapDef> = {
  island: {
    id: 'island',
    nameTH: '🏝️ เกาะเขตร้อน',
    descTH: 'เกาะกลางทะเล มีป่าไม้และซากปรักหักพัง',
    mapHalf: 190,
    skyColor: '#87bfff',
    fogColor: '#87bfff',
    waterColor: '#2b6fb3',
    groundColorLow: '#4a7c59',
    groundColorHigh: '#6b9e6b',
    terrainHeight: islandHeight,
    seeds: { trees: 42, rocks: 7, ruins: 99, treeCount: 220, rockCount: 90, ruinCount: 70 },
    style: {
      trunkColor: '#6b4f3a', leafColor: '#2f8f5b',
      rockColor: '#7c8496', ruinColor: '#c9b6a4',
      ambientIntensity: 0.55, sunPosition: [120, 80, 40],
    },
  },
  desert: {
    id: 'desert',
    nameTH: '🏜️ ทะเลทราย',
    descTH: 'ทะเลทรายกว้างใหญ่ มีเนินทรายและโอเอซิส',
    mapHalf: 200,
    skyColor: '#e8c97a',
    fogColor: '#d4a853',
    waterColor: '#1a6b3a',
    groundColorLow: '#c8a84b',
    groundColorHigh: '#e2c97a',
    terrainHeight: desertHeight,
    seeds: { trees: 13, rocks: 55, ruins: 77, treeCount: 40, rockCount: 160, ruinCount: 90 },
    style: {
      trunkColor: '#8b6914', leafColor: '#5a8a2a',
      rockColor: '#b8a060', ruinColor: '#d4b87a',
      ambientIntensity: 0.75, sunPosition: [80, 40, 20],
    },
  },
  snow: {
    id: 'snow',
    nameTH: '❄️ ภูเขาหิมะ',
    descTH: 'ภูเขาสูงปกคลุมด้วยหิมะ ภูมิประเทศขรุขระ',
    mapHalf: 185,
    skyColor: '#c8dff5',
    fogColor: '#ddeeff',
    waterColor: '#4a8fc4',
    groundColorLow: '#8ab4d4',
    groundColorHigh: '#e8f0f8',
    terrainHeight: snowHeight,
    seeds: { trees: 88, rocks: 33, ruins: 11, treeCount: 120, rockCount: 200, ruinCount: 50 },
    style: {
      trunkColor: '#5a4030', leafColor: '#1a5a2a',
      rockColor: '#9ab0c8', ruinColor: '#c8d8e8',
      ambientIntensity: 0.65, sunPosition: [60, 30, 80],
    },
  },
  city: {
    id: 'city',
    nameTH: '🏙️ เมืองร้าง',
    descTH: 'เมืองร้างที่เต็มไปด้วยตึกและซากอาคาร',
    mapHalf: 195,
    skyColor: '#6b7a8d',
    fogColor: '#4a5568',
    waterColor: '#1a2535',
    groundColorLow: '#4a4a5a',
    groundColorHigh: '#6a6a7a',
    terrainHeight: cityHeight,
    seeds: { trees: 5, rocks: 22, ruins: 66, treeCount: 30, rockCount: 60, ruinCount: 150 },
    style: {
      trunkColor: '#3a3a3a', leafColor: '#2a4a2a',
      rockColor: '#5a5a6a', ruinColor: '#7a7a8a',
      ambientIntensity: 0.4, sunPosition: [40, 60, 30],
    },
  },
}

export function getMap(id: string): MapDef {
  return MAPS[id as MapId] ?? MAPS.island
}
