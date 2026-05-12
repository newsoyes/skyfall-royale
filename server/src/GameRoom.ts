import { randomUUID } from 'crypto'
import type { Server, Socket } from 'socket.io'
import { getMap, type MapId } from './maps/mapRegistry.js'
import { WEAPON_CONFIG, CONSUMABLE_CONFIG, ARMOR_REDUCTION, randomRarity, randomPickupItem, isWeapon, isConsumable, isArmor, parseArmor } from './weapons.js'
import type {
  GamePhase, KillFeedEntry, PickupState, PlayerState,
  ProjectileState, RoomPublic, ServerGameSnapshot, WeaponId, ZoneState,
  DamageNumber, TeamMode, HitFx, HitMaterial, VehicleState, ArmorState,
} from './types.js'
import { recordMatchEnd } from './db.js'
import { buildColliders, closestPropHit, resolvePlayerAgainstProps, type PropColliders } from './propColliders.js'

const TICK_MS = 40   // เพิ่มจาก 50ms → 40ms (25 ticks/s) ลด jitter โดยไม่หนัก CPU มาก
const MAX_PLAYERS = 50
const SKY_SPAWN_Y = 110
const SKYDIVE_THRESHOLD = 20
const COUNTDOWN_MS = 6000
const PICKUP_RANGE = 2.8
const PICKUP_LIFETIME_MS = 95_000
const DROP_MIN_MS = 6_000
const DROP_MAX_MS = 12_000
const MULTI_DROP_COUNT = 3
const ZONE_DAMAGE_PER_SEC = 2.5
const GRAVITY = 28
const JUMP_V = 10.2
const WALK_SPD = 6.8
const SPRINT_SPD = 11.2
const BODY_HEAD_Y0 = 1.38
const BODY_HEAD_Y1 = 1.78
const DAMAGE_NUMBER_TTL = 2500
const HIT_FX_TTL = 800

// Knockdown / revive
const BLEED_OUT_MS = 30_000      // 30s to bleed out if not revived
const REVIVE_RANGE = 2.5         // distance to start reviving
const REVIVE_TIME_MS = 4_000     // 4s to fully revive

// Supply drop
const SUPPLY_DROP_INTERVAL_MS = 60_000   // every 60s
const SUPPLY_DROP_ITEM_COUNT = 5         // items per crate

// Rate limiting
const FIRE_RATE_LIMIT_WINDOW_MS = 1000
const FIRE_RATE_LIMIT_MAX = 30           // max 30 fire events per second (generous)

// Input validation
const MAX_ORIGIN_DIST = 8.0              // max distance origin can be from player position

// Reconnect grace period
const RECONNECT_GRACE_MS = 10_000        // 10s to reconnect before removing player

// Vehicle
const VEHICLE_SPAWN_INTERVAL_MS = 45_000  // spawn a vehicle every 45s
const VEHICLE_MAX_COUNT = 6               // max vehicles on map at once
const VEHICLE_ENTER_RANGE = 3.5           // distance to enter vehicle
const VEHICLE_HP = 400
const VEHICLE_SPEED_MAX = 22
const VEHICLE_ACCEL = 14
const VEHICLE_BRAKE = 18
const VEHICLE_TURN_SPD = 1.8
const VEHICLE_FALL_SPD = 30              // drop speed when spawning from sky
const VEHICLE_SPAWN_Y = 80              // spawn height

type InputPacket = {
  fwd: number
  str: number
  jump: boolean
  sprint: boolean
  yaw: number
  pitch: number
  seq: number
}

type InternalPlayer = {
  socketId: string
  id: string
  username: string
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  yaw: number; pitch: number
  hp: number; shield: number
  alive: boolean
  downed: boolean
  bleedOutAt: number | null       // timestamp when bleed-out completes
  reviveProgress: number          // 0–1
  reviverId: string | null        // who is currently reviving this player
  loadout: (WeaponId | null)[]
  weaponIndex: number
  mag: Partial<Record<WeaponId, number>>
  ammoReserve: Partial<Record<WeaponId, number>>
  kills: number
  damageDealt: number
  isHost: boolean
  ready: boolean
  lastInput?: InputPacket
  lastFireAt: Partial<Record<WeaponId, number>>
  fireEventCount: number          // rate limiting counter
  fireWindowStart: number         // rate limiting window start
  reloadingUntil: number
  lastSeq: number
  jumpCooldown: number
  lastTickPos: { x: number; y: number; z: number }
  emoteUntil: number
  pendingReload: { w: WeaponId; add: number; at: number } | null
  skydiving: boolean
  spectatingId: string | null
  teamId: string | null
  disconnectedAt: number | null   // timestamp of disconnect (for reconnect grace)
  armor: ArmorState
  inVehicleId: string | null
  consumables: Partial<Record<import('./types.js').ConsumableId, number>>
}

function weaponInHand(p: InternalPlayer): WeaponId | null {
  return p.loadout[p.weaponIndex] ?? null
}

function ensureMag(p: InternalPlayer, w: WeaponId) {
  const cfg = WEAPON_CONFIG[w]
  if (p.mag[w] == null) p.mag[w] = cfg.magSize
}

export class GameRoom {
  id: string
  name: string
  mapId: MapId
  teamMode: TeamMode
  maxPlayers: number
  phase: GamePhase = 'waiting'
  hostId: string | null = null
  players = new Map<string, InternalPlayer>()
  socketToPlayer = new Map<string, string>()
  pickups = new Map<string, PickupState & { spawnTime: number }>()
  projectiles = new Map<string, ProjectileState>()
  killFeed: KillFeedEntry[] = []
  damageNumbers: DamageNumber[] = []
  hitFx: HitFx[] = []
  vehicles = new Map<string, VehicleState & { driverInput?: { fwd: number; str: number }; falling?: boolean }>()
  zone: ZoneState = { centerX: 0, centerZ: 0, radius: 185, nextShrinkAt: 0, phaseIndex: 0 }
  phaseEndsAt: number | null = null
  matchStartedAt: number | null = null
  winnerId: string | null = null
  nextDropAt = 0
  nextSupplyDropAt = 0
  nextVehicleSpawnAt = 0
  tickTimer: NodeJS.Timeout | null = null
  io: Server
  channel: string
  private colliders: PropColliders
  private terrainHeight: (x: number, z: number) => number
  private clampToMap: (x: number, z: number) => { x: number; z: number }
  private mapHalf: number

  constructor(io: Server, opts: { id: string; name: string; maxPlayers?: number; mapId?: MapId; teamMode?: TeamMode }) {
    this.io = io
    this.id = opts.id
    this.name = opts.name
    this.mapId = opts.mapId ?? 'island'
    this.teamMode = opts.teamMode ?? 'solo'
    this.maxPlayers = Math.min(opts.maxPlayers ?? 24, MAX_PLAYERS)
    this.channel = `room:${this.id}`
    const map = getMap(this.mapId)
    this.terrainHeight = map.terrainHeight
    this.clampToMap = map.clampToMap
    this.mapHalf = map.mapHalf
    this.colliders = buildColliders(map)
  }

  publicInfo(): RoomPublic {
    return {
      id: this.id,
      name: this.name,
      playerCount: this.players.size,
      maxPlayers: this.maxPlayers,
      phase: this.phase === 'playing' ? 'playing' : this.phase === 'ended' ? 'ended' : 'waiting',
      mapId: this.mapId,
      teamMode: this.teamMode,
    }
  }

  addPlayer(socket: Socket, username: string): InternalPlayer | null {
    if (this.players.size >= this.maxPlayers) return null
    const id = randomUUID()
    const isHost = this.players.size === 0
    if (isHost) this.hostId = id
    const p: InternalPlayer = {
      socketId: socket.id,
      id,
      username: username.slice(0, 24),
      x: 0,
      y: this.terrainHeight(0, 0) + 2,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      hp: 100,
      shield: 50,
      alive: true,
      loadout: ['pistol', null, null, null],
      weaponIndex: 0,
      mag: { pistol: WEAPON_CONFIG.pistol.magSize },
      ammoReserve: { pistol: 60, ar: 0, sniper: 0, rpg: 0, shotgun: 0, smg: 0 },
      kills: 0,
      damageDealt: 0,
      isHost,
      ready: false,
      lastFireAt: {},
      fireEventCount: 0,
      fireWindowStart: 0,
      reloadingUntil: 0,
      lastSeq: 0,
      jumpCooldown: 0,
      lastTickPos: { x: 0, y: 0, z: 0 },
      emoteUntil: 0,
      pendingReload: null,
      skydiving: false,
      spectatingId: null,
      teamId: null,
      downed: false,
      bleedOutAt: null,
      reviveProgress: 0,
      reviverId: null,
      disconnectedAt: null,
      armor: { helmet: null, vest: null },
      inVehicleId: null,
      consumables: {},
    }
    this.players.set(id, p)
    this.socketToPlayer.set(socket.id, id)
    socket.join(this.channel)
    this.broadcastLobby()
    return p
  }

  removePlayer(socketId: string) {
    const pid = this.socketToPlayer.get(socketId)
    if (!pid) return
    const p = this.players.get(pid)

    // During an active match, keep the player for reconnect grace period
    if (p && this.phase === 'playing') {
      p.disconnectedAt = Date.now()
      p.socketId = ''  // mark as disconnected
      this.socketToPlayer.delete(socketId)
      this.broadcastLobby()
      return
    }

    this.socketToPlayer.delete(socketId)
    this.players.delete(pid)
    if (this.hostId === pid) {
      const next = this.players.values().next().value as InternalPlayer | undefined
      this.hostId = next?.id ?? null
      if (next) next.isHost = true
    }
    if (this.players.size === 0) this.stopTick()
    this.broadcastLobby()
  }

  /** Called when a player reconnects with the same username during grace period */
  reconnectPlayer(socket: Socket, playerId: string): boolean {
    const p = this.players.get(playerId)
    if (!p || !p.disconnectedAt) return false
    if (Date.now() - p.disconnectedAt > RECONNECT_GRACE_MS) return false

    // Restore connection
    const oldSocketId = p.socketId
    if (oldSocketId) this.socketToPlayer.delete(oldSocketId)
    p.socketId = socket.id
    p.disconnectedAt = null
    this.socketToPlayer.set(socket.id, playerId)
    socket.join(this.channel)
    return true
  }

  getPlayerBySocket(socketId: string) {
    const id = this.socketToPlayer.get(socketId)
    if (!id) return undefined
    return this.players.get(id)
  }

  setReady(socketId: string, ready: boolean) {
    const p = this.getPlayerBySocket(socketId)
    if (!p || this.phase !== 'waiting') return
    p.ready = ready
    this.io.to(this.channel).emit('room:update', this.roomPayload())
  }

  tryStartMatch(socketId: string) {
    const p = this.getPlayerBySocket(socketId)
    if (!p?.isHost || this.phase !== 'waiting') return
    if (this.players.size < 1) return
    this.phase = 'starting'
    const now = Date.now()
    this.phaseEndsAt = now + COUNTDOWN_MS
    this.io.to(this.channel).emit('room:update', this.roomPayload())
    setTimeout(() => this.beginMatch(), COUNTDOWN_MS)
  }

  private beginMatch() {
    this.phase = 'playing'
    const now = Date.now()
    this.matchStartedAt = now
    this.phaseEndsAt = null
    this.winnerId = null
    this.killFeed = []
    this.pickups.clear()
    this.projectiles.clear()
    this.vehicles.clear()
    this.damageNumbers = []
    this.hitFx = []
    this.zone = {
      centerX: 0,
      centerZ: 0,
      radius: 175,
      nextShrinkAt: now + 45_000,
      phaseIndex: 0,
    }
    for (const p of this.players.values()) {
      const a = Math.random() * Math.PI * 2
      const r = 20 + Math.random() * 70
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const clamped = this.clampToMap(x, z)
      p.x = clamped.x
      p.z = clamped.z
      p.y = SKY_SPAWN_Y
      p.vx = p.vy = p.vz = 0
      p.hp = 100
      p.shield = 50
      p.alive = true
      p.kills = 0
      p.damageDealt = 0
      p.loadout = ['pistol', null, null, null]
      p.weaponIndex = 0
      p.mag = { pistol: WEAPON_CONFIG.pistol.magSize }
      p.ammoReserve = { pistol: 90, ar: 30, sniper: 10, rpg: 2, shotgun: 16, smg: 70 }
      p.lastTickPos = { x: p.x, y: p.y, z: p.z }
      p.jumpCooldown = 0
      p.pendingReload = null
      p.skydiving = true
      p.spectatingId = null
      p.teamId = null
      p.downed = false
      p.bleedOutAt = null
      p.reviveProgress = 0
      p.reviverId = null
      p.disconnectedAt = null
      p.fireEventCount = 0
      p.fireWindowStart = 0
      p.armor = { helmet: null, vest: null }
      p.inVehicleId = null
      p.consumables = {}
    }

    // Assign teams for duo/squad mode
    if (this.teamMode !== 'solo') {
      const teamSize = this.teamMode === 'duo' ? 2 : 4
      const playerList = [...this.players.values()]
      playerList.forEach((p, i) => {
        p.teamId = `team_${Math.floor(i / teamSize)}`
      })
    }
    this.nextDropAt = now + DROP_MIN_MS + Math.random() * (DROP_MAX_MS - DROP_MIN_MS)
    this.nextSupplyDropAt = now + SUPPLY_DROP_INTERVAL_MS
    this.nextVehicleSpawnAt = now + 15_000  // first vehicle after 15s
    this.startTick()
    this.io.to(this.channel).emit('match:start', { t: now })
    this.io.to(this.channel).emit('room:update', this.roomPayload())
  }

  private startTick() {
    if (this.tickTimer) return
    this.tickTimer = setInterval(() => this.tick(), TICK_MS)
  }

  stopTick() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
  }

  private tick() {
    if (this.phase !== 'playing') return
    const now = Date.now()
    const dt = TICK_MS / 1000
    for (const p of this.players.values()) {
      if (p.pendingReload && now >= p.pendingReload.at) {
        const { w, add } = p.pendingReload
        p.pendingReload = null
        p.reloadingUntil = 0
        ensureMag(p, w)
        p.mag[w] = (p.mag[w] ?? 0) + add
      }
    }
    this.updateZone(now, dt)
    for (const p of this.players.values()) {
      if (!p.alive && !p.downed) continue
      if (p.downed) {
        this.tickDowned(p, now, dt)
        continue
      }
      this.simulatePlayer(p, dt)
      this.applyZoneDamage(p, dt)
    }
    this.tickRevive(now, dt)
    this.cleanupDisconnected(now)
    this.updateProjectiles(dt)
    this.updatePickups(dt)
    this.updateVehicles(dt)
    this.spawnDropsIfNeeded(now)
    this.spawnSupplyDropIfNeeded(now)
    this.spawnVehicleIfNeeded(now)
    this.cleanupPickups(now)
    this.cleanupDamageNumbers(now)
    this.cleanupHitFx(now)
    this.checkWinCondition()
    this.io.to(this.channel).emit('game:state', this.snapshot(now))
  }

  private updateZone(now: number, dt: number) {
    const start = this.matchStartedAt ?? now
    const elapsed = (now - start) / 1000
    // Target radius eases down over ~7 minutes of match
    const dur = 420
    const t = Math.min(1, elapsed / dur)
    const targetR = 175 * (1 - t) + 10 * t + Math.sin(elapsed * 0.08) * 2
    this.zone.radius += (targetR - this.zone.radius) * Math.min(1, dt * 0.35)
    // Slowly drift center toward a biased point for late game drama
    const biasX = Math.sin(elapsed * 0.05) * 25
    const biasZ = Math.cos(elapsed * 0.047) * 25
    this.zone.centerX += (biasX - this.zone.centerX) * dt * 0.08
    this.zone.centerZ += (biasZ - this.zone.centerZ) * dt * 0.08
  }

  private applyZoneDamage(p: InternalPlayer, dt: number) {
    const dx = p.x - this.zone.centerX
    const dz = p.z - this.zone.centerZ
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist > this.zone.radius) {
      const dps = ZONE_DAMAGE_PER_SEC * (1 + (dist - this.zone.radius) * 0.04)
      this.damagePlayer(p, null, dps * dt, 'zone')
    }
  }

  private damagePlayer(
    target: InternalPlayer,
    attacker: InternalPlayer | null,
    amount: number,
    kind: 'bullet' | 'explosion' | 'zone',
  ) {
    if ((!target.alive && !target.downed) || amount <= 0) return
    if (attacker && attacker.teamId && attacker.teamId === target.teamId) return

    let rem = amount
    if (target.shield > 0) {
      const s = Math.min(target.shield, rem)
      target.shield -= s
      rem -= s
    }
    // Apply armor damage reduction (vest reduces body damage, helmet reduces headshot bonus)
    if (rem > 0 && kind === 'bullet') {
      const vestTier = target.armor.vest
      if (vestTier) rem *= (1 - ARMOR_REDUCTION[vestTier])
    }
    target.hp -= rem
    if (attacker && attacker.id !== target.id && kind !== 'zone') {
      attacker.damageDealt += amount
    }

    if (target.hp <= 0) {
      target.hp = 0
      // Team modes: knockdown instead of instant death
      if (this.teamMode !== 'solo' && target.alive && !target.downed) {
        target.downed = true
        target.alive = false
        target.bleedOutAt = Date.now() + BLEED_OUT_MS
        target.reviveProgress = 0
        target.pendingReload = null
        this.io.to(this.channel).emit('fx:downed', { playerId: target.id })
        return
      }
      // Solo or already downed → full death
      target.hp = 0
      target.alive = false
      target.downed = false
      target.pendingReload = null
      if (attacker && attacker.id !== target.id) {
        attacker.kills += 1
        const w = weaponInHand(attacker) ?? 'ar'
        this.pushKillFeed(attacker.username, target.username, w)
      } else if (kind === 'zone') {
        this.pushKillFeed('พายุ', target.username, 'ar')
      }
    }
  }

  private tickDowned(p: InternalPlayer, now: number, dt: number) {
    // Apply zone damage to downed players too
    const dx = p.x - this.zone.centerX
    const dz = p.z - this.zone.centerZ
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist > this.zone.radius) {
      const dps = ZONE_DAMAGE_PER_SEC * 2 * (1 + (dist - this.zone.radius) * 0.04)
      p.hp = Math.max(0, p.hp - dps * dt)
    }
    // Bleed out
    if (p.bleedOutAt && now >= p.bleedOutAt) {
      p.downed = false
      p.alive = false
      p.bleedOutAt = null
      this.pushKillFeed('เลือดออก', p.username, 'pistol')
    }
  }

  private tickRevive(now: number, dt: number) {
    if (this.teamMode === 'solo') return
    for (const downed of this.players.values()) {
      if (!downed.downed) continue
      // Find a living teammate nearby
      let reviver: InternalPlayer | null = null
      for (const p of this.players.values()) {
        if (!p.alive || p.teamId !== downed.teamId) continue
        const d = Math.hypot(p.x - downed.x, p.z - downed.z)
        if (d < REVIVE_RANGE) { reviver = p; break }
      }
      if (reviver) {
        downed.reviverId = reviver.id
        downed.reviveProgress = Math.min(1, downed.reviveProgress + dt / (REVIVE_TIME_MS / 1000))
        if (downed.reviveProgress >= 1) {
          downed.downed = false
          downed.alive = true
          downed.hp = 30
          downed.shield = 0
          downed.reviveProgress = 0
          downed.reviverId = null
          downed.bleedOutAt = null
          this.io.to(this.channel).emit('fx:revived', { playerId: downed.id, reviverId: reviver.id })
        }
      } else {
        downed.reviverId = null
        // Decay progress if no reviver
        downed.reviveProgress = Math.max(0, downed.reviveProgress - dt * 0.3)
      }
    }
  }

  private cleanupDisconnected(now: number) {
    for (const [pid, p] of this.players) {
      if (p.disconnectedAt && now - p.disconnectedAt > RECONNECT_GRACE_MS) {
        // Grace period expired — remove player
        this.players.delete(pid)
        if (this.hostId === pid) {
          const next = this.players.values().next().value as InternalPlayer | undefined
          this.hostId = next?.id ?? null
          if (next) next.isHost = true
        }
        this.broadcastLobby()
      }
    }
  }

  private pushKillFeed(killer: string, victim: string, weapon: WeaponId) {
    const e: KillFeedEntry = {
      id: randomUUID(),
      killer,
      victim,
      weapon,
      at: Date.now(),
    }
    this.killFeed.unshift(e)
    if (this.killFeed.length > 8) this.killFeed.pop()
  }

  private simulatePlayer(p: InternalPlayer, dt: number) {
    const inp = p.lastInput
    if (inp) {
      if (inp.seq < p.lastSeq) {
        /* out of order — ignore */
      } else {
        p.lastSeq = inp.seq
        p.yaw = inp.yaw
        p.pitch = Math.max(-1.45, Math.min(1.45, inp.pitch))
      }
    }
    const th = this.terrainHeight(p.x, p.z)
    const ground = th + 0.02
    const onGround = p.y <= ground + 0.12 && p.vy <= 0.2

    if (inp && p.alive) {
      const sp = inp.sprint ? SPRINT_SPD : WALK_SPD
      const cy = Math.cos(p.yaw)
      const sy = Math.sin(p.yaw)
      /** Strafe sign matches Three.js camera (+X = screen right): invert client str axis vs analytic basis. */
      const fx = sy * inp.fwd - cy * inp.str
      const fz = cy * inp.fwd + sy * inp.str
      const len = Math.hypot(fx, fz) || 1
      p.vx = (fx / len) * sp
      p.vz = (fz / len) * sp
      if (onGround && inp.jump && p.jumpCooldown <= 0) {
        p.vy = JUMP_V
        p.jumpCooldown = 0.28
      }
    } else {
      p.vx *= 0.85
      p.vz *= 0.85
    }

    if (!onGround || p.y > ground + 0.2) {
      p.vy -= GRAVITY * dt
    } else if (p.vy < 0) {
      p.vy = 0
    }

    let nx = p.x + p.vx * dt
    let nz = p.z + p.vz * dt
    const c = this.clampToMap(nx, nz)
    nx = c.x
    nz = c.z
    let ny = p.y + p.vy * dt

    const g2 = this.terrainHeight(nx, nz) + 0.02
    if (ny < g2) {
      ny = g2
      p.vy = 0
    }
    // Basic anti-cheat speed clamp
    const dx = nx - p.lastTickPos.x
    const dy = ny - p.lastTickPos.y
    const dz = nz - p.lastTickPos.z
    const maxStep = (inp?.sprint ? SPRINT_SPD : WALK_SPD) * dt * 2.2 + 3 * dt
    const step = Math.hypot(dx, dy, dz)
    if (step > maxStep + 6) {
      nx = p.lastTickPos.x + (dx / step) * maxStep
      ny = p.lastTickPos.y + (dy / step) * maxStep
      nz = p.lastTickPos.z + (dz / step) * maxStep
      const g3 = this.terrainHeight(nx, nz) + 0.02
      if (ny < g3) ny = g3
    }
    p.x = nx
    p.y = ny
    p.z = nz
    const resolved = resolvePlayerAgainstProps(this.colliders, this.terrainHeight, p.x, p.y, p.z, p.vx, p.vy, p.vz)
    const cm = this.clampToMap(resolved.x, resolved.z)
    p.x = cm.x
    p.z = cm.z
    p.y = resolved.y
    // Apply velocity corrections from collision (stops player from sliding through walls)
    p.vx = resolved.vx
    p.vy = resolved.vy
    p.vz = resolved.vz
    const g4 = this.terrainHeight(p.x, p.z) + 0.02
    if (p.y < g4) p.y = g4
    p.lastTickPos = { x: p.x, y: p.y, z: p.z }

    p.jumpCooldown = Math.max(0, p.jumpCooldown - dt)

    // Update skydiving flag
    const terrainY = this.terrainHeight(p.x, p.z)
    if (p.skydiving && p.y < terrainY + SKYDIVE_THRESHOLD) {
      p.skydiving = false
    }

    for (const [pid, pk] of this.pickups) {
      const d = Math.hypot(pk.x - p.x, pk.y - p.y, pk.z - p.z)
      if (d < PICKUP_RANGE) {
        this.applyPickup(p, pk.item)
        this.pickups.delete(pid)
      }
    }
  }

  private applyPickup(p: InternalPlayer, item: import('./types.js').PickupItemId) {
    if (isWeapon(item)) {
      const cfg = WEAPON_CONFIG[item]
      const MAX_RESERVE = cfg.magSize * 6
      const idx = p.loadout.findIndex((s) => s == null)
      if (idx >= 0) {
        p.loadout[idx] = item
        ensureMag(p, item)
        p.mag[item] = cfg.magSize
      } else {
        p.loadout[p.weaponIndex] = item
        ensureMag(p, item)
        p.mag[item] = cfg.magSize
      }
      p.ammoReserve[item] = Math.min(MAX_RESERVE, (p.ammoReserve[item] ?? 0) + cfg.magSize * 2)
      this.io.to(this.channel).emit('fx:pickup', { playerId: p.id, weapon: item })
    } else if (isConsumable(item)) {
      const cfg = CONSUMABLE_CONFIG[item]
      // Throwables (grenade/smoke) — store in reserve, not instant use
      if (cfg.isThrowable) {
        const key = item as import('./types.js').ConsumableId
        p.consumables = p.consumables ?? {}
        p.consumables[key] = Math.min(3, (p.consumables[key] ?? 0) + 1)
      } else {
        p.hp = Math.min(100, p.hp + cfg.healHp)
        p.shield = Math.min(100, p.shield + cfg.healShield)
      }
      this.io.to(this.channel).emit('fx:pickup', { playerId: p.id, weapon: item })
    } else if (isArmor(item)) {
      const parsed = parseArmor(item)
      if (parsed) {
        // Only equip if better than current
        const tierOrder: import('./types.js').ArmorTier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
        const current = p.armor[parsed.slot]
        const currentIdx = current ? tierOrder.indexOf(current) : -1
        const newIdx = tierOrder.indexOf(parsed.tier)
        if (newIdx > currentIdx) {
          p.armor[parsed.slot] = parsed.tier
        }
        this.io.to(this.channel).emit('fx:pickup', { playerId: p.id, weapon: item })
      }
    }
  }

  private spawnDropsIfNeeded(now: number) {
    if (now < this.nextDropAt) return
    this.nextDropAt = now + DROP_MIN_MS + Math.random() * (DROP_MAX_MS - DROP_MIN_MS)
    // Spawn multiple items per drop event
    for (let i = 0; i < MULTI_DROP_COUNT; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 15 + Math.random() * (this.mapHalf - 30)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const cx = this.clampToMap(x, z)
      const y = this.terrainHeight(cx.x, cx.z) + 55
      const id = randomUUID()
      const item = randomPickupItem()
      const rarity = randomRarity()
      this.pickups.set(id, {
        id,
        x: cx.x,
        y,
        z: cx.z,
        item,
        rarity,
        spawnTime: now,
      })
    }
  }

  private updatePickups(dt: number) {
    const fall = 42 * dt
    for (const pk of this.pickups.values()) {
      const ground = this.terrainHeight(pk.x, pk.z) + 0.6
      if (pk.y > ground) {
        pk.y = Math.max(ground, pk.y - fall)
      } else {
        pk.y = ground
      }
    }
  }

  private cleanupPickups(now: number) {
    for (const [id, pk] of this.pickups) {
      if (now - pk.spawnTime > PICKUP_LIFETIME_MS) this.pickups.delete(id)
    }
  }

  private updateProjectiles(dt: number) {
    for (const [id, pr] of this.projectiles) {
      pr.fuseMs -= TICK_MS
      const ox = pr.x
      const oy = pr.y
      const oz = pr.z
      pr.x += pr.vx * dt
      pr.y += pr.vy * dt
      pr.z += pr.vz * dt
      pr.vy -= GRAVITY * 0.35 * dt
      const dx = pr.x - ox
      const dy = pr.y - oy
      const dz = pr.z - oz
      const seg = Math.hypot(dx, dy, dz) || 1e-6
      const ux = dx / seg
      const uy = dy / seg
      const uz = dz / seg
      const propT = closestPropHit(this.colliders, ox, oy, oz, ux, uy, uz, seg + 0.15)
      const th = this.terrainHeight(pr.x, pr.z) + 0.3
      let hit = false
      if (propT != null) {
        hit = true
      } else if (pr.y <= th || pr.fuseMs <= 0) {
        hit = true
      } else {
        for (const p of this.players.values()) {
          if (!p.alive || p.id === pr.ownerId) continue
          const dy = pr.y - (p.y + 0.9)
          if (Math.hypot(pr.x - p.x, dy, pr.z - p.z) < 1.1) {
            hit = true
            break
          }
        }
      }
      if (hit) {
        this.explode(pr)
        this.projectiles.delete(id)
      }
    }
  }

  private explode(pr: ProjectileState) {
    const owner = this.players.get(pr.ownerId)
    // Grenade uses its own config; RPG uses weapon config
    let rad: number
    let dmg: number
    if (pr.type === 'grenade') {
      const cfg = CONSUMABLE_CONFIG.grenade
      rad = cfg.blastRadius ?? 8
      dmg = cfg.blastDamage ?? 80
    } else if (pr.type === 'smoke') {
      // Smoke doesn't deal damage — just emit FX event
      this.io.to(this.channel).emit('fx:smoke', { x: pr.x, y: pr.y, z: pr.z, radius: CONSUMABLE_CONFIG.smoke_grenade.smokeRadius ?? 6, durationMs: CONSUMABLE_CONFIG.smoke_grenade.smokeDurationMs ?? 15000 })
      return
    } else {
      const cfg = WEAPON_CONFIG.rpg
      rad = cfg.explosionRadius ?? 12
      dmg = cfg.explosionDamage ?? 95
    }
    for (const p of this.players.values()) {
      if (!p.alive) continue
      const dist = Math.hypot(p.x - pr.x, p.y + 0.9 - pr.y, p.z - pr.z)
      if (dist < rad) {
        const fall = 1 - dist / rad
        const amt = dmg * fall
        this.damagePlayer(p, owner ?? null, amt, 'explosion')
      }
    }
    this.io.to(this.channel).emit('fx:explosion', { x: pr.x, y: pr.y, z: pr.z, type: pr.type })
  }

  private checkWinCondition() {
    // Count only truly alive (not downed) players
    const alive = [...this.players.values()].filter((p) => p.alive && !p.downed)
    const total = [...this.players.values()].filter((p) => !p.disconnectedAt).length
    if (total <= 1) return

    if (this.teamMode !== 'solo') {
      // Team win: only one team remaining
      const aliveTeams = new Set(alive.map((p) => p.teamId).filter((t): t is string => t !== null))
      if (aliveTeams.size > 1) return
      if (alive.length === 0) {
        this.endMatch(null, null)
        return
      }
      const winTeamId = [...aliveTeams][0]
      if (!winTeamId) { this.endMatch(null, null); return }
      const winLeader = alive.find((p) => p.teamId === winTeamId)
      this.endMatch(winLeader?.id ?? null, winLeader?.username ?? null)
      return
    }

    // Solo mode
    if (alive.length > 1) return
    if (alive.length === 0) { this.endMatch(null, null); return }
    const w = alive[0]!
    this.endMatch(w.id, w.username)
  }

  private endMatch(winnerId: string | null, winnerName: string | null) {
    this.phase = 'ended'
    this.stopTick()
    this.winnerId = winnerId
    const placements = this.buildPlacements(winnerId)
    this.io.to(this.channel).emit('match:end', { winnerId, winnerName, placements })
    void Promise.all(
      [...this.players.values()].map((pl) =>
        recordMatchEnd(pl.username, pl.id === winnerId, pl.damageDealt),
      ),
    )
  }

  private buildPlacements(winnerId: string | null) {
    const rows = [...this.players.values()].map((p) => ({
      id: p.id,
      username: p.username,
      kills: p.kills,
      damage: Math.floor(p.damageDealt),
      placement: 0,
      alive: p.alive,
    }))
    rows.sort((a, b) => {
      if (winnerId) {
        if (a.id === winnerId) return -1
        if (b.id === winnerId) return 1
      }
      return b.kills - a.kills || b.damage - a.damage
    })
    let rank = 1
    for (const row of rows) {
      row.placement = rank++
      delete (row as { alive?: boolean }).alive
    }
    return rows.map(({ id, username, kills, damage, placement }) => ({
      id,
      username,
      kills,
      damage,
      placement,
    }))
  }

  handleInput(socketId: string, inp: InputPacket) {
    const p = this.getPlayerBySocket(socketId)
    if (!p || this.phase !== 'playing') return
    if (p.alive) {
      p.lastInput = inp
    } else {
      // Dead player: cycle spectate target with jump key
      if (inp.jump) {
        const alive = [...this.players.values()].filter((pl) => pl.alive)
        if (alive.length === 0) return
        const cur = alive.findIndex((pl) => pl.id === p.spectatingId)
        // findIndex returns -1 if not found → (−1+1)%n = 0, which is correct
        p.spectatingId = alive[(cur + 1) % alive.length]!.id
      }
    }
  }

  handleWeaponIndex(socketId: string, index: number) {
    const p = this.getPlayerBySocket(socketId)
    if (!p || this.phase !== 'playing') return
    p.weaponIndex = Math.max(0, Math.min(3, Math.floor(index)))
  }

  handleReload(socketId: string) {
    const p = this.getPlayerBySocket(socketId)
    if (!p || this.phase !== 'playing' || !p.alive) return
    const w = weaponInHand(p)
    if (!w) return
    const cfg = WEAPON_CONFIG[w]
    const now = Date.now()
    if (now < p.reloadingUntil) return
    const cur = p.mag[w] ?? 0
    if (cur >= cfg.magSize) return
    const need = cfg.magSize - cur
    const have = p.ammoReserve[w] ?? 0
    if (have <= 0) return
    if (p.pendingReload) return
    p.reloadingUntil = now + cfg.reloadMs
    const take = Math.min(need, have)
    p.ammoReserve[w] = have - take
    p.pendingReload = { w, add: take, at: now + cfg.reloadMs }
  }

  handleFire(socketId: string, origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }) {
    const p = this.getPlayerBySocket(socketId)
    if (!p || this.phase !== 'playing' || !p.alive || p.downed) return
    const w = weaponInHand(p)
    if (!w) return
    const cfg = WEAPON_CONFIG[w]
    const now = Date.now()

    // ── Rate limiting ─────────────────────────────────────────────────────────
    if (now - p.fireWindowStart > FIRE_RATE_LIMIT_WINDOW_MS) {
      p.fireWindowStart = now
      p.fireEventCount = 0
    }
    p.fireEventCount++
    if (p.fireEventCount > FIRE_RATE_LIMIT_MAX) return  // silently drop

    // ── Input validation: origin must be near player ──────────────────────────
    const originDist = Math.hypot(origin.x - p.x, origin.y - (p.y + 1.4), origin.z - p.z)
    if (originDist > MAX_ORIGIN_DIST) return  // teleport-shoot exploit

    if (now < p.reloadingUntil) return
    if (now - (p.lastFireAt[w] ?? 0) < cfg.fireRateMs) return
    ensureMag(p, w)
    if ((p.mag[w] ?? 0) <= 0) return
    p.mag[w] = (p.mag[w] ?? 0) - 1
    p.lastFireAt[w] = now

    const len = Math.hypot(dir.x, dir.y, dir.z) || 1
    const d = { x: dir.x / len, y: dir.y / len, z: dir.z / len }

    if (cfg.projectile) {
      const spd = cfg.rocketSpeed ?? 50
      const id = randomUUID()
      this.projectiles.set(id, {
        id, ownerId: p.id,
        x: origin.x, y: origin.y, z: origin.z,
        vx: d.x * spd, vy: d.y * spd, vz: d.z * spd,
        fuseMs: 4500,
        type: 'rocket',
      })
      return
    }

    const pellets = cfg.pellets ?? 1
    for (let i = 0; i < pellets; i++) {
      const jx = (Math.random() - 0.5) * cfg.spread
      const jy = (Math.random() - 0.5) * cfg.spread
      const jz = (Math.random() - 0.5) * cfg.spread
      const rd = normalize({ x: d.x + jx, y: d.y + jy, z: d.z + jz })

      const propT = closestPropHit(this.colliders, origin.x, origin.y, origin.z, rd.x, rd.y, rd.z, cfg.range)
      const hit = this.raycastPlayers(p.id, origin, rd, cfg.range)

      // Emit hit FX for prop hits (material-based sound)
      if (propT != null && (hit == null || propT < hit.t - 0.01)) {
        const hx = origin.x + rd.x * propT
        const hy = origin.y + rd.y * propT
        const hz = origin.z + rd.z * propT
        // Determine material from prop type (simplified: rocks=rock, ruins=wood, trees=wood)
        const mat: HitMaterial = 'wood'
        this.hitFx.push({ id: randomUUID(), x: hx, y: hy, z: hz, material: mat, at: Date.now() })
        continue
      }

      if (hit) {
        const target = this.players.get(hit.pid)
        if (!target || (!target.alive && !target.downed)) continue
        const mult = hit.head ? cfg.headshotMult : 1
        const dmg = cfg.damage * mult
        this.damagePlayer(target, p, dmg, 'bullet')
        const hitX = origin.x + rd.x * hit.t
        const hitY = origin.y + rd.y * hit.t
        const hitZ = origin.z + rd.z * hit.t
        this.pushDamageNumber(hitX, hitY, hitZ, Math.round(dmg), hit.head)
        this.hitFx.push({ id: randomUUID(), x: hitX, y: hitY, z: hitZ, material: 'flesh', at: Date.now() })
        this.io.to(this.channel).emit('fx:hitmarker', { shooterId: p.id, damage: Math.round(dmg), head: hit.head })
      }
    }
  }

  private raycastPlayers(
    selfId: string,
    o: { x: number; y: number; z: number },
    d: { x: number; y: number; z: number },
    maxDist: number,
  ): { pid: string; head: boolean; t: number } | null {
    let bestT = maxDist
    let best: { pid: string; head: boolean; t: number } | null = null
    for (const p of this.players.values()) {
      if ((!p.alive && !p.downed) || p.id === selfId) continue
      // Head AABB
      const headHit = this.rayAabb(
        o,
        d,
        p.x - 0.32,
        p.y + BODY_HEAD_Y0,
        p.z - 0.32,
        p.x + 0.32,
        p.y + BODY_HEAD_Y1,
        p.z + 0.32,
      )
      // Body AABB
      const bodyHit = this.rayAabb(
        o,
        d,
        p.x - 0.42,
        p.y + 0.15,
        p.z - 0.42,
        p.x + 0.42,
        p.y + BODY_HEAD_Y0 + 0.05,
        p.z + 0.42,
      )
      const pick = headHit != null && (bodyHit == null || headHit <= bodyHit) ? headHit : bodyHit
      const isHead = headHit != null && pick === headHit
      if (pick != null && pick < bestT) {
        bestT = pick
        best = { pid: p.id, head: !!isHead, t: pick }
      }
    }
    return best
  }

  private rayAabb(
    o: { x: number; y: number; z: number },
    d: { x: number; y: number; z: number },
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
  ): number | null {
    let tmin = 0
    let tmax = 1e9
    const axes: Array<keyof typeof o> = ['x', 'y', 'z']
    const minB = { x: x0, y: y0, z: z0 }
    const maxB = { x: x1, y: y1, z: z1 }
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
    return tmin >= 0 ? tmin : tmax >= 0 ? tmax : null
  }

  private pushDamageNumber(x: number, y: number, z: number, damage: number, head: boolean) {
    const now = Date.now()
    this.damageNumbers.push({ id: randomUUID(), x, y, z, damage, head, at: now })
    if (this.damageNumbers.length > 40) this.damageNumbers.shift()
  }

  private cleanupDamageNumbers(now: number) {
    this.damageNumbers = this.damageNumbers.filter((d) => now - d.at < DAMAGE_NUMBER_TTL)
  }

  private cleanupHitFx(now: number) {
    this.hitFx = this.hitFx.filter((h) => now - h.at < HIT_FX_TTL)
  }

  private spawnSupplyDropIfNeeded(now: number) {
    if (now < this.nextSupplyDropAt) return
    this.nextSupplyDropAt = now + SUPPLY_DROP_INTERVAL_MS

    const a = Math.random() * Math.PI * 2
    const r = 20 + Math.random() * (this.mapHalf * 0.6)
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const cx = this.clampToMap(x, z)

    // Spawn multiple high-rarity items at the supply drop location
    for (let i = 0; i < SUPPLY_DROP_ITEM_COUNT; i++) {
      const ox = cx.x + (Math.random() - 0.5) * 3
      const oz = cx.z + (Math.random() - 0.5) * 3
      const oy = this.terrainHeight(ox, oz) + 60
      const id = randomUUID()
      // Supply drops always have rare+ items
      const rarityRoll = Math.random()
      const rarity = rarityRoll < 0.4 ? 'rare' : rarityRoll < 0.75 ? 'epic' : 'legendary'
      this.pickups.set(id, {
        id,
        x: ox, y: oy, z: oz,
        item: randomPickupItem(),
        rarity,
        spawnTime: now,
        isSupplyDrop: true,
      })
    }
    this.io.to(this.channel).emit('fx:supplyDrop', { x: cx.x, z: cx.z })
  }

  handleEmote(socketId: string) {
    const p = this.getPlayerBySocket(socketId)
    if (!p) return
    const now = Date.now()
    if (now < p.emoteUntil) return
    p.emoteUntil = now + 2500
    this.io.to(this.channel).emit('fx:emote', { playerId: p.id, at: now })
  }

  handleThrow(socketId: string, dir: { x: number; y: number; z: number }, type: 'grenade' | 'smoke') {
    const p = this.getPlayerBySocket(socketId)
    if (!p || this.phase !== 'playing' || !p.alive || p.downed) return
    const key = type === 'grenade' ? 'grenade' : 'smoke_grenade'
    const count = p.consumables[key] ?? 0
    if (count <= 0) return
    p.consumables[key] = count - 1
    const cfg = CONSUMABLE_CONFIG[key]
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1
    const d = { x: dir.x / len, y: dir.y / len, z: dir.z / len }
    const throwSpeed = 18
    const id = randomUUID()
    this.projectiles.set(id, {
      id,
      ownerId: p.id,
      x: p.x,
      y: p.y + 1.4,
      z: p.z,
      vx: d.x * throwSpeed,
      vy: d.y * throwSpeed + 4,  // slight upward arc
      vz: d.z * throwSpeed,
      fuseMs: cfg.fuseMs ?? 3000,
      type,
    })
  }

  handleEnterVehicle(socketId: string) {
    const p = this.getPlayerBySocket(socketId)
    if (!p || this.phase !== 'playing' || !p.alive || p.downed) return
    if (p.inVehicleId) {
      // Exit vehicle
      const v = this.vehicles.get(p.inVehicleId)
      if (v) v.driverId = null
      p.inVehicleId = null
      return
    }
    // Find nearest vehicle
    let nearest: (VehicleState & { driverInput?: { fwd: number; str: number }; falling?: boolean }) | null = null
    let nearestDist = VEHICLE_ENTER_RANGE
    for (const v of this.vehicles.values()) {
      if (v.driverId) continue  // occupied
      if (v.falling) continue   // still dropping
      const d = Math.hypot(v.x - p.x, v.z - p.z)
      if (d < nearestDist) { nearestDist = d; nearest = v }
    }
    if (!nearest) return
    nearest.driverId = p.id
    p.inVehicleId = nearest.id
    this.io.to(this.channel).emit('fx:enterVehicle', { playerId: p.id, vehicleId: nearest.id })
  }

  handleVehicleInput(socketId: string, fwd: number, str: number) {
    const p = this.getPlayerBySocket(socketId)
    if (!p || !p.inVehicleId) return
    const v = this.vehicles.get(p.inVehicleId)
    if (!v) return
    v.driverInput = { fwd: Math.max(-1, Math.min(1, fwd)), str: Math.max(-1, Math.min(1, str)) }
  }

  private updateVehicles(dt: number) {
    for (const v of this.vehicles.values()) {
      // Falling phase (spawning from sky)
      if (v.falling) {
        v.y -= VEHICLE_FALL_SPD * dt
        const ground = this.terrainHeight(v.x, v.z) + 0.6
        if (v.y <= ground) {
          v.y = ground
          v.falling = false
          this.io.to(this.channel).emit('fx:vehicleLand', { vehicleId: v.id, x: v.x, y: v.y, z: v.z })
        }
        continue
      }

      const inp = v.driverInput
      if (inp) {
        // Acceleration / braking
        if (inp.fwd !== 0) {
          v.speed += inp.fwd * VEHICLE_ACCEL * dt
        } else {
          // Friction
          const friction = VEHICLE_BRAKE * dt
          if (Math.abs(v.speed) < friction) v.speed = 0
          else v.speed -= Math.sign(v.speed) * friction
        }
        v.speed = Math.max(-VEHICLE_SPEED_MAX * 0.5, Math.min(VEHICLE_SPEED_MAX, v.speed))
        // Steering (only when moving)
        if (Math.abs(v.speed) > 0.5) {
          v.yaw -= inp.str * VEHICLE_TURN_SPD * dt * Math.sign(v.speed)
        }
      } else {
        // No driver — coast to stop
        const friction = VEHICLE_BRAKE * 0.5 * dt
        if (Math.abs(v.speed) < friction) v.speed = 0
        else v.speed -= Math.sign(v.speed) * friction
      }

      // Move vehicle
      if (Math.abs(v.speed) > 0.01) {
        const nx = v.x + Math.sin(v.yaw) * v.speed * dt
        const nz = v.z + Math.cos(v.yaw) * v.speed * dt
        const c = this.clampToMap(nx, nz)
        v.x = c.x
        v.z = c.z
        v.y = this.terrainHeight(v.x, v.z) + 0.6
      }

      // Move driver with vehicle
      if (v.driverId) {
        const driver = this.players.get(v.driverId)
        if (driver) {
          driver.x = v.x
          driver.y = v.y + 0.8
          driver.z = v.z
          driver.yaw = v.yaw
          driver.vx = Math.sin(v.yaw) * v.speed
          driver.vz = Math.cos(v.yaw) * v.speed
        }
      }

      // Vehicle takes damage from zone
      const dx = v.x - this.zone.centerX
      const dz = v.z - this.zone.centerZ
      if (Math.sqrt(dx * dx + dz * dz) > this.zone.radius) {
        v.hp = Math.max(0, v.hp - ZONE_DAMAGE_PER_SEC * 2 * dt)
      }

      // Destroy vehicle if hp = 0
      if (v.hp <= 0) {
        if (v.driverId) {
          const driver = this.players.get(v.driverId)
          if (driver) {
            driver.inVehicleId = null
            this.damagePlayer(driver, null, 60, 'explosion')
          }
        }
        this.io.to(this.channel).emit('fx:explosion', { x: v.x, y: v.y, z: v.z, type: 'vehicle' })
        this.vehicles.delete(v.id)
      }
    }
  }

  private spawnVehicleIfNeeded(now: number) {
    if (now < this.nextVehicleSpawnAt) return
    if (this.vehicles.size >= VEHICLE_MAX_COUNT) return
    this.nextVehicleSpawnAt = now + VEHICLE_SPAWN_INTERVAL_MS

    const a = Math.random() * Math.PI * 2
    const r = 20 + Math.random() * (this.mapHalf * 0.7)
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const cx = this.clampToMap(x, z)
    const id = randomUUID()
    this.vehicles.set(id, {
      id,
      x: cx.x,
      y: VEHICLE_SPAWN_Y,
      z: cx.z,
      yaw: Math.random() * Math.PI * 2,
      speed: 0,
      hp: VEHICLE_HP,
      driverId: null,
      falling: true,
    })
    this.io.to(this.channel).emit('fx:vehicleSpawn', { x: cx.x, z: cx.z })
  }

  private snapshot(now: number): ServerGameSnapshot {
    const players: PlayerState[] = [...this.players.values()].map((p) => ({
      id: p.id,
      username: p.username,
      x: p.x,
      y: p.y,
      z: p.z,
      vx: p.vx,
      vy: p.vy,
      vz: p.vz,
      yaw: p.yaw,
      pitch: p.pitch,
      hp: p.hp,
      shield: p.shield,
      alive: p.alive,
      weaponIndex: p.weaponIndex,
      loadout: [...p.loadout],
      ammo: {
        pistol: p.mag.pistol ?? 0,
        ar: p.mag.ar ?? 0,
        sniper: p.mag.sniper ?? 0,
        rpg: p.mag.rpg ?? 0,
        shotgun: p.mag.shotgun ?? 0,
        smg: p.mag.smg ?? 0,
      },
      ammoReserve: {
        pistol: p.ammoReserve.pistol ?? 0,
        ar: p.ammoReserve.ar ?? 0,
        sniper: p.ammoReserve.sniper ?? 0,
        rpg: p.ammoReserve.rpg ?? 0,
        shotgun: p.ammoReserve.shotgun ?? 0,
        smg: p.ammoReserve.smg ?? 0,
      },
      kills: p.kills,
      damageDealt: p.damageDealt,
      isHost: p.isHost,
      ready: p.ready,
      skydiving: p.skydiving,
      spectatingId: p.spectatingId,
      teamId: p.teamId,
      downed: p.downed,
      reviveProgress: p.reviveProgress,
      armor: { ...p.armor },
      inVehicleId: p.inVehicleId,
      consumables: { ...p.consumables },
    }))
    const pickups = [...this.pickups.values()]
    const projectiles = [...this.projectiles.values()]
    const remaining = players.filter((p) => p.alive).length
    return {
      t: now,
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      players,
      pickups,
      projectiles,
      zone: { ...this.zone },
      killFeed: [...this.killFeed],
      remaining,
      matchStartedAt: this.matchStartedAt,
      damageNumbers: [...this.damageNumbers],
      hitFx: [...this.hitFx],
      vehicles: [...this.vehicles.values()].map((v) => ({
        id: v.id, x: v.x, y: v.y, z: v.z,
        yaw: v.yaw, speed: v.speed, hp: v.hp, driverId: v.driverId,
      })),
      teamMode: this.teamMode,
    }
  }

  roomPayload() {
    return {
      id: this.id,
      name: this.name,
      maxPlayers: this.maxPlayers,
      mapId: this.mapId,
      teamMode: this.teamMode,
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        username: p.username,
        isHost: p.isHost,
        ready: p.ready,
        teamId: p.teamId,
      })),
    }
  }

  broadcastLobby() {
    this.io.emit('lobby:rooms', globalRoomsList(this.io))
  }
}

function normalize(v: { x: number; y: number; z: number }) {
  const l = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}

/** Attached on io for lobby listing */
const ROOMS = new Map<string, GameRoom>()

export function createRoom(io: Server, name: string, maxPlayers?: number, mapId?: MapId, teamMode?: TeamMode) {
  const id = randomUUID()
  const room = new GameRoom(io, { id, name, maxPlayers, mapId, teamMode })
  ROOMS.set(id, room)
  room.broadcastLobby()
  return room
}

export function getRoom(id: string) {
  return ROOMS.get(id)
}

export function globalRoomsList(io: Server): RoomPublic[] {
  return [...ROOMS.values()].map((r) => r.publicInfo())
}

export function destroyRoomIfEmpty(room: GameRoom) {
  if (room.players.size === 0) {
    room.stopTick()
    ROOMS.delete(room.id)
    room.io.emit('lobby:rooms', globalRoomsList(room.io))
  }
}
