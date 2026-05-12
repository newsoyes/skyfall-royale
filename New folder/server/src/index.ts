import http from 'http'
import express from 'express'
import cors from 'cors'
import { Server, type Socket } from 'socket.io'
import { connectDb } from './db.js'
import {
  GameRoom,
  createRoom,
  destroyRoomIfEmpty,
  getRoom,
  globalRoomsList,
} from './GameRoom.js'

const PORT = Number(process.env.PORT) || 3333
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

await connectDb()

const app = express()
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, t: Date.now() })
})

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
})

app.get('/api/rooms', (_req, res) => {
  res.json(globalRoomsList(io))
})

app.get('/api/leaderboard', async (_req, res) => {
  try {
    const { PlayerModel } = await import('./db.js')
    const rows = await (PlayerModel as import('mongoose').Model<import('./db.js').PlayerDoc>)
      .find({})
      .sort({ wins: -1, damage: -1 })
      .limit(50)
      .lean()
    res.json(rows.map((r) => ({
      username: r.username,
      wins: r.wins ?? 0,
      matches: r.matches ?? 0,
      damage: r.damage ?? 0,
    })))
  } catch {
    res.json([])
  }
})

/** Tracks which game room a socket belongs to for message routing. */
const socketRoomMeta = new Map<string, { roomId: string; channel: string }>()

let online = 0

function bindSocketToRoom(socket: Socket, room: GameRoom) {
  socketRoomMeta.set(socket.id, { roomId: room.id, channel: room.channel })
}

function leaveRoom(socket: Socket) {
  const meta = socketRoomMeta.get(socket.id)
  if (!meta) return
  socketRoomMeta.delete(socket.id)
  socket.leave(meta.channel)
  const room = getRoom(meta.roomId)
  if (room) {
    room.removePlayer(socket.id)
    destroyRoomIfEmpty(room)
    io.to(room.channel).emit('room:update', room.roomPayload())
  }
}

function currentRoom(socket: Socket): GameRoom | undefined {
  const meta = socketRoomMeta.get(socket.id)
  if (!meta) return undefined
  return getRoom(meta.roomId)
}

io.on('connection', (socket) => {
  online++
  io.emit('lobby:online', online)
  socket.data.username = `Guest-${socket.id.slice(0, 6)}`

  socket.emit('lobby:rooms', globalRoomsList(io))

  socket.on('auth:guest', (payload: { username?: string }, cb) => {
    const name = (payload?.username || socket.data.username).trim().slice(0, 24)
    if (name.length < 2) {
      cb?.({ ok: false, error: 'Username must be at least 2 characters.' })
      return
    }
    socket.data.username = name
    cb?.({ ok: true, username: name })
  })

  socket.on('lobby:listRooms', (_p, cb) => {
    cb?.(globalRoomsList(io))
  })

  socket.on('room:create', (payload: { name?: string; maxPlayers?: number; mapId?: string; teamMode?: string }, cb) => {
    leaveRoom(socket)
    const room = createRoom(
      io,
      (payload?.name || `${socket.data.username}'s Room`).slice(0, 40),
      payload?.maxPlayers,
      (payload?.mapId as import('./maps/mapRegistry.js').MapId) ?? 'island',
      (payload?.teamMode as import('./types.js').TeamMode) ?? 'solo',
    )
    const p = room.addPlayer(socket, socket.data.username)
    if (!p) {
      cb?.({ ok: false, error: 'Room full' })
      return
    }
    bindSocketToRoom(socket, room)
    io.to(room.channel).emit('room:update', room.roomPayload())
    cb?.({ ok: true, room: room.roomPayload(), playerId: p.id })
  })

  socket.on('room:join', (payload: { roomId: string }, cb) => {
    const room = getRoom(payload.roomId)
    if (!room) {
      cb?.({ ok: false, error: 'ไม่พบห้อง' })
      return
    }

    // Check if this is a reconnect during active match
    if (room.phase === 'playing') {
      // Find player by username
      const existingPlayerId = [...room.players.entries()]
        .find(([, p]) => p.username === socket.data.username && p.disconnectedAt !== null)?.[0]
      if (existingPlayerId && room.reconnectPlayer(socket, existingPlayerId)) {
        cb?.({ ok: true, room: room.roomPayload(), playerId: existingPlayerId })
        socket.emit('match:reconnect', { playerId: existingPlayerId })
        return
      }
    }

    leaveRoom(socket)
    const p = room.addPlayer(socket, socket.data.username)
    if (!p) {
      cb?.({ ok: false, error: 'ห้องเต็ม' })
      return
    }
    bindSocketToRoom(socket, room)
    io.to(room.channel).emit('room:update', room.roomPayload())
    cb?.({ ok: true, room: room.roomPayload(), playerId: p.id })
  })

  socket.on('room:leave', () => {
    leaveRoom(socket)
  })

  socket.on('room:ready', (payload: { ready: boolean }) => {
    currentRoom(socket)?.setReady(socket.id, !!payload?.ready)
  })

  socket.on('room:start', () => {
    currentRoom(socket)?.tryStartMatch(socket.id)
  })

  socket.on('game:input', (payload: InputPayload) => {
    currentRoom(socket)?.handleInput(socket.id, payload)
  })

  socket.on('game:weaponIndex', (idx: number) => {
    currentRoom(socket)?.handleWeaponIndex(socket.id, idx)
  })

  socket.on('game:reload', () => {
    currentRoom(socket)?.handleReload(socket.id)
  })

  socket.on('game:fire', (payload: { origin: Vec3; dir: Vec3 }) => {
    if (!payload?.origin || !payload?.dir) return
    currentRoom(socket)?.handleFire(socket.id, payload.origin, payload.dir)
  })

  socket.on('game:emote', () => {
    currentRoom(socket)?.handleEmote(socket.id)
  })

  socket.on('disconnect', () => {
    online = Math.max(0, online - 1)
    io.emit('lobby:online', online)
    leaveRoom(socket)
  })
})

type Vec3 = { x: number; y: number; z: number }
type InputPayload = {
  fwd: number
  str: number
  jump: boolean
  sprint: boolean
  yaw: number
  pitch: number
  seq: number
}

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
  console.log(`[server] CORS origin: ${CLIENT_ORIGIN}`)
})
