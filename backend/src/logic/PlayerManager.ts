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
    | { type: "notes"; notes: string[]; answers: string[]; keystrokes: KeystrokeData[]; startedAt: number; attemptsLeft: number; attemptAnswers: string[] };
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

  startNotesTask(id: string, notes: string[], answers: string[]): void {
    const player = this.players.get(id);
    if (player) {
      player.activeTask = { type: "notes", notes, answers, keystrokes: [], startedAt: Date.now(), attemptsLeft: 3, attemptAnswers: [] };
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

  async evaluateSortingTask(id: string): Promise<{ suspicionScore: number; taskDurationMs: number }> {
    const player = this.players.get(id);
    if (!player || !player.activeTask || player.activeTask.type !== "sorting") {
      return { suspicionScore: player?.suspicionScore || 0, taskDurationMs: 0 };
    }
    const { keystrokes, numbers, startedAt } = player.activeTask;
    const taskDurationMs = Date.now() - startedAt;
    const preTypingPauseMs = (keystrokes[0]?.timestamp ?? Date.now()) - startedAt;
    const suspicionScore = await this.runTaskEvaluation(keystrokes, (ks) => AIEvaluator.evaluateSorting(ks, numbers), id, taskDurationMs, preTypingPauseMs);
    return { suspicionScore, taskDurationMs };
  }

  recordNotesAttempt(id: string, answer: string): { attemptsLeft: number; correct: boolean } {
    const player = this.players.get(id);
    if (!player || !player.activeTask || player.activeTask.type !== "notes") return { attemptsLeft: 0, correct: false };
    const task = player.activeTask;
    task.attemptAnswers.push(answer);
    task.attemptsLeft = Math.max(0, task.attemptsLeft - 1);
    const lower = answer.toLowerCase();
    const correct = task.answers.every((a) => lower.includes(a.toLowerCase().trim()));
    return { attemptsLeft: task.attemptsLeft, correct };
  }

  async evaluateNotesTask(id: string): Promise<number> {
    const player = this.players.get(id);
    if (!player || !player.activeTask || player.activeTask.type !== "notes") return player?.suspicionScore || 0;
    const { keystrokes, notes, answers, attemptAnswers, startedAt } = player.activeTask;
    const taskDurationMs = Date.now() - startedAt;

    // Always use Gemini for notes — heuristics alone aren't reliable for short answers
    const context = [
      `Notes shown: ${notes.join(", ")}`,
      `Correct answers: ${answers.join(", ")}`,
      `Attempts used: ${attemptAnswers.length}/3`,
      `User attempts: ${attemptAnswers.join(" → ")}`,
      `Total time: ${(taskDurationMs / 1000).toFixed(1)}s`,
      `Correct on attempt: ${attemptAnswers.findIndex((a) => answers.every((ans) => a.toLowerCase().includes(ans.toLowerCase()))) + 1 || "none"}`,
    ].join(" | ");

    const result = await AIEvaluator.evaluateNotes(keystrokes, context);
    console.log(`[Notes] Gemini humannessScore: ${result.humannessScore} | reasoning: ${result.reasoning}`);

    // For notes, set suspicion directly from this evaluation rather than applying a small delta.
    // humanness 0  → suspicion 100 (bot-like)
    // humanness 50 → suspicion 50  (ambiguous)
    // humanness 100 → suspicion 0  (very human)
    // But we also factor in attempt number: first-try correct = boost suspicion
    const attemptNumber = attemptAnswers.findIndex((a) =>
      answers.every((ans) => a.toLowerCase().includes(ans.toLowerCase()))
    ) + 1; // 0 if none correct

    let baseSuspicion = 100 - result.humannessScore;

    // First-try correct → bump suspicion up significantly
    if (attemptNumber === 1) baseSuspicion = Math.min(100, baseSuspicion + 30);
    // Second-try → small bump
    else if (attemptNumber === 2) baseSuspicion = Math.min(100, baseSuspicion + 10);
    // Failed all → lower suspicion (at least tried like a human)
    else if (attemptNumber === 0) baseSuspicion = Math.max(0, baseSuspicion - 20);

    player.suspicionScore = Math.max(0, Math.min(100, baseSuspicion));
    player.activeTask = undefined;
    return player.suspicionScore;
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }
}
