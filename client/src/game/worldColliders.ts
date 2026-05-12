/**
 * Client-side prop colliders — rebuilt when map changes.
 * Used only for tracer/FX clipping on the client.
 */

import { getActiveMap } from './terrain'

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type TreeCollider = { x: number; z: number; r: number; y0: number; y1: number }
type SphereCollider = { x: number; y: number; z: number; r: number }
type BoxCollider = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }

let TREES: TreeCollider[] = []
let ROCKS: SphereCollider[] = []
let RUINS: BoxCollider[] = []
let _builtForMap = ''

function buildForCurrentMap() {
  const map = getActiveMap()
  if (_builtForMap === map.id) return
  _builtForMap = map.id
  TREES = []
  ROCKS = []
  RUINS = []

  const { terrainHeight, seeds, mapHalf } = map

  const rngT = mulberry32(seeds.trees)
  for (let i = 0; i < seeds.treeCount; i++) {
    const a = rngT() * Math.PI * 2
    const r = 8 + rngT() * (mapHalf - 20)
    const x = Math.cos(a) * r, z = Math.sin(a) * r
    const y = terrainHeight(x, z)
    const scale = 0.75 + rngT() * 0.45
    TREES.push({ x, z, r: 0.42 * scale + 0.12, y0: y, y1: y + 2.4 * scale })
  }

  const rngR = mulberry32(seeds.rocks)
  for (let i = 0; i < seeds.rockCount; i++) {
    const a = rngR() * Math.PI * 2
    const r = 10 + rngR() * (mapHalf - 25)
    const x = Math.cos(a) * r, z = Math.sin(a) * r
    const y = terrainHeight(x, z)
    const sx = 0.6 + rngR(), sz = 0.6 + rngR()
    ROCKS.push({ x, y: y + 0.55, z, r: Math.max(sx, sz) * 0.62 + 0.15 })
  }

  const rngRu = mulberry32(seeds.ruins)
  let idx = 0
  const clusters = Math.ceil(seeds.ruinCount / 5)
  for (let c = 0; c < clusters && idx < seeds.ruinCount; c++) {
    const cx = (rngRu() - 0.5) * mapHalf * 1.4
    const cz = (rngRu() - 0.5) * mapHalf * 1.4
    const n = 3 + Math.floor(rngRu() * 5)
    for (let k = 0; k < n && idx < seeds.ruinCount; k++) {
      const x = cx + (rngRu() - 0.5) * 12
      const z = cz + (rngRu() - 0.5) * 12
      const y = terrainHeight(x, z)
      const sx = 0.8 + rngRu() * 0.4, sy = 0.6 + rngRu() * 0.8, sz = 0.8 + rngRu() * 0.4
      const hx = 0.6 * sx, hz = 0.6 * sz, halfY = 2.25 * sy
      RUINS.push({ x0: x - hx, y0: y + 2.25 - halfY, z0: z - hz, x1: x + hx, y1: y + 2.25 + halfY, z1: z + hz })
      idx++
    }
  }
}

function rayCylinder(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  cx: number, cz: number, rad: number, y0: number, y1: number, maxDist: number, eps = 0.02): number | null {
  const rdxz2 = dx * dx + dz * dz
  if (rdxz2 < 1e-10) return null
  const oxz = ox - cx, ozz = oz - cz
  const b = 2 * (oxz * dx + ozz * dz)
  const c = oxz * oxz + ozz * ozz - rad * rad
  const disc = b * b - 4 * rdxz2 * c
  if (disc < 0) return null
  const s = Math.sqrt(disc)
  let t0 = (-b - s) / (2 * rdxz2), t1 = (-b + s) / (2 * rdxz2)
  if (t0 > t1) [t0, t1] = [t1, t0]
  for (const t of [t0, t1]) {
    if (t < eps || t > maxDist) continue
    const yy = oy + dy * t
    if (yy >= y0 - 0.05 && yy <= y1 + 0.05) return t
  }
  return null
}

function raySphere(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  sx: number, sy: number, sz: number, rad: number, maxDist: number, eps = 0.02): number | null {
  const ocx = ox - sx, ocy = oy - sy, ocz = oz - sz
  const b = 2 * (ocx * dx + ocy * dy + ocz * dz)
  const c = ocx * ocx + ocy * ocy + ocz * ocz - rad * rad
  const a = dx * dx + dy * dy + dz * dz
  const disc = b * b - 4 * a * c
  if (disc < 0) return null
  const s = Math.sqrt(disc)
  let t0 = (-b - s) / (2 * a), t1 = (-b + s) / (2 * a)
  if (t0 > t1) [t0, t1] = [t1, t0]
  for (const t of [t0, t1]) { if (t >= eps && t <= maxDist) return t }
  return null
}

function rayAabb(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, maxDist: number): number | null {
  let tmin = 0, tmax = maxDist
  const axes = ['x', 'y', 'z'] as const
  const minB = { x: x0, y: y0, z: z0 }, maxB = { x: x1, y: y1, z: z1 }
  const o = { x: ox, y: oy, z: oz }, d = { x: dx, y: dy, z: dz }
  for (const ax of axes) {
    if (Math.abs(d[ax]) < 1e-8) { if (o[ax] < minB[ax] || o[ax] > maxB[ax]) return null }
    else {
      const inv = 1 / d[ax]
      let t0 = (minB[ax] - o[ax]) * inv, t1 = (maxB[ax] - o[ax]) * inv
      if (t0 > t1) [t0, t1] = [t1, t0]
      tmin = Math.max(tmin, t0); tmax = Math.min(tmax, t1)
      if (tmax < tmin) return null
    }
  }
  if (tmax < 0) return null
  const hit = tmin >= 0 ? tmin : tmax >= 0 ? tmax : null
  return hit == null || hit > maxDist ? null : hit
}

export function closestPropHit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): number | null {
  buildForCurrentMap()
  let best: number | null = null
  for (const t of TREES) {
    const h = rayCylinder(ox, oy, oz, dx, dy, dz, t.x, t.z, t.r, t.y0, t.y1, maxDist)
    if (h != null && (best == null || h < best)) best = h
  }
  for (const s of ROCKS) {
    const h = raySphere(ox, oy, oz, dx, dy, dz, s.x, s.y, s.z, s.r, maxDist)
    if (h != null && (best == null || h < best)) best = h
  }
  for (const b of RUINS) {
    const h = rayAabb(ox, oy, oz, dx, dy, dz, b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, maxDist)
    if (h != null && (best == null || h < best)) best = h
  }
  return best
}
