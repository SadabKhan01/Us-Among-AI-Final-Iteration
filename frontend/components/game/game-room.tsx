'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '@/lib/game-store'
import { cn } from '@/lib/utils'

interface InteractiveObject {
  id: string
  name: string
  // Position as percentage of room dimensions
  xPercent: number
  yPercent: number
  icon: string
  color: string
  description: string
  zIndex: number
  partiallyHidden?: boolean
}

// Positions as percentages based on the reference image layout
// Retro Terminal: BEHIND the top-left desk computer (partially obscured)
// Holographic Plinth (Tower of Hanoi): attached to the 3 colored pegs near upper-right
// Audio Plinth (Vinyl): attached to the vinyl player on the right side
const OBJECTS: InteractiveObject[] = [
  { 
    id: 'typewriter', 
    name: 'RETRO-TERMINAL', 
    xPercent: 9, 
    yPercent: 28, 
    icon: '⌨', 
    color: 'neon-cyan',
    description: 'Type backwards',
    zIndex: 5,
    partiallyHidden: true
  },
  { 
    id: 'hanoi', 
    name: 'HOLOGRAPHIC PLINTH', 
    xPercent: 65, 
    yPercent: 42, 
    icon: '◈', 
    color: 'neon-pink',
    description: 'Tower puzzle',
    zIndex: 15
  },
  { 
    id: 'vinyl', 
    name: 'AUDIO PLINTH', 
    xPercent: 92, 
    yPercent: 58, 
    icon: '◉', 
    color: 'neon-orange',
    description: 'Note sequence',
    zIndex: 15
  },
]

export function GameRoom() {
  const playerPosition = useGameStore((s) => s.playerPosition)
  const playerDirection = useGameStore((s) => s.playerDirection)
  const movePlayer = useGameStore((s) => s.movePlayer)
  const startTask = useGameStore((s) => s.startTask)
  const activeTask = useGameStore((s) => s.activeTask)
  const completedTaskIds = useGameStore((s) => s.completedTaskIds)
  const addObservation = useGameStore((s) => s.addObservation)
  const recordHesitation = useGameStore((s) => s.recordHesitation)
  const isTaskAccessible = useGameStore((s) => s.isTaskAccessible)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 })
  const keysPressed = useRef<Set<string>>(new Set())
  const hesitationTimeout = useRef<NodeJS.Timeout | null>(null)

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        })
      }
    }
    
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  const getObjectPosition = (obj: InteractiveObject) => ({
    x: (obj.xPercent / 100) * dimensions.width,
    y: (obj.yPercent / 100) * dimensions.height
  })

  const getNearbyObject = useCallback(() => {
    const INTERACTION_DISTANCE = Math.min(dimensions.width, dimensions.height) * 0.12
    const scaledPlayerX = (playerPosition.x / 800) * dimensions.width
    const scaledPlayerY = (playerPosition.y / 600) * dimensions.height
    
    return OBJECTS.find(obj => {
      const pos = getObjectPosition(obj)
      const dx = scaledPlayerX - pos.x
      const dy = scaledPlayerY - pos.y
      return Math.sqrt(dx * dx + dy * dy) < INTERACTION_DISTANCE
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerPosition, dimensions])

  const nearbyObject = getNearbyObject()

  useEffect(() => {
    if (hesitationTimeout.current) {
      clearTimeout(hesitationTimeout.current)
    }
    
    hesitationTimeout.current = setTimeout(() => {
      if (!activeTask) {
        recordHesitation()
        addObservation('Movement pause detected - analyzing intent', 'neutral')
      }
    }, 3000)
    
    return () => {
      if (hesitationTimeout.current) {
        clearTimeout(hesitationTimeout.current)
      }
    }
  }, [playerPosition, activeTask, recordHesitation, addObservation])

  useEffect(() => {
    if (activeTask) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysPressed.current.add(key)
      }
      
      if (key === 'e' && nearbyObject && !completedTaskIds.includes(nearbyObject.id)) {
        if (isTaskAccessible(nearbyObject.id)) {
          startTask(nearbyObject.id)
          addObservation(`Initiating ${nearbyObject.name} interface`, 'neutral')
        } else {
          // Find the name of the next required task
          const nextTaskId = useGameStore.getState().getNextTaskId();
          const nextTaskName = OBJECTS.find(o => o.id === nextTaskId)?.name || 'Unknown Task';
          addObservation(`ACCESS DENIED: You must complete ${nextTaskName} first`, 'suspicious')
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase())
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [activeTask, nearbyObject, completedTaskIds, startTask, addObservation])

  useEffect(() => {
    if (activeTask) return

    const gameLoop = setInterval(() => {
      const keys = keysPressed.current
      
      if (keys.has('w') || keys.has('arrowup')) movePlayer('up')
      if (keys.has('s') || keys.has('arrowdown')) movePlayer('down')
      if (keys.has('a') || keys.has('arrowleft')) movePlayer('left')
      if (keys.has('d') || keys.has('arrowright')) movePlayer('right')
    }, 16)

    return () => clearInterval(gameLoop)
  }, [activeTask, movePlayer])

  const getPlayerSprite = () => {
    switch (playerDirection) {
      case 'up': return '▲'
      case 'down': return '▼'
      case 'left': return '◀'
      case 'right': return '▶'
    }
  }

  // Scale player position to current dimensions
  const scaledPlayerX = (playerPosition.x / 800) * dimensions.width
  const scaledPlayerY = (playerPosition.y / 600) * dimensions.height

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundImage: `url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/unnamed.png-2Am0XQV2nWePyt8e2QadUnXixlhdCa.jpeg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Subtle overlay for better contrast */}
      <div className="absolute inset-0 bg-background/10 pointer-events-none" />
      
      {/* Interactive objects - positioned proportionally with proper z-indexing */}
      {OBJECTS.map((obj) => {
        const isCompleted = completedTaskIds.includes(obj.id)
        const isNearby = nearbyObject?.id === obj.id
        const pos = getObjectPosition(obj)
        
        return (
          <div
            key={obj.id}
            onClick={() => {
              if (activeTask || isCompleted) return;
              if (isTaskAccessible(obj.id)) {
                startTask(obj.id)
                addObservation(`Initiating ${obj.name} interface via direct access`, 'neutral')
              } else {
                const nextTaskId = useGameStore.getState().getNextTaskId();
                const nextTaskName = OBJECTS.find(o => o.id === nextTaskId)?.name || 'Unknown Task';
                addObservation(`ACCESS DENIED: You must complete ${nextTaskName} first`, 'suspicious')
              }
            }}
            className={cn(
              'absolute flex flex-col items-center justify-center transition-all duration-300 -translate-x-1/2 -translate-y-1/2',
              !isCompleted && isTaskAccessible(obj.id) ? 'cursor-pointer' : '',
              isCompleted 
                ? 'opacity-40' 
                : isNearby 
                  ? 'scale-110' 
                  : 'hover:scale-105',
              obj.partiallyHidden && 'opacity-70'
            )}
            style={{
              left: pos.x,
              top: pos.y,
              zIndex: obj.zIndex,
            }}
          >
            {/* Glow effect - smaller for partially hidden objects */}
            {!isCompleted && (
              <div 
                className={cn(
                  'absolute rounded-full transition-opacity duration-300',
                  isNearby ? 'opacity-100' : 'opacity-60',
                  obj.partiallyHidden ? 'w-16 h-16' : 'w-20 h-20'
                )}
                style={{
                  boxShadow: `0 0 ${isNearby ? '30px' : '15px'} var(--${obj.color}), 0 0 ${isNearby ? '60px' : '30px'} var(--${obj.color})`,
                  background: `radial-gradient(circle, var(--${obj.color})30 0%, transparent 70%)`
                }}
              />
            )}
            
            {/* Icon - no background box, just the glowing icon */}
            <div className={cn(
              'relative flex items-center justify-center transition-all',
              obj.partiallyHidden ? 'w-10 h-10' : 'w-14 h-14'
            )}
            style={{ 
              zIndex: obj.zIndex + 1,
            }}>
              <span 
                className={cn(
                  isCompleted ? 'text-muted-foreground' : `text-${obj.color}`,
                  obj.partiallyHidden ? 'text-3xl' : 'text-4xl',
                  !isCompleted && 'drop-shadow-lg'
                )}
                style={!isCompleted ? { 
                  filter: `drop-shadow(0 0 8px var(--${obj.color})) drop-shadow(0 0 16px var(--${obj.color}))`,
                  textShadow: `0 0 10px var(--${obj.color}), 0 0 20px var(--${obj.color})`
                } : {}}
              >
                {isCompleted ? '✓' : obj.icon}
              </span>
            </div>
            
            {/* Label - minimal with just text and subtle glow */}
            <span 
              className={cn(
                'relative font-mono mt-1 whitespace-nowrap font-bold tracking-wide',
                isCompleted ? 'text-muted-foreground' : `text-${obj.color}`,
                obj.partiallyHidden ? 'text-[8px]' : 'text-[10px]'
              )}
              style={{ 
                zIndex: obj.zIndex + 1,
                ...(!isCompleted ? {
                  textShadow: `0 0 8px var(--${obj.color}), 0 1px 2px rgba(0,0,0,0.8)`
                } : {})
              }}
            >
              {obj.name}
            </span>
            
            {/* Interaction prompt */}
            {isNearby && !isCompleted && (
              <div className={cn(
                'absolute -bottom-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-card/95 backdrop-blur-sm rounded-lg text-xs font-mono whitespace-nowrap animate-pulse border shadow-xl',
                `text-${obj.color} border-${obj.color}/50`
              )}
              style={{ 
                boxShadow: `0 0 25px var(--${obj.color})40`,
                zIndex: 50
              }}>
                {isTaskAccessible(obj.id) ? (
                  <>
                    <span className="mr-1.5 font-bold">[E]</span>
                    {obj.description}
                  </>
                ) : (
                  <>
                    <span className="mr-1.5 font-bold text-red-500">[LOCKED]</span>
                    <span className="text-muted-foreground">OUT OF SEQUENCE</span>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Desk computer overlay - renders on top of the retro terminal to create depth */}
      <div 
        className="absolute pointer-events-none"
        style={{
          left: `${6}%`,
          top: `${18}%`,
          width: `${10}%`,
          height: `${20}%`,
          zIndex: 10,
        }}
      />
      
      {/* Player avatar */}
      <div
        className="absolute flex items-center justify-center transition-all duration-75 -translate-x-1/2 -translate-y-1/2"
        style={{
          left: scaledPlayerX,
          top: scaledPlayerY,
          zIndex: 20,
        }}
      >
        {/* Player glow */}
        <div className="absolute w-12 h-12 bg-neon-cyan/40 rounded-full blur-md animate-pulse" />
        
        {/* Player body */}
        <div className="relative w-11 h-11 bg-card/95 border-2 border-neon-cyan rounded-full flex items-center justify-center"
          style={{ boxShadow: '0 0 15px var(--neon-cyan), 0 0 30px var(--neon-cyan)' }}
        >
          <span className="text-neon-cyan text-xl font-bold">{getPlayerSprite()}</span>
        </div>
        
        {/* ID tag */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-card/95 rounded-md text-[9px] font-mono text-neon-cyan border border-neon-cyan/40 whitespace-nowrap shadow-lg">
          AGENT_404
        </div>
      </div>
      
      {/* Bottom status bar - integrated into the scene */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background/60 to-transparent pointer-events-none" />
      <div className="absolute bottom-2 left-4 px-3 py-1 bg-card/90 backdrop-blur-sm border border-neon-cyan/30 rounded-md font-mono text-[10px] text-neon-cyan shadow-lg z-30">
        AGENT_ID: 404
      </div>
      <div className="absolute bottom-2 right-4 px-3 py-1 bg-card/90 backdrop-blur-sm border border-neon-pink/30 rounded-md font-mono text-[10px] text-neon-pink shadow-lg z-30">
        DATA AUDIT IN PROGRESS
      </div>
      
      {/* Corner frame decorations */}
      <div className="absolute top-3 left-3 w-10 h-10 border-l-2 border-t-2 border-neon-cyan/40 rounded-tl-lg pointer-events-none" />
      <div className="absolute top-3 right-3 w-10 h-10 border-r-2 border-t-2 border-neon-cyan/40 rounded-tr-lg pointer-events-none" />
      <div className="absolute bottom-14 left-3 w-10 h-10 border-l-2 border-b-2 border-neon-cyan/40 rounded-bl-lg pointer-events-none" />
      <div className="absolute bottom-14 right-3 w-10 h-10 border-r-2 border-b-2 border-neon-cyan/40 rounded-br-lg pointer-events-none" />
    </div>
  )
}
