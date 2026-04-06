import { create } from 'zustand'

export type GameScreen = 'landing' | 'game' | 'verdict'

export interface BehaviorMetrics {
  keyPressTimings: number[]
  averageDelay: number
  typingBursts: number
  corrections: number
  movementSmoothness: number
  interactionTimings: number[]
  hesitations: number
  overPrecision: number
  backspaceAttempts: number
  thinkingPauses: number
  responseLatencies: number[]
}

export interface TaskResult {
  taskId: string
  taskName: string
  completionTime: number
  accuracy: number
  suspicionDelta: number
  failed?: boolean
  failReason?: string
}

export interface AIObservation {
  id: string
  message: string
  timestamp: number
  type: 'neutral' | 'suspicious' | 'ai-like'
}

// Task sequence: orange (vinyl) -> purple (hanoi) -> blue (typewriter)
export const TASK_SEQUENCE = ['vinyl', 'hanoi', 'typewriter'] as const

export interface GameState {
  // Screen state
  currentScreen: GameScreen

  // Player state
  playerPosition: { x: number; y: number }
  playerDirection: 'up' | 'down' | 'left' | 'right'

  // Game progress
  suspicionLevel: number // 0-100, higher = more human-like (averaged from task scores)
  taskScores: number[]   // individual backend suspicion scores per task
  tasksCompleted: number
  totalTasks: number
  completedTaskIds: string[]
  taskResults: TaskResult[]
  
  // Behavior tracking
  metrics: BehaviorMetrics
  observations: AIObservation[]
  
  // Mini-task state
  activeTask: string | null
  
  // Music state - starts playing after vinyl task is completed
  isMusicPlaying: boolean
  
  // Session tracking
  sessionStartTime: number
  lastActionTime: number
  
  // Actions
  setScreen: (screen: GameScreen) => void
  movePlayer: (direction: 'up' | 'down' | 'left' | 'right') => void
  setPlayerPosition: (x: number, y: number) => void
  startTask: (taskId: string) => void
  completeTask: (result: TaskResult) => void
  failTask: (result: { taskId: string; taskName: string; reason: string; suspicionDelta: number }) => void
  closeTask: () => void
  updateSuspicion: (delta: number) => void
  applyTaskScore: (score: number) => void
  addObservation: (message: string, type: AIObservation['type']) => void
  recordKeyTiming: (timing: number) => void
  recordHesitation: () => void
  recordCorrection: () => void
  recordInteraction: () => void
  resetGame: () => void
  calculateFinalVerdict: () => { isAI: boolean; score: number; analysis: string[] }
  getNextTaskId: () => string | null
  isTaskAccessible: (taskId: string) => boolean
  setMusicPlaying: (playing: boolean) => void
}

const INITIAL_METRICS: BehaviorMetrics = {
  keyPressTimings: [],
  averageDelay: 0,
  typingBursts: 0,
  corrections: 0,
  movementSmoothness: 100,
  interactionTimings: [],
  hesitations: 0,
  overPrecision: 0,
  backspaceAttempts: 0,
  thinkingPauses: 0,
  responseLatencies: [],
}

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  currentScreen: 'landing',
  playerPosition: { x: 640, y: 400 }, // Center of 1280x720 scaled down
  playerDirection: 'down',
  suspicionLevel: 0,
  taskScores: [],
  tasksCompleted: 0,
  totalTasks: 3, // Updated to 3 tasks
  completedTaskIds: [],
  taskResults: [],
  metrics: { ...INITIAL_METRICS },
  observations: [],
  activeTask: null,
  isMusicPlaying: false,
  sessionStartTime: Date.now(),
  lastActionTime: Date.now(),

  // Actions
  setScreen: (screen) => set({ currentScreen: screen }),
  
  movePlayer: (direction) => {
    const state = get()
    const speed = 6
    let { x, y } = state.playerPosition
    
    // Room bounds (scaled from 1280x720 to 800x600 game view)
    switch (direction) {
      case 'up': y = Math.max(80, y - speed); break
      case 'down': y = Math.min(520, y + speed); break
      case 'left': x = Math.max(60, x - speed); break
      case 'right': x = Math.min(740, x + speed); break
    }
    
    const now = Date.now()
    const timeSinceLastAction = now - state.lastActionTime
    
    // Track movement smoothness
    if (timeSinceLastAction > 200) {
      set((s) => ({
        metrics: {
          ...s.metrics,
          movementSmoothness: Math.max(0, s.metrics.movementSmoothness - 1)
        }
      }))
    }
    
    set({ 
      playerPosition: { x, y }, 
      playerDirection: direction,
      lastActionTime: now
    })
  },
  
  setPlayerPosition: (x, y) => set({ playerPosition: { x, y } }),
  
  startTask: (taskId) => {
    set({ activeTask: taskId })
    get().recordInteraction()
  },
  
  completeTask: (result) => {
    const state = get()

    // Start music after vinyl (orange) task is completed
    const shouldStartMusic = result.taskId === 'vinyl'

    set({
      activeTask: null,
      tasksCompleted: state.tasksCompleted + 1,
      completedTaskIds: [...state.completedTaskIds, result.taskId],
      taskResults: [...state.taskResults, result],
      isMusicPlaying: shouldStartMusic ? true : state.isMusicPlaying
    })
    
    // Check if all tasks complete
    if (state.tasksCompleted + 1 >= state.totalTasks) {
      setTimeout(() => {
        set({ currentScreen: 'verdict' })
      }, 1500)
    }
  },
  
  failTask: (result) => {
    const state = get()
    set({
      activeTask: null,
      tasksCompleted: state.tasksCompleted + 1,
      completedTaskIds: [...state.completedTaskIds, result.taskId],
      taskResults: [...state.taskResults, {
        taskId: result.taskId,
        taskName: result.taskName,
        completionTime: 0,
        accuracy: 0,
        suspicionDelta: result.suspicionDelta,
        failed: true,
        failReason: result.reason
      }],
    })
    
    // Check if all tasks complete
    if (state.tasksCompleted + 1 >= state.totalTasks) {
      setTimeout(() => {
        set({ currentScreen: 'verdict' })
      }, 1500)
    }
  },
  
  closeTask: () => set({ activeTask: null }),
  
  updateSuspicion: (delta) => set((s) => ({
    suspicionLevel: Math.max(0, Math.min(100, s.suspicionLevel + delta))
  })),

  applyTaskScore: (score) => set((s) => {
    const newScores = [...s.taskScores, score]
    const avg = Math.round(newScores.reduce((a, b) => a + b, 0) / newScores.length)
    return { taskScores: newScores, suspicionLevel: avg }
  }),
  
  addObservation: (message, type) => set((s) => ({
    observations: [
      { id: crypto.randomUUID(), message, timestamp: Date.now(), type },
      ...s.observations.slice(0, 9) // Keep last 10
    ]
  })),
  
  recordKeyTiming: (timing) => set((s) => {
    const timings = [...s.metrics.keyPressTimings, timing].slice(-50)
    const avgDelay = timings.reduce((a, b) => a + b, 0) / timings.length
    
    // Detect typing bursts (very fast consecutive typing)
    const isBurst = timing < 50
    
    return {
      metrics: {
        ...s.metrics,
        keyPressTimings: timings,
        averageDelay: avgDelay,
        typingBursts: isBurst ? s.metrics.typingBursts + 1 : s.metrics.typingBursts
      }
    }
  }),
  
  recordHesitation: () => set((s) => ({
    metrics: { ...s.metrics, hesitations: s.metrics.hesitations + 1 }
  })),
  
  recordCorrection: () => set((s) => ({
    metrics: { ...s.metrics, corrections: s.metrics.corrections + 1 }
  })),
  
  recordInteraction: () => set((s) => ({
    metrics: {
      ...s.metrics,
      interactionTimings: [...s.metrics.interactionTimings, Date.now() - s.lastActionTime]
    },
    lastActionTime: Date.now()
  })),
  
  resetGame: () => set({
    currentScreen: 'landing',
    playerPosition: { x: 640, y: 400 },
    playerDirection: 'down',
    suspicionLevel: 0,
    taskScores: [],
    tasksCompleted: 0,
    completedTaskIds: [],
    taskResults: [],
    metrics: { ...INITIAL_METRICS },
    observations: [],
    activeTask: null,
    sessionStartTime: Date.now(),
    lastActionTime: Date.now(),
  }),
  
  calculateFinalVerdict: () => {
    const state = get()
    const { metrics, taskResults, suspicionLevel } = state
    
    const analysis: string[] = []
    let score = 100 - suspicionLevel // Lower suspicion = more AI-like
    
    // Count failed tasks
    const failedTasks = taskResults.filter(t => t.failed)
    if (failedTasks.length > 0) {
      analysis.push(`${failedTasks.length} task(s) failed due to human behavior`)
      score -= failedTasks.length * 20
    }
    
    // Analyze typing patterns
    if (metrics.averageDelay > 0) {
      if (metrics.averageDelay < 80) {
        analysis.push('Typing speed exceeds human baseline')
        score += 5
      } else if (metrics.averageDelay > 300) {
        analysis.push('Excessive input latency detected')
        score -= 10
      }
    }
    
    // Analyze corrections (backspace attempts)
    if (metrics.backspaceAttempts > 0) {
      analysis.push('Correction attempts detected - human trait')
      score -= 15
    }
    
    // Analyze thinking pauses
    if (metrics.thinkingPauses > 0) {
      analysis.push('Deliberation pauses observed')
      score -= 10
    }
    
    // Analyze hesitations during movement
    if (metrics.hesitations > 3) {
      analysis.push('Decision hesitation patterns observed')
      score -= 10
    }
    
    // Analyze task performance
    const completedTasks = taskResults.filter(t => !t.failed)
    if (completedTasks.length > 0) {
      const avgAccuracy = completedTasks.reduce((a, t) => a + t.accuracy, 0) / completedTasks.length
      if (avgAccuracy === 100) {
        analysis.push('Perfect task accuracy - AI parameters')
        score += 15
      } else if (avgAccuracy < 70) {
        analysis.push('Suboptimal task completion detected')
        score -= 15
      }
    }
    
    // Movement analysis
    if (metrics.movementSmoothness < 50) {
      analysis.push('Erratic movement patterns detected')
      score -= 10
    }
    
    score = Math.max(0, Math.min(100, score))
    
    return {
      isAI: score >= 50,
      score,
      analysis: analysis.length > 0 ? analysis : ['Behavior analysis inconclusive']
    }
  },
  
  getNextTaskId: () => {
    const state = get()
    for (const task of TASK_SEQUENCE) {
      if (!state.completedTaskIds.includes(task)) {
        return task
      }
    }
    return null
  },
  
  isTaskAccessible: (taskId) => {
    const state = get()
    return state.getNextTaskId() === taskId
  },
  
  setMusicPlaying: (playing) => set({ isMusicPlaying: playing })
}))
