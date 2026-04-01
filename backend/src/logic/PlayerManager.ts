import { AIEvaluator } from "../services/AIEvaluator.js";
import type { KeystrokeData } from "../services/AIEvaluator.js";
import { HeuristicEvaluator } from "../services/HeuristicEvaluator.js";

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  suspicionScore: number;
  keystrokeBuffer: KeystrokeData[];
  activeTask?: {
    type: "typewriter";
    targetText: string;
    keystrokes: KeystrokeData[];
  };
}

export class PlayerManager {
  private players: Map<string, Player> = new Map();

  addPlayer(id: string, name: string): Player {
    const player: Player = {
      id,
      name,
      x: 400,
      y: 300,
      suspicionScore: 0,
      keystrokeBuffer: [],
    };
    this.players.set(id, player);
    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  updatePosition(id: string, x: number, y: number): void {
    const player = this.players.get(id);
    if (player) {
      player.x = x;
      player.y = y;
    }
  }

  addKeystroke(id: string, data: KeystrokeData): void {
    const player = this.players.get(id);
    if (player) {
      player.keystrokeBuffer.push(data);
      // Limit buffer size to last 50 strokes
      if (player.keystrokeBuffer.length > 50) {
        player.keystrokeBuffer.shift();
      }
    }
  }

  async evaluatePlayer(id: string): Promise<number> {
    const player = this.players.get(id);
    if (!player || player.keystrokeBuffer.length < 5) return player?.suspicionScore || 0;

    const result = await AIEvaluator.evaluate(player.keystrokeBuffer);
    
    // We update suspicion based on "humanness" score.
    // If humanness is 100, suspicion goes down.
    // If humanness is 0, suspicion goes up.
    const humanness = result.humannessScore;
    const suspicionImpact = (50 - humanness) / 10; // Simple linear impact
    
    player.suspicionScore = Math.max(0, Math.min(100, player.suspicionScore + suspicionImpact));
    
    // Clear buffer after evaluation
    player.keystrokeBuffer = [];
    
    return player.suspicionScore;
  }

  startTask(id: string, targetText: string): void {
    const player = this.players.get(id);
    if (player) {
      player.activeTask = {
        type: "typewriter",
        targetText,
        keystrokes: [],
      };
    }
  }

  handleTaskKeystroke(id: string, data: KeystrokeData): void {
    const player = this.players.get(id);
    if (player && player.activeTask) {
      player.activeTask.keystrokes.push(data);
    }
  }

  async evaluateTypewriterTask(id: string): Promise<number> {
    const player = this.players.get(id);
    if (!player || !player.activeTask) return player?.suspicionScore || 0;

    const keystrokes = player.activeTask.keystrokes;
    const targetText = player.activeTask.targetText;

    // 1. Heuristic Check (High performance)
    const heuristic = HeuristicEvaluator.analyze(keystrokes);
    let humanness = heuristic.humannessScore;
    
    // 2. AI Check (Grey Area)
    if (heuristic.needsAI) {
      console.log(`[PlayerManager] Escallating to AI for ${player.id}`);
      const result = await AIEvaluator.evaluateTypewriter(keystrokes, targetText);
      humanness = result.humannessScore;
    }
    
    // Normalized impact: bots on reverse tasks are penalized heavily
    const suspicionImpact = (50 - humanness) / 5; 
    
    player.suspicionScore = Math.max(0, Math.min(100, player.suspicionScore + suspicionImpact));
    
    // Clear task after evaluation
    player.activeTask = undefined;
    
    return player.suspicionScore;
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }
}
