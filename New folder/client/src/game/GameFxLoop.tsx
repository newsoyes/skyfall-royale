/**
 * GameFxLoop — runs every frame inside R3F canvas.
 * prediction state เก็บใน module-level ref ไม่ผ่าน Zustand → ไม่ trigger re-render
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGame } from '../store/game'
import { useSession } from '../store/session'
import { tryFootstep, sounds } from '../audio/procedural'
import { stepPrediction, reconcile, type PredictedState } from './prediction'
import type { HitMaterial } from '../types/protocol'

// Module-level ref — ThirdPersonCamera และ WorldPlayers อ่านโดยตรง ไม่ผ่าน Zustand
export const predictedRef: { current: PredictedState | null } = { current: null }

// Reload tracking — เก็บใน module-level เพื่อให้ GameBindings เขียนได้
export const reloadState: { startAt: number | null; duration: number } = {
  startAt: null,
  duration: 0,
}

export function GameFxLoop() {
  const footAt = useRef(0)
  const playerId = useSession((s) => s.playerId)
  const prevKills = useRef(0)
  // Track which hitFx ids we've already played to avoid replaying
  const playedHitFx = useRef(new Set<string>())

  useFrame((_, dt) => {
    const now = performance.now()

    // ── Expire tracers (only setState when something actually expired) ─────────
    const { tracers } = useGame.getState()
    const liveTracers = tracers.filter((t) => t.until > now)
    if (liveTracers.length !== tracers.length) {
      useGame.setState({ tracers: liveTracers })
    }

    const snap = useGame.getState().snapshot
    if (!snap || !playerId) return
    const me = snap.players.find((p) => p.id === playerId)
    if (!me) return

    // ── Footsteps ─────────────────────────────────────────────────────────────
    if (me.alive) {
      const spd = Math.hypot(me.vx, me.vz)
      const grounded = me.vy > -2 && me.vy < 3
      footAt.current = tryFootstep(footAt.current, spd, grounded)
    }

    // ── Material hit sounds (from server hitFx array) ─────────────────────────
    // Only play sounds for hits that originated from THIS player's shots
    // (server sends hitFx to everyone, we filter by proximity to our shots)
    // Simpler: play all hitFx that are new and recent
    const serverNow = snap.t
    const clientOffset = now - serverNow
    for (const fx of snap.hitFx) {
      if (playedHitFx.current.has(fx.id)) continue
      const clientAt = fx.at + clientOffset
      if (now - clientAt > 300) continue  // skip stale fx
      playedHitFx.current.add(fx.id)
      sounds.hitMaterial(fx.material as HitMaterial)
    }
    // Prune old played ids to prevent unbounded growth
    if (playedHitFx.current.size > 200) {
      playedHitFx.current.clear()
    }

    // ── Kill streak (setState only when kills change) ─────────────────────────
    if (me.alive && me.kills > prevKills.current) {
      const k = me.kills
      const streakText =
        k >= 10 ? '💀 สังหาร ×' + k :
        k >= 5  ? '🔥 ต่อเนื่อง ×' + k :
        k === 4 ? '⚡ Quad Kill!' :
        k === 3 ? '🎯 Triple Kill!' :
        k === 2 ? '✌️ Double Kill!' :
        null
      if (streakText) {
        useGame.getState().setKillAnnouncement({ text: streakText, at: now })
      }
    }
    prevKills.current = me.kills

    // ── Reload progress ───────────────────────────────────────────────────────
    if (reloadState.startAt !== null && reloadState.duration > 0) {
      const elapsed = (now - reloadState.startAt) / reloadState.duration
      if (elapsed >= 1) {
        reloadState.startAt = null
        useGame.getState().setReloadProgress(null)
      } else {
        const prev = useGame.getState().reloadProgress ?? 0
        if (Math.abs(elapsed - prev) > 0.01) {
          useGame.getState().setReloadProgress(elapsed)
        }
      }
    }

    // ── Client-side prediction (stored in module ref, NOT Zustand) ────────────
    if (!me.alive) {
      predictedRef.current = null
      return
    }

    const inp = window.__lastInput
    const current = predictedRef.current

    const base: PredictedState = current ?? {
      x: me.x, y: me.y, z: me.z,
      vx: me.vx, vy: me.vy, vz: me.vz,
      yaw: inp.yaw, pitch: inp.pitch,
      onGround: false,
    }

    const stepped = stepPrediction(base, inp, Math.min(dt, 0.05))
    predictedRef.current = reconcile(stepped, me.x, me.y, me.z)
  })

  return null
}
