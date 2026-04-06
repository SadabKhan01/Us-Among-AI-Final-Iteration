'use client'

import { useState, useEffect } from 'react'
import { useGameStore } from '@/lib/game-store'
import { Button } from '@/components/ui/button'

export function LandingScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const resetGame = useGameStore((s) => s.resetGame)
  const [showContent, setShowContent] = useState(false)
  const [typedText, setTypedText] = useState('')
  const fullText = 'INITIALIZING SANDBOX ENVIRONMENT...'

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!showContent) return
    let i = 0
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i))
        i++
      } else {
        clearInterval(interval)
      }
    }, 50)
    return () => clearInterval(interval)
  }, [showContent])

  const handleStart = () => {
    resetGame()
    setScreen('game')
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-background">
      {/* Animated background grid */}
      <div className="absolute inset-0 cyber-grid opacity-30" />
      
      {/* Scan line effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-full h-1 bg-neon-cyan/20 animate-scan-line" />
      </div>
      
      {/* Ambient glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-cyan/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-pink/10 rounded-full blur-3xl" />
      
      {/* Main content */}
      <div className={`relative z-10 flex flex-col items-center gap-8 px-4 transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        {/* System status */}
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
          <span>{typedText}<span className="animate-typing-cursor">_</span></span>
        </div>
        
        {/* Title */}
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-foreground text-glow-cyan animate-flicker">
            PRETEND TO BE AI
          </h1>
          <div className="h-px w-64 bg-gradient-to-r from-transparent via-neon-cyan to-transparent" />
        </div>
        
        {/* Tagline */}
        <p className="text-lg md:text-xl text-muted-foreground font-mono text-center max-w-md">
          Enter the sandbox. Convince the system you are machine.
        </p>
        
        {/* Task preview */}
        <div className="flex flex-col gap-3 mt-4 text-xs font-mono">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-neon-cyan" />
            <span className="text-neon-cyan">TYPEWRITER</span>
            <span className="text-muted-foreground/60">Type backwards - no corrections allowed</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-neon-pink" />
            <span className="text-neon-pink">TOWER OF HANOI</span>
            <span className="text-muted-foreground/60">Move disks - maintain perfect rhythm</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-neon-orange" />
            <span className="text-neon-orange">VINYL PLAYER</span>
            <span className="text-muted-foreground/60">Hear notes - respond instantly</span>
          </div>
        </div>
        
        {/* Start button */}
        <Button
          onClick={handleStart}
          size="lg"
          className="mt-8 px-12 py-6 text-lg font-mono bg-transparent border-2 border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-background transition-all duration-300 glow-cyan"
        >
          START SIMULATION
        </Button>
        
        {/* Instructions hint */}
        <div className="mt-8 flex flex-col items-center gap-2 text-xs font-mono text-muted-foreground/60">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-secondary rounded text-foreground">W</kbd>
              <kbd className="px-2 py-1 bg-secondary rounded text-foreground">A</kbd>
              <kbd className="px-2 py-1 bg-secondary rounded text-foreground">S</kbd>
              <kbd className="px-2 py-1 bg-secondary rounded text-foreground">D</kbd>
              <span className="ml-2">MOVE</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-secondary rounded text-foreground">E</kbd>
              <span className="ml-2">INTERACT</span>
            </span>
          </div>
        </div>
      </div>
      
      {/* Bottom system info */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs font-mono text-muted-foreground/40">
        <span>SANDBOX v2.4.1</span>
        <span>OBSERVATION PROTOCOL: ACTIVE</span>
        <span>SESSION: {new Date().toISOString().split('T')[0]}</span>
      </div>
    </div>
  )
}
