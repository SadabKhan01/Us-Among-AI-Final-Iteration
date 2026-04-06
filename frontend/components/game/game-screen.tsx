'use client'

import { useEffect } from 'react'
import { useGameStore } from '@/lib/game-store'
import { connectSocket, disconnectSocket } from '@/lib/socket'
import { GameRoom } from './game-room'
import { GameHUD } from './game-hud'
import { MiniTaskOverlay } from './mini-tasks'

export function GameScreen() {
  const addObservation = useGameStore((s) => s.addObservation)
  const activeTask = useGameStore((s) => s.activeTask)

  useEffect(() => {
    // Connect to backend when game starts
    connectSocket('Player')

    addObservation('Subject entered sandbox - initiating behavioral analysis', 'neutral')

    const timer = setTimeout(() => {
      addObservation('Movement tracking enabled - all actions monitored', 'neutral')
    }, 2000)

    return () => {
      clearTimeout(timer)
      disconnectSocket()
    }
  }, [addObservation])

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-background">
      {/* Background audio track playing on a loop */}
      <audio src="/background-track.mp3" autoPlay loop />
      
      {/* Full-screen game room with background */}
      <GameRoom />
      
      {/* HUD overlay on top */}
      <GameHUD />
      
      {/* Mini-task overlay */}
      {activeTask && <MiniTaskOverlay />}
      
      {/* Scan line effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-50 opacity-30">
        <div className="absolute w-full h-0.5 bg-neon-cyan/20 animate-scan-line" />
      </div>
      
      {/* Vignette effect */}
      <div 
        className="fixed inset-0 pointer-events-none z-40"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)'
        }}
      />
    </div>
  )
}
