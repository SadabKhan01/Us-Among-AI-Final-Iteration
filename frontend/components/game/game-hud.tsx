'use client'

import { useGameStore } from '@/lib/game-store'
import { cn } from '@/lib/utils'

export function GameHUD() {
  const suspicionLevel = useGameStore((s) => s.suspicionLevel)
  const tasksCompleted = useGameStore((s) => s.tasksCompleted)
  const totalTasks = useGameStore((s) => s.totalTasks)
  const observations = useGameStore((s) => s.observations)

  const getSuspicionColor = () => {
    if (suspicionLevel < 35) return 'text-neon-green'
    if (suspicionLevel < 65) return 'text-neon-orange'
    return 'text-destructive'
  }

  const getSuspicionLabel = () => {
    if (suspicionLevel < 35) return 'AI-LIKE'
    if (suspicionLevel < 65) return 'UNCERTAIN'
    return 'HUMAN-LIKE'
  }

  return (
    <>
      {/* Top HUD Bar - fixed position overlay */}
      <div className="fixed top-0 left-0 right-0 p-4 flex justify-between items-start z-30 pointer-events-none">
        {/* Left: Suspicion Meter */}
        <div className="bg-card/90 backdrop-blur-md border border-border rounded-lg p-3 min-w-56 pointer-events-auto shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-muted-foreground tracking-wider">SUSPICION LEVEL</span>
            <span className={cn('text-xs font-mono font-bold', getSuspicionColor())}>
              {getSuspicionLabel()}
            </span>
          </div>
          <div className="relative h-2.5 bg-secondary rounded-full overflow-hidden">
            <div 
              className={cn(
                'h-full transition-all duration-500 rounded-full',
                suspicionLevel < 35 ? 'bg-neon-green' :
                suspicionLevel < 65 ? 'bg-neon-orange' : 'bg-destructive'
              )}
              style={{ width: `${suspicionLevel}%` }}
            />
            {/* Tick marks */}
            <div className="absolute inset-0 flex justify-between px-0.5 items-center pointer-events-none">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="w-px h-1 bg-background/40" />
              ))}
            </div>
          </div>
          <div className="flex justify-between mt-1.5 text-[9px] font-mono text-muted-foreground">
            <span>MACHINE</span>
            <span className="font-bold text-foreground">{suspicionLevel}%</span>
            <span>HUMAN</span>
          </div>
        </div>

        {/* Right: Task Progress */}
        <div className="bg-card/90 backdrop-blur-md border border-border rounded-lg p-3 min-w-44 pointer-events-auto shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-muted-foreground tracking-wider">TASKS</span>
            <span className="text-sm font-mono text-neon-cyan font-bold">
              {tasksCompleted}/{totalTasks}
            </span>
          </div>
          <div className="flex gap-1.5">
            {[...Array(totalTasks)].map((_, i) => (
              <div 
                key={i}
                className={cn(
                  'flex-1 h-2.5 rounded-sm transition-all duration-300',
                  i < tasksCompleted ? 'bg-neon-cyan' : 'bg-secondary'
                )}
                style={i < tasksCompleted ? { boxShadow: '0 0 8px var(--neon-cyan)' } : {}}
              />
            ))}
          </div>
          <p className="mt-2 text-[9px] font-mono text-muted-foreground text-center">
            {tasksCompleted < totalTasks 
              ? 'COMPLETE TASKS TO END' 
              : 'EVALUATING...'}
          </p>
        </div>
      </div>

      {/* Bottom: AI Observation Log - compact */}
      <div className="fixed bottom-16 left-4 z-30 pointer-events-none">
        <div className="bg-card/90 backdrop-blur-md border border-border rounded-lg p-3 w-80 pointer-events-auto shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-pink animate-pulse" />
            <span className="text-[9px] font-mono text-muted-foreground tracking-wider">AI OBSERVATION LOG</span>
          </div>
          <div className="space-y-1 max-h-20 overflow-hidden">
            {observations.length === 0 ? (
              <p className="text-[10px] font-mono text-muted-foreground/60 italic">
                Awaiting behavioral data...
              </p>
            ) : (
              observations.slice(0, 3).map((obs, i) => (
                <div 
                  key={obs.id}
                  className={cn(
                    'text-[10px] font-mono flex items-start gap-2 transition-all duration-300',
                    i === 0 ? 'opacity-100' : 'opacity-40'
                  )}
                >
                  <span className={cn(
                    'mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0',
                    obs.type === 'ai-like' ? 'bg-neon-green' :
                    obs.type === 'suspicious' ? 'bg-destructive' : 'bg-neon-cyan'
                  )} />
                  <span className={cn(
                    obs.type === 'ai-like' ? 'text-neon-green' :
                    obs.type === 'suspicious' ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    {obs.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Controls hint - bottom right */}
      <div className="fixed bottom-16 right-4 z-30 pointer-events-none">
        <div className="bg-card/80 backdrop-blur-md border border-border rounded-lg px-3 py-2 shadow-xl">
          <p className="text-[9px] font-mono text-muted-foreground">
            <span className="text-neon-cyan">WASD</span> Move &nbsp;|&nbsp; <span className="text-neon-pink">[E]</span> Interact
          </p>
        </div>
      </div>
    </>
  )
}
