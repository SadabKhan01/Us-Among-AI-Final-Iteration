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
  activeTask?:
    | { type: "typewriter"; targetText: string; keystrokes: KeystrokeData[]; startedAt: number }
    | { type: "sorting"; numbers: number[]; keystrokes: KeystrokeData[]; startedAt: number }
    | { type: "notes"; note: string; keystrokes: KeystrokeData[]; startedAt: number };
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
      if (player.keystrokeBuffer.length > 50) {
        player.keystrokeBuffer.shift();
      }
    }
  }

  async evaluatePlayer(id: string): Promise<number> {
    const player = this.players.get(id);
    if (!player || player.keystrokeBuffer.length < 5) return player?.suspicionScore || 0;

    const result = await AIEvaluator.evaluate(player.keystrokeBuffer);
    const humanness = result.humannessScore;
    const suspicionImpact = (humanness - 50) / 10;
    player.suspicionScore = Math.max(0, Math.min(100, player.suspicionScore + suspicionImpact));
    player.keystrokeBuffer = [];
    return player.suspicionScore;
  }

  // --- Task Start ---

  startTask(id: string, targetText: string): void {
    const player = this.players.get(id);
    if (player) {
      player.activeTask = { type: "typewriter", targetText, keystrokes: [], startedAt: Date.now() };
    }
  }

  startSortingTask(id: string, numbers: number[]): void {
    const player = this.players.get(id);
    if (player) {
      player.activeTask = { type: "sorting", numbers, keystrokes: [], startedAt: Date.now() };
    }
  }

  startNotesTask(id: string, note: string): void {
    const player = this.players.get(id);
    if (player) {
      player.activeTask = { type: "notes", note, keystrokes: [], startedAt: Date.now() };
    }
  }

  // --- Keystroke Buffering ---

  handleTaskKeystroke(id: string, data: KeystrokeData): void {
    const player = this.players.get(id);
    if (player && player.activeTask) {
      player.activeTask.keystrokes.push(data);
    }
  }

  // --- Shared Evaluation Pipeline ---

  private async runTaskEvaluation(
    keystrokes: KeystrokeData[],
    aiEvaluator: (ks: KeystrokeData[]) => Promise<{ humannessScore: number }>,
    playerId: string,
    taskDurationMs: number,
    preTypingPauseMs?: number
  ): Promise<number> {
    const player = this.players.get(playerId);
    if (!player) return 0;

    const heuristic = HeuristicEvaluator.analyze(keystrokes, taskDurationMs, preTypingPauseMs);
    let humanness = heuristic.humannessScore;

    if (heuristic.needsAI) {
      console.log(`[PlayerManager] Escalating to AI for ${playerId}`);
      const result = await aiEvaluator(keystrokes);
      humanness = result.humannessScore;
    }

    // High humanness = acting human = more suspicious
    // humanness 100 → +10 suspicion, humanness 0 → -10 suspicion
    const suspicionImpact = (humanness - 50) / 5;
    player.suspicionScore = Math.max(0, Math.min(100, player.suspicionScore + suspicionImpact));
    player.activeTask = undefined;
    return player.suspicionScore;
  }

  // --- Task Submit ---

  async evaluateTypewriterTask(id: string): Promise<{ suspicionScore: number; wpm: number; hasBackspaces: boolean }> {
    const player = this.players.get(id);
    if (!player || !player.activeTask || player.activeTask.type !== "typewriter") {
      return { suspicionScore: player?.suspicionScore || 0, wpm: 0, hasBackspaces: false };
    }
    const { keystrokes, targetText, startedAt } = player.activeTask;
    const taskDurationMs = Date.now() - startedAt;

    // WPM: count spaces typed (proxy for word boundaries in reversed text)
    const spaceCount = keystrokes.filter((k) => k.key === " ").length;
    const typingDurationMs =
      keystrokes.length >= 2
        ? keystrokes[keystrokes.length - 1]!.timestamp - keystrokes[0]!.timestamp
        : taskDurationMs;
    const wpm = typingDurationMs > 0 ? Math.round((spaceCount / typingDurationMs) * 60000) : 0;
    const hasBackspaces = keystrokes.some((k) => k.key === "Backspace");

    const suspicionScore = await this.runTaskEvaluation(
      keystrokes,
      (ks) => AIEvaluator.evaluateTypewriter(ks, targetText),
      id,
      taskDurationMs
    );
    return { suspicionScore, wpm, hasBackspaces };
  }

  async evaluateSortingTask(id: string): Promise<number> {
    const player = this.players.get(id);
    if (!player || !player.activeTask || player.activeTask.type !== "sorting") return player?.suspicionScore || 0;
    const { keystrokes, numbers, startedAt } = player.activeTask;
    const taskDurationMs = Date.now() - startedAt;
    const preTypingPauseMs = (keystrokes[0]?.timestamp ?? Date.now()) - startedAt;
    return this.runTaskEvaluation(keystrokes, (ks) => AIEvaluator.evaluateSorting(ks, numbers), id, taskDurationMs, preTypingPauseMs);
  }

  async evaluateNotesTask(id: string): Promise<number> {
    const player = this.players.get(id);
    if (!player || !player.activeTask || player.activeTask.type !== "notes") return player?.suspicionScore || 0;
    const { keystrokes, note, startedAt } = player.activeTask;
    const taskDurationMs = Date.now() - startedAt;
    return this.runTaskEvaluation(keystrokes, (ks) => AIEvaluator.evaluateNotes(ks, note), id, taskDurationMs);
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }
}
