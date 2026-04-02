'use client'

import socketClient from 'socket.io-client'
const io = socketClient

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let socket: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSocket(): any {
  if (typeof window === 'undefined') return null
  if (!socket) {
    socket = io(BACKEND_URL, { autoConnect: false })
  }
  return socket
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function connectSocket(playerName: string): any {
  const s = getSocket()
  if (!s) return null
  if (!s.connected) {
    s.connect()
    s.once('connect', () => {
      s.emit('join', { name: playerName })
      console.log('[socket] connected and joined as', playerName)
    })
  }
  return s
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect()
  }
}
