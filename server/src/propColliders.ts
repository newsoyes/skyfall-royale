/**
 * Dynamic world colliders — built per-map using the map's terrain function and seeds.
 * Used for: player push-out, hitscan blocking, rocket impacts.
 */

import type { MapDef } from './maps/mapRegistry.js'

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type TreeCollider = { x: number; z: number; r: number; y0: number; y1: number }
export type SphereCollider = { x: number; y: number; z: number; r: number }
export type BoxCollider = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }

export interface PropColliders {
  trees: TreeCollider[]
  rocks: SphereCollider[]
  ruins: BoxCollider[]
}

export function buildColliders(map: MapDef): PropColliders {
  const { terrainHeight, seeds, mapHalf } = map
  const trees: TreeCollider[] = []
  const rocks: SphereCollider[] = []
  const ruins: BoxCollider[] = []

  const rngT = mulberry32(seeds.trees)
  for (let i = 0; i < seeds.treeCount; i++) {
    const a = rngT() * Math.PI * 2
    const r = 8 + rngT() * (mapHalf - 20)
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const y = terrainHeight(x, z)
    const scale = 0.75 + rngT() * 0.45
    const trunkR = 0.42 * scale + 0.12
    trees.push({ x, z, r: trunkR, y0: y, y1: y + 2.4 * scale })
  }

  const rngR = mulberry32(seeds.rocks)
  for (let i = 0; i < seeds.rockCount; i++) {
    const a = rngR() * Math.PI * 2
    const r = 10 + rngR() * (mapHalf - 25)
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const y = terrainHeight(x, z)
    const sx = 0.6 + rngR()
    const sz = 0.6 + rngR()
    rocks.push({ x, y: y + 0.55, z, r: Math.max(sx, sz) * 0.62 + 0.15 })
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
      const sx = 0.8 + rngRu() * 0.4
      const sy = 0.6 + rngRu() * 0.8
      const sz = 0.8 + rngRu() * 0.4
      const hx = 0.6 * sx
      const hz = 0.6 * sz
      const halfY = 2.25 * sy
      ruins.push({
        x0: x - hx, y0: y + 2.25 - halfY, z0: z - hz,
        x1: x + hx, y1: y + 2.25 + halfY, z1: z + hz,
      })
      idx++
    }
  }

  return { trees, rocks, ruins }
}

// ─── Ray tests ────────────────────────────────────────────────────────────────

export function rayCylinder(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  cx: number, cz: number, rad: number,
  y0: number, y1: number, maxDist: number, eps = 0.02,
): number | null {
  const rdxz2 = dx * dx + dz * dz
  if (rdxz2 < 1e-10) return null
  const oxz = ox - cx, ozz = oz - cz
  const b = 2 * (oxz * dx + ozz * dz)
  const c = oxz * oxz + ozz * ozz - rad * rad
  const disc = b * b - 4 * rdxz2 * c
  if (disc < 0) return null
  const s = Math.sqrt(disc)
  let t0 = (-b - s) / (2 * rdxz2)
  let t1 = (-b + s) / (2 * rdxz2)
  if (t0 > t1) [t0, t1] = [t1, t0]
  for (const t of [t0, t1]) {
    if (t < eps || t > maxDist) continue
    const yy = oy + dy * t
    if (yy >= y0 - 0.05 && yy <= y1 + 0.05) return t
  }
  return null
}

export function raySphere(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  sx: number, sy: number, sz: number,
  rad: number, maxDist: number, eps = 0.02,
): number | null {
  const ocx = ox - sx, ocy = oy - sy, ocz = oz - sz
  const b = 2 * (ocx * dx + ocy * dy + ocz * dz)
  const c = ocx * ocx + ocy * ocy + ocz * ocz - rad * rad
  const a = dx * dx + dy * dy + dz * dz
  const disc = b * b - 4 * a * c
  if (disc < 0) return null
  const s = Math.sqrt(disc)
  let t0 = (-b - s) / (2 * a)
  let t1 = (-b + s) / (2 * a)
  if (t0 > t1) [t0, t1] = [t1, t0]
  for (const t of [t0, t1]) {
    if (t >= eps && t <= maxDist) return t
  }
  return null
}

export function rayAabb(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
  maxDist: number,
): number | null {
  let tmin = 0, tmax = maxDist
  const axes = ['x', 'y', 'z'] as const
  const minB = { x: x0, y: y0, z: z0 }, maxB = { x: x1, y: y1, z: z1 }
  const o = { x: ox, y: oy, z: oz }, d = { x: dx, y: dy, z: dz }
  for (const ax of axes) {
    if (Math.abs(d[ax]) < 1e-8) {
      if (o[ax] < minB[ax] || o[ax] > maxB[ax]) return null
    } else {
      const inv = 1 / d[ax]
      let t0 = (minB[ax] - o[ax]) * inv
      let t1 = (maxB[ax] - o[ax]) * inv
      if (t0 > t1) [t0, t1] = [t1, t0]
      tmin = Math.max(tmin, t0)
      tmax = Math.min(tmax, t1)
      if (tmax < tmin) return null
    }
  }
  if (tmax < 0) return null
  const hit = tmin >= 0 ? tmin : tmax >= 0 ? tmax : null
  return hit == null || hit > maxDist ? null : hit
}

export function closestPropHit(
  colliders: PropColliders,
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  maxDist: number,
): number | null {
  let best: number | null = null
  for (const t of colliders.trees) {
    const h = rayCylinder(ox, oy, oz, dx, dy, dz, t.x, t.z, t.r, t.y0, t.y1, maxDist)
    if (h != null && (best == null || h < best)) best = h
  }
  for (const s of colliders.rocks) {
    const h = raySphere(ox, oy, oz, dx, dy, dz, s.x, s.y, s.z, s.r, maxDist)
    if (h != null && (best == null || h < best)) best = h
  }
  for (const b of colliders.ruins) {
    const h = rayAabb(ox, oy, oz, dx, dy, dz, b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, maxDist)
    if (h != null && (best == null || h < best)) best = h
  }
  return best
}

/**
 * Push player out of all props with velocity correction.
 *
 * Returns corrected position AND corrected velocity.
 * Velocity component pointing INTO a surface is zeroed (sliding along walls).
 *
 * Runs 4 iterations for stability at corners and high-speed movement.
 */
export function resolvePlayerAgainstProps(
  colliders: PropColliders,
  terrainHeight: (x: number, z: number) => number,
  x: number, y: number, z: number,
  vx = 0, vy = 0, vz = 0,
  playerR = 0.45,
): { x: number; y: number; z: number; vx: number; vy: number; vz: number } {
  let nx = x, nz = z, ny = y
  let nvx = vx, nvy = vy, nvz = vz

  // 4 iterations — handles corners and fast movement
  for (let iter = 0; iter < 4; iter++) {
    // ── Trees (vertical cylinders) ──────────────────────────────────────────
    for (const t of colliders.trees) {
      // Only collide if player height overlaps the trunk
      if (ny + 1.8 < t.y0 || ny > t.y1) continue
      const dx = nx - t.x
      const dz = nz - t.z
      const d = Math.hypot(dx, dz)
      const minD = t.r + playerR
      if (d < minD) {
        if (d > 1e-5) {
          const nx_ = dx / d
          const nz_ = dz / d
          const penetration = minD - d
          nx += nx_ * penetration
          nz += nz_ * penetration
          // Cancel velocity component pointing into the tree
          const dot = nvx * nx_ + nvz * nz_
          if (dot < 0) {
            nvx -= dot * nx_
            nvz -= dot * nz_
          }
        } else {
          // Exactly on center — push in arbitrary direction
          nx += minD
          nvx = Math.abs(nvx)
        }
      }
    }

    // ── Rocks (spheres) ──────────────────────────────────────────────────────
    for (const s of colliders.rocks) {
      const dx = nx - s.x
      const dy = ny + 0.9 - s.y  // player center height
      const dz = nz - s.z
      const d = Math.hypot(dx, dy, dz)
      const minD = s.r + playerR
      if (d < minD && d > 1e-5) {
        const nx_ = dx / d
        const ny_ = dy / d
        const nz_ = dz / d
        const penetration = minD - d
        nx += nx_ * penetration
        nz += nz_ * penetration
        if (ny_ > 0) ny += ny_ * penetration * 0.5
        // Cancel velocity into rock
        const dot = nvx * nx_ + nvy * ny_ + nvz * nz_
        if (dot < 0) {
          nvx -= dot * nx_
          nvy -= dot * ny_
          nvz -= dot * nz_
        }
      }
    }

    // ── Ruins (AABB boxes) ───────────────────────────────────────────────────
    for (const b of colliders.ruins) {
      const ex0 = b.x0 - playerR, ex1 = b.x1 + playerR
      const ez0 = b.z0 - playerR, ez1 = b.z1 + playerR
      const ey0 = b.y0
      const ey1 = b.y1 + 0.3

      const inX = nx > ex0 && nx < ex1
      const inZ = nz > ez0 && nz < ez1
      const inY = ny + 0.9 > ey0 && ny < ey1

      if (!inX || !inZ || !inY) continue

      // Penetration depth on each axis
      const dLeft  = nx - ex0   // distance to left wall
      const dRight = ex1 - nx   // distance to right wall
      const dBack  = nz - ez0
      const dFront = ez1 - nz
      const dUp    = ey1 - ny   // distance to top

      const minPush = Math.min(dLeft, dRight, dBack, dFront, dUp)

      if (minPush === dLeft) {
        nx = ex0
        if (nvx > 0) nvx = 0  // cancel velocity into wall
      } else if (minPush === dRight) {
        nx = ex1
        if (nvx < 0) nvx = 0
      } else if (minPush === dBack) {
        nz = ez0
        if (nvz > 0) nvz = 0
      } else if (minPush === dFront) {
        nz = ez1
        if (nvz < 0) nvz = 0
      } else {
        // Push up (stand on top)
        ny = ey1
        if (nvy < 0) nvy = 0
      }
    }
  }

  const g = terrainHeight(nx, nz) + 0.02
  if (ny < g) {
    ny = g
    if (nvy < 0) nvy = 0
  }

  return { x: nx, y: ny, z: nz, vx: nvx, vy: nvy, vz: nvz }
}
