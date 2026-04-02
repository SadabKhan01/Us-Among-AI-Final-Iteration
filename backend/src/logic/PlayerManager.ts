import { AIEvaluator } from "../services/AIEvaluator.js";
import type { KeystrokeData } from "../services/AIEvaluator.js";

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

  // --- Task Submit ---

  async evaluateTypewriterTask(id: string, userAnswer: string): Promise<{ suspicionScore: number; wpm: number }> {
    const player = this.players.get(id);
    if (!player || !player.activeTask || player.activeTask.type !== "typewriter") {
      return { suspicionScore: player?.suspicionScore || 0, wpm: 0 };
    }
    const { keystrokes, targetText, startedAt } = player.activeTask;
    const taskDurationMs = Date.now() - startedAt;

    // WPM from spaces typed
    const spaceCount = keystrokes.filter((k) => k.key === " ").length;
    const typingDurationMs = keystrokes.length >= 2
      ? keystrokes[keystrokes.length - 1]!.timestamp - keystrokes[0]!.timestamp
      : taskDurationMs;
    const wpm = typingDurationMs > 0 ? Math.round((spaceCount / typingDurationMs) * 60000) : 0;

    // Keystroke stats
    const intervals: number[] = [];
    for (let i = 1; i < keystrokes.length; i++) {
      intervals.push(keystrokes[i]!.timestamp - keystrokes[i - 1]!.timestamp);
    }
    const mean = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
    const stdDev = intervals.length > 0
      ? Math.sqrt(intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length)
      : 0;
    const backspaces = keystrokes.filter((k) => k.key === "Backspace").length;

    const reversedTarget = targetText.split("").reverse().join("");
    const isCorrect = userAnswer.trim() === reversedTarget.trim();

    const context = [
      `Original text: "${targetText}"`,
      `Expected reversed: "${reversedTarget}"`,
      `User answer correct: ${isCorrect ? "YES" : "NO"}`,
      `WPM: ${wpm}`,
      `Total time: ${(taskDurationMs / 1000).toFixed(2)}s`,
      `Keystroke count: ${keystrokes.length}`,
      `Backspaces: ${backspaces}`,
      `Keystroke interval stdDev: ${Math.round(stdDev)}ms`,
      `Keystroke interval mean: ${Math.round(mean)}ms`,
    ].join(" | ");

    console.log(`[Typewriter] Context: ${context}`);

    const result = await AIEvaluator.evaluateTypewriter(keystrokes, context);
    console.log(`[Typewriter] Gemini humannessScore: ${result.humannessScore} | reasoning: ${result.reasoning}`);

    // humannessScore = suspicion directly (high humanness = high suspicion = more human)
    // WPM signal: high WPM = low suspicion (AI-like), low WPM = high suspicion (human-like)
    let wpmSuspicion: number;
    if (wpm > 80) wpmSuspicion = Math.round(10 + ((150 - Math.min(wpm, 150)) / 70) * 20); // 10–30
    else if (wpm > 40) wpmSuspicion = Math.round(30 + ((80 - wpm) / 40) * 30);             // 30–60
    else if (wpm > 15) wpmSuspicion = Math.round(60 + ((40 - wpm) / 25) * 20);             // 60–80
    else wpmSuspicion = backspaces > 0 ? 95 : 80;

    player.suspicionScore = Math.min(100, Math.round(result.humannessScore * 0.5 + wpmSuspicion * 0.5));
    player.activeTask = undefined;
    return { suspicionScore: player.suspicionScore, wpm };
  }

  async evaluateSortingTask(id: string, userAnswer: string): Promise<{ suspicionScore: number; taskDurationMs: number }> {
    const player = this.players.get(id);
    if (!player || !player.activeTask || player.activeTask.type !== "sorting") {
      return { suspicionScore: player?.suspicionScore || 0, taskDurationMs: 0 };
    }
    const { keystrokes, numbers, startedAt } = player.activeTask;
    const taskDurationMs = Date.now() - startedAt;
    const preTypingPauseMs = keystrokes.length > 0 ? keystrokes[0]!.timestamp - startedAt : taskDurationMs;

    const sortedCorrect = [...numbers].sort((a, b) => a - b).join(" ");
    const isCorrect = userAnswer.trim() === sortedCorrect;

    // Compute keystroke stats for context
    const intervals: number[] = [];
    for (let i = 1; i < keystrokes.length; i++) {
      intervals.push(keystrokes[i]!.timestamp - keystrokes[i - 1]!.timestamp);
    }
    const mean = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
    const stdDev = intervals.length > 0
      ? Math.sqrt(intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length)
      : 0;
    const backspaces = keystrokes.filter((k) => k.key === "Backspace").length;

    const context = [
      `Numbers given: ${numbers.join(", ")}`,
      `Correct answer: ${sortedCorrect}`,
      `User answer: "${userAnswer.trim()}"`,
      `Answer correct: ${isCorrect ? "YES" : "NO"}`,
      `Total time: ${(taskDurationMs / 1000).toFixed(2)}s`,
      `Pre-typing pause: ${(preTypingPauseMs / 1000).toFixed(2)}s`,
      `Keystroke count: ${keystrokes.length}`,
      `Backspaces: ${backspaces}`,
      `Keystroke interval stdDev: ${Math.round(stdDev)}ms`,
      `Keystroke interval mean: ${Math.round(mean)}ms`,
    ].join(" | ");

    console.log(`[Sorting] Context: ${context}`);

    const result = await AIEvaluator.evaluateSorting(keystrokes, context);
    console.log(`[Sorting] Gemini humannessScore: ${result.humannessScore} | reasoning: ${result.reasoning}`);

    // humannessScore = suspicion directly (high = human, low = AI)
    // Time signal: fast = low suspicion (AI-like), slow = high suspicion (human-like)
    const taskDurationSec = taskDurationMs / 1000;
    let timeSuspicion: number;
    if (taskDurationSec < 5) {
      timeSuspicion = Math.round((taskDurationSec / 5) * 20);        // 0–20 (AI range)
    } else if (taskDurationSec <= 15) {
      timeSuspicion = Math.round(20 + ((taskDurationSec - 5) / 10) * 60); // 20–80
    } else {
      timeSuspicion = 90;                                            // clearly human
    }

    player.suspicionScore = Math.min(100, Math.round(result.humannessScore * 0.5 + timeSuspicion * 0.5));
    player.activeTask = undefined;
    return { suspicionScore: player.suspicionScore, taskDurationMs };
  }

  recordNotesAttempt(id: string, answer: string): { attemptsLeft: number; correct: boolean } {
    const player = this.players.get(id);
    if (!player || !player.activeTask || player.activeTask.type !== "notes") return { attemptsLeft: 0, correct: false };
    const task = player.activeTask;
    task.attemptAnswers.push(answer);
    task.attemptsLeft = Math.max(0, task.attemptsLeft - 1);
    const lower = answer.toLowerCase().replace(/[^a-z]/g, "");
    const expected = task.answers.join("").toLowerCase().replace(/[^a-z]/g, "");
    const correct = lower === expected;
    
    console.log(`[Vinyl Task] Input from frontend: ${answer}`);
    console.log(`[Vinyl Task] Generated solution: ${task.answers.join("")}`);

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

    // humannessScore = suspicion directly (high = human, low = AI)
    let baseSuspicion = result.humannessScore;

    // First-try correct → lower suspicion (AI nails it instantly)
    if (attemptNumber === 1) baseSuspicion = Math.max(0, baseSuspicion - 30);
    // Second-try → slight reduction
    else if (attemptNumber === 2) baseSuspicion = Math.max(0, baseSuspicion - 10);
    // Failed all → boost suspicion (very human to struggle)
    else if (attemptNumber === 0) baseSuspicion = Math.min(100, baseSuspicion + 20);

    player.suspicionScore = Math.max(0, Math.min(100, baseSuspicion));
    player.activeTask = undefined;
    return player.suspicionScore;
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }
}
