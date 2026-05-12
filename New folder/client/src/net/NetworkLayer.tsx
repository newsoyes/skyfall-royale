import { useEffect, useRef } from 'react'
import { getSocket } from '../net/clientSocket'
import { useSession } from '../store/session'
import { useGame } from '../store/game'
import { resumeAudio, sounds } from '../audio/procedural'
import { WEAPON_LABEL, CONSUMABLE_LABEL, ARMOR_LABEL, isWeaponId, isArmorItem, parseArmorItem } from '../game/weapons'
import type { WeaponId } from '../types/protocol'
import { useCombat } from '../store/combat'
import { setActiveMap } from '../game/terrain'

/** Registers Socket.IO listeners once and mirrors server state into Zustand. */
export function NetworkLayer() {
  const setRooms = useSession((s) => s.setRooms)
  const setOnline = useSession((s) => s.setOnline)
  const setRoom = useSession((s) => s.setRoom)
  const setUiPhase = useSession((s) => s.setUiPhase)
  const setPlayerId = useSession((s) => s.setPlayerId)
  const setEndMatch = useSession((s) => s.setEndMatch)
  const setSnapshot = useGame((s) => s.setSnapshot)
  const setHit = useGame((s) => s.setHit)
  const bumpEmote = useGame((s) => s.bumpEmote)
  const uiPhase = useSession((s) => s.uiPhase)

  const seq = useRef(0)

  useEffect(() => {
    const sock = getSocket()
    const onRooms = (r: unknown) => setRooms(r as never)
    const onOnline = (n: number) => setOnline(n)
    const goPlaying = () => {
      if (useSession.getState().uiPhase !== 'playing') {
        // Switch terrain to the room's map
        const room = useSession.getState().room
        if (room?.mapId) setActiveMap(room.mapId)
        setUiPhase('playing')
        setEndMatch(null)
        resumeAudio()
      }
    }
    const onRoomUpdate = (r: unknown) => {
      setRoom(r as never)
      const p = r as { phase?: string }
      if (p.phase === 'waiting' || p.phase === 'starting') {
        useCombat.getState().setAds(false)
        setUiPhase('waiting')
      }
      if (p.phase === 'playing') goPlaying()
    }
    const onMatchStart = () => {
      goPlaying()
    }
    const onState = (s: unknown) => {
      setSnapshot(s as never)
      const snap = s as { phase?: string }
      if (snap.phase === 'playing') goPlaying()
    }
    const onMatchEnd = (e: unknown) => {
      useCombat.getState().setAds(false)
      setEndMatch(e as never)
      setUiPhase('ended')
    }
    const onHit = (h: { shooterId: string; damage: number; head: boolean }) => {
      if (h.shooterId === useSession.getState().playerId) {
        setHit({ damage: h.damage, head: h.head, at: performance.now() })
        if (h.head) sounds.headshotMarker()
        else sounds.hitmarker()
      }
    }
    const onEmote = (e: { playerId: string; at: number }) => bumpEmote(e.playerId, e.at)
    const onPickup = (e: { playerId: string; weapon: string }) => {
      if (e.playerId === useSession.getState().playerId) {
        const item = e.weapon
        let label: string
        if (isWeaponId(item as WeaponId)) {
          label = WEAPON_LABEL[item as WeaponId] ?? item
        } else if (isArmorItem(item)) {
          const parsed = parseArmorItem(item)
          const slotName = parsed?.slot === 'helmet' ? '⛑️ หมวก' : '🦺 เสื้อเกราะ'
          const tierName = parsed ? (ARMOR_LABEL[parsed.tier] ?? parsed.tier) : ''
          label = `${slotName} ${tierName}`
        } else {
          label = CONSUMABLE_LABEL[item as import('../types/protocol').ConsumableId] ?? item
        }
        useSession.getState().setPickupToast({ weapon: item, label, at: performance.now() })
        sounds.pickup()
      }
    }
    const onDowned = (e: { playerId: string }) => {
      const pid = useSession.getState().playerId
      if (e.playerId === pid) sounds.downed()
    }
    const onRevived = (e: { playerId: string; reviverId: string }) => {
      const pid = useSession.getState().playerId
      if (e.playerId === pid || e.reviverId === pid) sounds.revived()
    }
    const onSupplyDrop = (e: { x: number; z: number }) => {
      useGame.getState().addSupplyDrop(e)
    }
    const onReconnect = () => {
      resumeAudio()
    }

    sock.on('lobby:rooms', onRooms)
    sock.on('lobby:online', onOnline)
    sock.on('room:update', onRoomUpdate)
    sock.on('match:start', onMatchStart)
    sock.on('game:state', onState)
    sock.on('match:end', onMatchEnd)
    sock.on('fx:hitmarker', onHit)
    sock.on('fx:emote', onEmote)
    sock.on('fx:pickup', onPickup)
    sock.on('fx:downed', onDowned)
    sock.on('fx:revived', onRevived)
    sock.on('fx:supplyDrop', onSupplyDrop)
    sock.on('match:reconnect', onReconnect)

    return () => {
      sock.off('lobby:rooms', onRooms)
      sock.off('lobby:online', onOnline)
      sock.off('room:update', onRoomUpdate)
      sock.off('match:start', onMatchStart)
      sock.off('game:state', onState)
      sock.off('match:end', onMatchEnd)
      sock.off('fx:hitmarker', onHit)
      sock.off('fx:emote', onEmote)
      sock.off('fx:pickup', onPickup)
      sock.off('fx:downed', onDowned)
      sock.off('fx:revived', onRevived)
      sock.off('fx:supplyDrop', onSupplyDrop)
      sock.off('match:reconnect', onReconnect)
    }
  }, [bumpEmote, setEndMatch, setHit, setOnline, setRoom, setRooms, setSnapshot, setUiPhase])

  useEffect(() => {
    if (uiPhase !== 'playing') return
    seq.current = 0  // reset sequence on each new match
    const sock = getSocket()
    const id = window.setInterval(() => {
      seq.current++
      sock.emit('game:input', { ...window.__lastInput, seq: seq.current })
    }, 50)
    return () => clearInterval(id)
  }, [uiPhase])

  return null
}

declare global {
  interface Window {
    __lastInput: {
      fwd: number
      str: number
      jump: boolean
      sprint: boolean
      yaw: number
      pitch: number
    }
  }
}

window.__lastInput = { fwd: 0, str: 0, jump: false, sprint: false, yaw: 0, pitch: 0 }
