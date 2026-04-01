import { AIEvaluator } from "../services/AIEvaluator.js";
import type { KeystrokeData } from "../services/AIEvaluator.js";

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  suspicionScore: number;
  keystrokeBuffer: KeystrokeData[];
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

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }
}
