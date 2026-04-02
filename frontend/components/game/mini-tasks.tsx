'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '@/lib/game-store'
import { getSocket } from '@/lib/socket'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Typewriter Task: Backend provides a word; player types it backwards
// TRAP: No backspace, must start within 2 seconds
// ---------------------------------------------------------------------------
function TypewriterTask({ onComplete, onFail }: {
  onComplete: (accuracy: number, time: number, answer: string, targetString: string) => void
  onFail: (reason: string) => void
}) {
  const [targetString, setTargetString] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [modalAppearTime] = useState(Date.now())
  const [firstKeystroke, setFirstKeystroke] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const [failReason, setFailReason] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Request a word from the backend
  useEffect(() => {
    const socket = getSocket()
    socket.emit('request-task:typewriter')
    const onStart = (data: { text: string }) => {
      setTargetString(data.text.toUpperCase())
    }
    socket.on('task-start:typewriter', onStart)
    return () => {
      socket.off('task-start:typewriter', onStart)
    }
  }, [])

  const expectedOutput = targetString ? targetString.split('').reverse().join('') : ''

  // Start delay trap - must start within 2 seconds
  useEffect(() => {
    if (!targetString) return
    const timer = setTimeout(() => {
      if (!firstKeystroke && !failed) {
        setFailed(true)
        setFailReason('PROCESSING LATENCY EXCEEDED - Bots respond instantly')
        setTimeout(() => onFail('Processing latency exceeded'), 1500)
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [targetString, firstKeystroke, failed, onFail])

  useEffect(() => {
    if (targetString) inputRef.current?.focus()
  }, [targetString])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      setFailed(true)
      setFailReason('CORRECTION DETECTED - Bots never make mistakes')
      setTimeout(() => onFail('Backspace detected'), 1500)
      return
    }

    if (!firstKeystroke && e.key.length === 1) {
      setFirstKeystroke(Date.now())
    }

    // Send keystroke to backend
    getSocket().emit('task-keystroke', { key: e.key, timestamp: Date.now() })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (failed || !targetString) return
    const newValue = e.target.value.toUpperCase()
    setInput(newValue)

    if (newValue.length === expectedOutput.length) {
      const time = Date.now() - modalAppearTime
      const accuracy = newValue === expectedOutput ? 100 : 0
      setTimeout(() => onComplete(accuracy, time, newValue, targetString), 300)
    }
  }

  if (!targetString) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-xs font-mono text-muted-foreground animate-pulse">LOADING TASK...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-xs font-mono text-muted-foreground mb-2">TASK: REVERSE STRING</p>
        <p className="text-sm text-muted-foreground">Type this word <span className="text-neon-cyan">backwards</span>:</p>
      </div>

      <div className="bg-secondary/50 rounded-lg p-4 text-center border border-neon-cyan/30">
        <span className="text-3xl font-mono text-neon-cyan tracking-[0.3em]">{targetString}</span>
      </div>

      {failed ? (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-center">
          <p className="text-red-400 font-mono text-sm">{failReason}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-xs font-mono text-muted-foreground">OUTPUT:</label>
            <Input
              ref={inputRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Type reversed string..."
              className="font-mono text-center text-xl bg-background border-border focus:border-neon-cyan tracking-widest"
              maxLength={expectedOutput.length}
              autoComplete="off"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/60">
            <span>NO BACKSPACE ALLOWED</span>
            <span>{input.length}/{expectedOutput.length}</span>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sorting Task: Backend provides unsorted numbers; player clicks to build sorted order
// ---------------------------------------------------------------------------
function SortingTask({ onComplete, onFail }: {
  onComplete: (accuracy: number, time: number, answer: string) => void
  onFail: (reason: string) => void
}) {
  const [numbers, setNumbers] = useState<number[] | null>(null)
  const [selected, setSelected] = useState<number[]>([]) // indices into numbers[]
  const [startTime] = useState(Date.now())
  const [done, setDone] = useState(false)

  // Request numbers from backend
  useEffect(() => {
    const socket = getSocket()
    socket.emit('request-task:sorting')
    const onStart = (data: { numbers: number[] }) => {
      setNumbers(data.numbers)
    }
    socket.on('task-start:sorting', onStart)
    return () => { socket.off('task-start:sorting', onStart) }
  }, [])

  const handleSelect = (idx: number) => {
    if (done || !numbers) return
    // Deselect if already picked
    if (selected.includes(idx)) {
      setSelected(prev => prev.filter(i => i !== idx))
      return
    }
    getSocket().emit('task-keystroke', { key: String(numbers[idx]), timestamp: Date.now() })
    const next = [...selected, idx]
    setSelected(next)

    // Auto-submit once all 5 picked
    if (next.length === numbers.length) {
      setDone(true)
      const answer = next.map(i => numbers[i]).join(' ')
      const time = Date.now() - startTime
      const sorted = [...numbers].sort((a, b) => a - b)
      const isCorrect = next.map(i => numbers[i]).every((v, i) => v === sorted[i])
      setTimeout(() => onComplete(isCorrect ? 100 : 0, time, answer), 300)
    }
  }

  if (!numbers) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-xs font-mono text-muted-foreground animate-pulse">LOADING TASK...</span>
      </div>
    )
  }

  const sortedAnswer = selected.map(i => numbers[i])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-xs font-mono text-muted-foreground mb-2">TASK: ARRAY SORT</p>
        <p className="text-sm text-muted-foreground">
          Click numbers in <span className="text-neon-pink">ascending order</span>
        </p>
      </div>

      {/* Unsorted source row */}
      <div>
        <p className="text-[10px] font-mono text-muted-foreground mb-2">INPUT ARRAY:</p>
        <div className="flex gap-2">
          {numbers.map((n, i) => {
            const isPicked = selected.includes(i)
            const pickOrder = selected.indexOf(i)
            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={done}
                className={cn(
                  'relative flex-1 h-12 rounded-md border-2 font-mono font-bold text-lg transition-all',
                  isPicked
                    ? 'border-neon-pink/40 bg-neon-pink/5 text-neon-pink/40'
                    : 'border-neon-pink bg-neon-pink/10 text-neon-pink hover:bg-neon-pink/20'
                )}
              >
                {n}
                {isPicked && (
                  <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-neon-pink text-background text-[9px] flex items-center justify-center font-bold">
                    {pickOrder + 1}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {/* Connector line */}
        <div className="flex gap-2 mt-1">
          {numbers.map((_, i) => (
            <div key={i} className="flex-1 flex items-center justify-center">
              {i < numbers.length - 1 && (
                <div className="w-full h-px bg-neon-pink/30" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sorted output row */}
      <div>
        <p className="text-[10px] font-mono text-muted-foreground mb-2">SORTED OUTPUT:</p>
        {/* Connector line */}
        <div className="flex gap-2 mb-1">
          {numbers.map((_, i) => (
            <div key={i} className="flex-1 flex items-center justify-center">
              {i < numbers.length - 1 && (
                <div className="w-full h-px bg-neon-cyan/30" />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {numbers.map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-12 rounded-md border-2 font-mono font-bold text-lg flex items-center justify-center transition-all',
                sortedAnswer[i] !== undefined
                  ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                  : 'border-border/40 bg-secondary/20 text-muted-foreground/30'
              )}
            >
              {sortedAnswer[i] ?? '—'}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/60">
        <span>{selected.length}/{numbers.length} SELECTED</span>
        {selected.length > 0 && !done && (
          <button
            onClick={() => setSelected([])}
            className="text-destructive/60 hover:text-destructive transition-colors"
          >
            RESET
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vinyl / Notes Task: Backend provides 3 letter characters; player types them back
// TRAP: No replay, must respond within 3 seconds
// ---------------------------------------------------------------------------

function VinylTask({ onComplete, onFail, onScore }: {
  onComplete: (accuracy: number, time: number) => void
  onFail: (reason: string) => void
  onScore: (score: number, verdict: string) => void
}) {
  const [symbols, setSymbols] = useState<string[] | null>(null)
  const [phase, setPhase] = useState<'waiting' | 'playing' | 'input'>('waiting')
  const [typed, setTyped] = useState<string[]>([])
  const [startTime] = useState(Date.now())
  const [inputStartTime, setInputStartTime] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const [failReason, setFailReason] = useState('')
  const [currentSymbolIndex, setCurrentSymbolIndex] = useState(-1)
  const [done, setDone] = useState(false)
  const [correct, setCorrect] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Request notes from backend
  useEffect(() => {
    const socket = getSocket()
    socket.emit('request-task:notes')
    const onStart = (data: { symbols: string[]; answers: string[] }) => {
      setSymbols(data.symbols)
      setPhase('playing')
    }
    socket.on('task-start:notes', onStart)
    return () => { socket.off('task-start:notes', onStart) }
  }, [])

  // Show each letter one by one, then switch to input phase
  useEffect(() => {
    if (phase !== 'playing' || !symbols) return
    let i = 0
    const show = () => {
      setCurrentSymbolIndex(i)
      i++
      if (i < symbols.length) {
        setTimeout(show, 700)
      } else {
        setTimeout(() => {
          setCurrentSymbolIndex(-1)
          setPhase('input')
          setInputStartTime(Date.now())
          inputRef.current?.focus()
        }, 700)
      }
    }
    const t = setTimeout(show, 300)
    return () => clearTimeout(t)
  }, [phase, symbols])

  // Response delay trap
  useEffect(() => {
    if (phase !== 'input' || failed || inputStartTime === null) return
    const timer = setTimeout(() => {
      if (typed.length === 0 && !done) {
        setFailed(true)
        setFailReason('SENSORY PROCESSING DELAY - Bots identify patterns instantly')
        setTimeout(() => onFail('Response delay exceeded'), 1500)
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [phase, failed, inputStartTime, typed, done, onFail])

  // Listen for backend results — register on mount so nothing is missed
  const startTimeRef = useRef(startTime)
  const onCompleteRef = useRef(onComplete)
  const onScoreRef = useRef(onScore)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])
  useEffect(() => { onScoreRef.current = onScore }, [onScore])

  useEffect(() => {
    const socket = getSocket()

    const onSuspicionUpdate = (data: { score: number; verdict: string }) => {
      onScoreRef.current(data.score, data.verdict)
    }

    const onTaskComplete = (data: { correct: boolean }) => {
      setCorrect(data.correct)
      setDone(true)
      const time = Date.now() - startTimeRef.current
      setTimeout(() => onCompleteRef.current(data.correct ? 100 : 0, time), 500)
    }

    const onAttemptResult = (data: { correct: boolean; attemptsLeft: number }) => {
      setTyped([])
      inputRef.current?.focus()
    }

    socket.on('suspicion-update', onSuspicionUpdate)
    socket.on('task-complete:notes', onTaskComplete)
    socket.on('attempt-result:notes', onAttemptResult)
    return () => {
      socket.off('suspicion-update', onSuspicionUpdate)
      socket.off('task-complete:notes', onTaskComplete)
      socket.off('attempt-result:notes', onAttemptResult)
    }
  }, [])

  // Auto-submit when all 3 letters typed
  useEffect(() => {
    if (!symbols || typed.length !== symbols.length || done) return
    const answer = typed.join('')
    getSocket().emit('attempt-task:notes', { answer })
  }, [typed, symbols, done])

  // Capture single key presses — each letter press fills one slot
  useEffect(() => {
    if (phase !== 'input' || failed || done || !symbols) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toUpperCase()
      if (key.length !== 1 || !/[A-Z]/.test(key)) return
      e.preventDefault()

      getSocket().emit('task-keystroke', { key, timestamp: Date.now() })
      setTyped(prev => prev.length < symbols.length ? [...prev, key] : prev)
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [phase, failed, done, symbols])

  if (!symbols) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-xs font-mono text-muted-foreground animate-pulse">LOADING TASK...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-xs font-mono text-muted-foreground mb-2">TASK: CHARACTER RECALL</p>
        <p className="text-sm text-muted-foreground">
          {phase === 'playing' ? 'Memorize the characters...' : 'Type the 3 characters you saw:'}
        </p>
      </div>

      {/* Vinyl visualization */}
      <div className="flex justify-center">
        <div className={cn(
          'relative w-32 h-32 rounded-full border-4 border-muted-foreground/30 bg-secondary/50',
          phase === 'playing' && 'animate-spin'
        )} style={{ animationDuration: '2s' }}>
          <div className="absolute inset-4 rounded-full border border-muted-foreground/20" />
          <div className="absolute inset-8 rounded-full border border-muted-foreground/20" />
          <div className="absolute inset-12 rounded-full bg-neon-orange/20 border border-neon-orange/50" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn(
              'text-3xl font-mono font-bold',
              currentSymbolIndex >= 0 ? 'text-neon-orange' : 'text-muted-foreground'
            )}>
              {currentSymbolIndex >= 0 ? symbols[currentSymbolIndex] : '?'}
            </span>
          </div>
        </div>
      </div>

      {/* Hidden input to capture focus */}
      <input ref={inputRef} className="opacity-0 absolute pointer-events-none" readOnly />

      {failed ? (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-center">
          <p className="text-red-400 font-mono text-sm">{failReason}</p>
        </div>
      ) : done ? (
        <div className={cn(
          'border rounded-lg p-4 text-center',
          correct ? 'bg-neon-green/10 border-neon-green' : 'bg-red-500/10 border-red-500'
        )}>
          <p className={cn('font-mono text-sm', correct ? 'text-neon-green' : 'text-red-400')}>
            {correct ? 'CORRECT - Processing complete' : 'INCORRECT - Evaluation submitted'}
          </p>
        </div>
      ) : phase === 'input' ? (
        <>
          <div className="flex justify-center gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn(
                'w-14 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-mono font-bold transition-all',
                typed[i]
                  ? 'border-neon-orange bg-neon-orange/20 text-neon-orange'
                  : i === typed.length
                  ? 'border-neon-orange/60 bg-secondary/30 text-muted-foreground animate-pulse'
                  : 'border-border bg-secondary/30 text-muted-foreground'
              )}>
                {typed[i] || '?'}
              </div>
            ))}
          </div>
          <p className="text-center text-[10px] font-mono text-muted-foreground/60">
            PRESS ANY LETTER KEY
          </p>
        </>
      ) : (
        <div className="flex justify-center gap-3">
          {symbols.map((_, i) => (
            <div key={i} className={cn(
              'w-14 h-14 rounded-lg border-2 flex items-center justify-center transition-all',
              currentSymbolIndex === i
                ? 'border-neon-orange bg-neon-orange/30 scale-110'
                : 'border-border bg-secondary/30'
            )}>
              <span className="text-2xl font-mono text-muted-foreground">?</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main MiniTask overlay component
// ---------------------------------------------------------------------------
export function MiniTaskOverlay() {
  const activeTask = useGameStore((s) => s.activeTask)
  const closeTask = useGameStore((s) => s.closeTask)
  const completeTask = useGameStore((s) => s.completeTask)
  const failTask = useGameStore((s) => s.failTask)
  const addObservation = useGameStore((s) => s.addObservation)
  const applyTaskScore = useGameStore((s) => s.applyTaskScore)

  // Handle typewriter completion: submit to backend, get score
  const handleTypewriterComplete = useCallback((accuracy: number, time: number, answer: string, _targetString: string) => {
    const socket = getSocket()

    socket.once('suspicion-update', (data: { score: number; verdict: string; wpm?: number }) => {
      applyTaskScore(data.score)
      const label = data.score < 35 ? 'ai-like' : data.score < 65 ? 'neutral' : 'suspicious'
      addObservation(`Typewriter: ${data.verdict} (score: ${data.score})`, label as 'ai-like' | 'neutral' | 'suspicious')
    })

    socket.emit('submit-task:typewriter', { answer })

    completeTask({
      taskId: 'typewriter',
      taskName: 'RETRO-TERMINAL',
      completionTime: time,
      accuracy,
      suspicionDelta: 0,
    })
  }, [completeTask, addObservation, applyTaskScore])

  // Handle sorting completion: submit to backend, get score
  const handleSortingComplete = useCallback((accuracy: number, time: number, answer: string) => {
    const socket = getSocket()

    socket.once('suspicion-update', (data: { score: number; verdict: string }) => {
      applyTaskScore(data.score)
      const label = data.score < 35 ? 'ai-like' : data.score < 65 ? 'neutral' : 'suspicious'
      addObservation(`Sorting: ${data.verdict} (score: ${data.score})`, label as 'ai-like' | 'neutral' | 'suspicious')
    })

    socket.emit('submit-task:sorting', { answer })

    completeTask({
      taskId: 'hanoi',
      taskName: 'HOLOGRAPHIC PLINTH',
      completionTime: time,
      accuracy,
      suspicionDelta: 0,
    })
  }, [completeTask, addObservation, applyTaskScore])

  const handleVinylScore = useCallback((score: number, verdict: string) => {
    applyTaskScore(score)
    const label = score < 35 ? 'ai-like' : score < 65 ? 'neutral' : 'suspicious'
    addObservation(`Notes: ${verdict} (score: ${score})`, label as 'ai-like' | 'neutral' | 'suspicious')
  }, [applyTaskScore, addObservation])

  const handleVinylComplete = useCallback((accuracy: number, time: number) => {
    completeTask({
      taskId: 'vinyl',
      taskName: 'AUDIO PLINTH',
      completionTime: time,
      accuracy,
      suspicionDelta: 0,
    })
  }, [completeTask])

  const handleFail = useCallback((taskId: string, taskName: string, reason: string) => {
    // Treat a failed task as very human-like (high suspicion score = 85)
    applyTaskScore(85)
    addObservation(`BEHAVIORAL ANOMALY: ${reason}`, 'suspicious')
    failTask({
      taskId,
      taskName,
      reason,
      suspicionDelta: 0,
    })
  }, [failTask, addObservation, applyTaskScore])

  if (!activeTask) return null

  const getTaskConfig = () => {
    switch (activeTask) {
      case 'typewriter':
        return { name: 'RETRO-TERMINAL', color: 'neon-cyan' }
      case 'hanoi':
        return { name: 'HOLOGRAPHIC PLINTH', color: 'neon-pink' }
      case 'vinyl':
        return { name: 'AUDIO PLINTH', color: 'neon-orange' }
      default:
        return null
    }
  }

  const config = getTaskConfig()
  if (!config) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" />

      {/* Task panel */}
      <div
        className={cn(
          'relative w-full max-w-md mx-4 bg-card border-2 rounded-lg p-6',
          `border-${config.color}/50`
        )}
        style={{
          boxShadow: `0 0 40px var(--${config.color}), 0 0 80px var(--${config.color})`
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className={cn('w-2 h-2 rounded-full animate-pulse', `bg-${config.color}`)} />
            <span className="text-xs font-mono text-muted-foreground">{config.name}</span>
          </div>
          <button
            onClick={closeTask}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Task content */}
        {activeTask === 'typewriter' && (
          <TypewriterTask
            onComplete={(accuracy, time, answer, targetString) =>
              handleTypewriterComplete(accuracy, time, answer, targetString)
            }
            onFail={(reason) => handleFail('typewriter', 'RETRO-TERMINAL', reason)}
          />
        )}
        {activeTask === 'hanoi' && (
          <SortingTask
            onComplete={(accuracy, time, answer) => handleSortingComplete(accuracy, time, answer)}
            onFail={(reason) => handleFail('hanoi', 'HOLOGRAPHIC PLINTH', reason)}
          />
        )}
        {activeTask === 'vinyl' && (
          <VinylTask
            onComplete={handleVinylComplete}
            onFail={(reason) => handleFail('vinyl', 'AUDIO PLINTH', reason)}
            onScore={handleVinylScore}
          />
        )}

        {/* Footer warning */}
        <p className="mt-4 text-[10px] font-mono text-muted-foreground/60 text-center">
          YOUR BEHAVIOR IS BEING ANALYZED
        </p>
      </div>
    </div>
  )
}
