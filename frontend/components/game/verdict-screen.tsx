'use client'

import { useState, useEffect } from 'react'
import { useGameStore } from '@/lib/game-store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function VerdictScreen() {
  const resetGame = useGameStore((s) => s.resetGame)
  const calculateFinalVerdict = useGameStore((s) => s.calculateFinalVerdict)
  const taskResults = useGameStore((s) => s.taskResults)
  const metrics = useGameStore((s) => s.metrics)
  
  const suspicionLevel = useGameStore((s) => s.suspicionLevel)
  const taskScores = useGameStore((s) => s.taskScores)

  const [phase, setPhase] = useState<'analyzing' | 'reveal'>('analyzing')
  const [verdict, setVerdict] = useState<{ isAI: boolean; score: number; analysis: string[] } | null>(null)
  const [revealedLines, setRevealedLines] = useState(0)

  useEffect(() => {
    // Simulate analysis phase
    const timer = setTimeout(() => {
      const localResult = calculateFinalVerdict()
      // Override score with averaged backend suspicion if available
      const backendScore = taskScores.length > 0 ? suspicionLevel : null
      const finalScore = backendScore !== null
        ? Math.round(100 - backendScore) // convert suspicion→AI similarity
        : localResult.score
      setVerdict({ ...localResult, score: finalScore, isAI: finalScore >= 50 })
      setPhase('reveal')
    }, 3000)
    
    return () => clearTimeout(timer)
  }, [calculateFinalVerdict])

  useEffect(() => {
    if (phase === 'reveal' && verdict) {
      // Reveal analysis lines one by one
      const totalLines = verdict.analysis.length + 3 // +3 for verdict, score, and button
      const interval = setInterval(() => {
        setRevealedLines((prev) => {
          if (prev >= totalLines) {
            clearInterval(interval)
            return prev
          }
          return prev + 1
        })
      }, 500)
      
      return () => clearInterval(interval)
    }
  }, [phase, verdict])

  const handleReplay = () => {
    resetGame()
  }

  if (phase === 'analyzing') {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-background">
        {/* Animated background */}
        <div className="absolute inset-0 cyber-grid opacity-20" />
        
        {/* Scanning effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-full h-2 bg-neon-pink/30 animate-scan-line" />
        </div>
        
        {/* Analysis animation */}
        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="w-32 h-32 relative">
            {/* Rotating rings */}
            <div className="absolute inset-0 border-4 border-neon-cyan/30 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-4 border-4 border-neon-pink/30 rounded-full animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
            <div className="absolute inset-8 border-4 border-neon-green/30 rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
            
            {/* Center eye */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-neon-cyan rounded-full animate-pulse-glow" />
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-mono text-foreground animate-flicker">
              ANALYZING BEHAVIORAL DATA
            </h2>
            <div className="flex items-center justify-center gap-1">
              {[...Array(3)].map((_, i) => (
                <span 
                  key={i} 
                  className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
          
          {/* Processing stats */}
          <div className="grid grid-cols-2 gap-4 text-xs font-mono text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 bg-neon-green rounded-full animate-pulse" />
              <span>TASKS ANALYZED: {taskResults.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 bg-neon-pink rounded-full animate-pulse" />
              <span>KEYSTROKES: {metrics.keyPressTimings.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 bg-neon-cyan rounded-full animate-pulse" />
              <span>CORRECTIONS: {metrics.corrections}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 bg-neon-orange rounded-full animate-pulse" />
              <span>HESITATIONS: {metrics.hesitations}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!verdict) return null

  const isAI = verdict.isAI

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-background">
      {/* Background effects */}
      <div className="absolute inset-0 cyber-grid opacity-20" />
      <div className={cn(
        'absolute inset-0 opacity-20',
        isAI ? 'bg-gradient-radial from-neon-green/20 via-transparent to-transparent' 
             : 'bg-gradient-radial from-destructive/20 via-transparent to-transparent'
      )} />
      
      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8 p-8 max-w-2xl mx-auto">
        {/* Verdict banner */}
        <div className={cn(
          'transition-all duration-1000',
          revealedLines >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
        )}>
          <div className={cn(
            'text-6xl md:text-8xl font-bold tracking-tighter text-center',
            isAI ? 'text-neon-green text-glow-cyan' : 'text-destructive'
          )}>
            {isAI ? 'ACCEPTED' : 'FLAGGED'}
          </div>
          <div className={cn(
            'text-2xl md:text-3xl font-mono text-center mt-2',
            isAI ? 'text-neon-green/80' : 'text-destructive/80'
          )}>
            {isAI ? 'AS ARTIFICIAL INTELLIGENCE' : 'AS HUMAN'}
          </div>
        </div>
        
        {/* Score display */}
        <div className={cn(
          'transition-all duration-1000 delay-500',
          revealedLines >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
        )}>
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">AI SIMILARITY SCORE</span>
            <div className={cn(
              'text-5xl font-mono font-bold',
              isAI ? 'text-neon-green' : 'text-destructive'
            )}>
              {verdict.score}%
            </div>
            <div className="w-64 h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className={cn(
                  'h-full transition-all duration-1000 delay-700',
                  isAI ? 'bg-neon-green' : 'bg-destructive'
                )}
                style={{ width: `${verdict.score}%` }}
              />
            </div>
          </div>
        </div>
        
        {/* Analysis breakdown */}
        <div className={cn(
          'w-full bg-card/80 border border-border rounded-lg p-6 transition-all duration-1000',
          revealedLines >= 3 ? 'opacity-100' : 'opacity-0'
        )}>
          <h3 className="text-sm font-mono text-muted-foreground mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-neon-pink rounded-full animate-pulse" />
            BEHAVIORAL ANALYSIS REPORT
          </h3>
          <div className="space-y-3">
            {verdict.analysis.map((line, i) => (
              <div 
                key={i}
                className={cn(
                  'flex items-start gap-3 text-sm font-mono transition-all duration-500',
                  revealedLines >= 4 + i ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                )}
              >
                <span className={cn(
                  'mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0',
                  line.includes('human') || line.includes('Excessive') || line.includes('Suboptimal') || line.includes('Erratic') || line.includes('hesitation')
                    ? 'bg-destructive' 
                    : 'bg-neon-green'
                )} />
                <span className="text-muted-foreground">{line}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Task summary */}
        <div className={cn(
          'w-full grid grid-cols-3 gap-4 transition-all duration-1000',
          revealedLines >= verdict.analysis.length + 4 ? 'opacity-100' : 'opacity-0'
        )}>
          {taskResults.map((task, i) => (
            <div key={i} className={cn(
              'bg-card/50 border rounded-lg p-3 text-center',
              task.failed ? 'border-destructive/50' : 'border-border'
            )}>
              <p className="text-[10px] font-mono text-muted-foreground mb-1">{task.taskName}</p>
              {task.failed ? (
                <>
                  <p className="text-lg font-mono font-bold text-destructive">FAILED</p>
                  <p className="text-[9px] font-mono text-destructive/70 truncate">
                    {task.failReason}
                  </p>
                </>
              ) : (
                <>
                  <p className={cn(
                    'text-lg font-mono font-bold',
                    task.accuracy >= 80 ? 'text-neon-green' : 
                    task.accuracy >= 50 ? 'text-neon-orange' : 'text-destructive'
                  )}>
                    {task.accuracy}%
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {(task.completionTime / 1000).toFixed(1)}s
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
        
        {/* Action buttons */}
        <div className={cn(
          'flex gap-4 mt-4 transition-all duration-1000',
          revealedLines >= verdict.analysis.length + 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        )}>
          <Button
            onClick={handleReplay}
            size="lg"
            className="px-8 font-mono bg-transparent border-2 border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-background transition-all"
          >
            TRY AGAIN
          </Button>
        </div>
        
        {/* Bottom message */}
        <p className={cn(
          'text-xs font-mono text-muted-foreground/60 text-center transition-all duration-1000',
          revealedLines >= verdict.analysis.length + 5 ? 'opacity-100' : 'opacity-0'
        )}>
          {isAI 
            ? 'You have successfully passed the AI verification protocol.'
            : 'Human characteristics detected. Access denied.'}
        </p>
      </div>
    </div>
  )
}
