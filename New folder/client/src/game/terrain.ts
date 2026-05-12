/**
 * Active map terrain — delegates to the current map's terrainHeight function.
 * Call setActiveMap() when the match starts to switch maps.
 */
import { getMap, type MapId } from './maps/mapRegistry'

let _activeMap = getMap('island')

export function setActiveMap(id: string) {
  _activeMap = getMap(id as MapId)
}

export function getActiveMap() {
  return _activeMap
}

export function terrainHeight(x: number, z: number): number {
  return _activeMap.terrainHeight(x, z)
}

/** Use getActiveMap().mapHalf for the current map's actual boundary */
export function getMapHalf(): number {
  return _activeMap.mapHalf
}

// Legacy export — kept for compatibility, always use getMapHalf() for dynamic maps
export const MAP_HALF = 190
