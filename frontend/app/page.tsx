'use client'

import { useGameStore } from '@/lib/game-store'
import { LandingScreen } from '@/components/game/landing-screen'
import { GameScreen } from '@/components/game/game-screen'
import { VerdictScreen } from '@/components/game/verdict-screen'

export default function Home() {
  const currentScreen = useGameStore((s) => s.currentScreen)

  return (
    <main className="relative min-h-screen overflow-hidden scanlines">
      {currentScreen === 'landing' && <LandingScreen />}
      {currentScreen === 'game' && <GameScreen />}
      {currentScreen === 'verdict' && <VerdictScreen />}
    </main>
  )
}
