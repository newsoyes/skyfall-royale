/**
 * Client-side movement prediction
 *
 * แนวคิด:
 * - ทุก input ที่ส่งไป server จะถูก simulate ที่ client ทันที (predict)
 * - เมื่อ snapshot มาจาก server ให้ reconcile โดย lerp ไปหาตำแหน่งจริง
 * - ถ้า error มากเกิน threshold ให้ snap ทันที
 */

import { terrainHeight } from './terrain'

const GRAVITY = 28
const JUMP_V = 10.2
const WALK_SPD = 6.8
const SPRINT_SPD = 11.2
const SNAP_THRESHOLD = 4.0      // หน่วย: ถ้า error > นี้ snap ทันที
const RECONCILE_ALPHA = 0.22    // lerp speed ต่อ frame (ยิ่งสูงยิ่งเร็ว)

export interface PredictedState {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  yaw: number
  pitch: number
  onGround: boolean
}

/** Simulate one physics step เหมือน server (ไม่มี prop collision เพื่อความเร็ว) */
export function stepPrediction(
  state: PredictedState,
  input: { fwd: number; str: number; jump: boolean; sprint: boolean; yaw: number; pitch: number },
  dt: number,
): PredictedState {
  const { fwd, str, sprint, jump, yaw, pitch } = input
  let { x, y, z, vx, vy, vz } = state

  const th = terrainHeight(x, z)
  const ground = th + 0.02
  const onGround = y <= ground + 0.12 && vy <= 0.2

  const sp = sprint ? SPRINT_SPD : WALK_SPD
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const fx = sy * fwd - cy * str
  const fz = cy * fwd + sy * str
  const len = Math.hypot(fx, fz) || 1

  if (fwd !== 0 || str !== 0) {
    vx = (fx / len) * sp
    vz = (fz / len) * sp
  } else {
    vx *= 0.85
    vz *= 0.85
  }

  if (onGround && jump && vy <= 0.2) {
    vy = JUMP_V
  }

  if (!onGround || y > ground + 0.2) {
    vy -= GRAVITY * dt
  } else if (vy < 0) {
    vy = 0
  }

  let nx = x + vx * dt
  let nz = z + vz * dt
  let ny = y + vy * dt

  const g2 = terrainHeight(nx, nz) + 0.02
  if (ny < g2) {
    ny = g2
    vy = 0
  }

  return {
    x: nx, y: ny, z: nz,
    vx, vy, vz,
    yaw, pitch,
    onGround: ny <= terrainHeight(nx, nz) + 0.14,
  }
}

/**
 * Reconcile predicted position กับ server authoritative position
 * คืนค่า position ที่ควรแสดงผล
 */
export function reconcile(
  predicted: PredictedState,
  serverX: number,
  serverY: number,
  serverZ: number,
): PredictedState {
  const err = Math.hypot(predicted.x - serverX, predicted.y - serverY, predicted.z - serverZ)

  // Error ใหญ่มาก → snap ทันที
  if (err > SNAP_THRESHOLD) {
    return { ...predicted, x: serverX, y: serverY, z: serverZ }
  }

  // Error เล็ก → lerp เข้าหา server
  return {
    ...predicted,
    x: predicted.x + (serverX - predicted.x) * RECONCILE_ALPHA,
    y: predicted.y + (serverY - predicted.y) * RECONCILE_ALPHA,
    z: predicted.z + (serverZ - predicted.z) * RECONCILE_ALPHA,
  }
}
