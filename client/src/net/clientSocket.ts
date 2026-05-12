import { io, type Socket } from 'socket.io-client'

const URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3333'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
    })
  }
  return socket
}
