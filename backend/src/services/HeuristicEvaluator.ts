import type { KeystrokeData, EvaluationResult } from "./AIEvaluator.js";

export class HeuristicEvaluator {
  private static readonly BOT_JITTER_THRESHOLD = 15;    // ms stdDev
  private static readonly HUMAN_JITTER_THRESHOLD = 60;  // ms stdDev

  private static readonly WPM_BOT = 120;
  private static readonly WPM_SUSPICIOUS = 90;
  private static readonly WPM_HUMAN_MAX = 90;

  private static readonly PAUSE_BOT = 500;
  private static readonly PAUSE_HUMAN = 2000;

  private static readonly DURATION_BOT = 3000;
  private static readonly DURATION_SUSPICIOUS = 10000;

  private static wpmHumanness(wpm: number): number {
    if (wpm > this.WPM_BOT) return 5;
    if (wpm > this.WPM_SUSPICIOUS) return 30;
    if (wpm > 60) return 70;
    if (wpm > 20) return 88;
    return 95;
  }

  private static pauseHumanness(pauseMs: number): number {
    if (pauseMs < this.PAUSE_BOT) return 5;
    if (pauseMs < 1000) return 25;
    if (pauseMs < this.PAUSE_HUMAN) return 60;
    if (pauseMs < 5000) return 90;
    return 95;
  }

  private static durationHumanness(durationMs: number): number {
    if (durationMs < this.DURATION_BOT) return 5;           // < 3s — impossibly fast
    if (durationMs < this.DURATION_SUSPICIOUS) return 30;   // 3–10s — suspicious
    if (durationMs < 20000) return 80;                      // 10–20s — normal human
    return 95;                                              // > 20s — slow, very human
  }

  static analyze(keystrokes: KeystrokeData[], taskDurationMs?: number, preTypingPauseMs?: number): EvaluationResult & { needsAI: boolean } {
    if (keystrokes.length < 5) {
      return { humannessScore: 0, reasoning: "Minimal input — instant submission is bot behaviour.", needsAI: false };
    }

    const intervals: number[] = [];
    for (let i = 1; i < keystrokes.length; i++) {
      intervals.push(keystrokes[i]!.timestamp - keystrokes[i - 1]!.timestamp);
    }

    const totalTimeMs = keystrokes[keystrokes.length - 1]!.timestamp - keystrokes[0]!.timestamp;
    const cpm = keystrokes.length / (totalTimeMs / 60000);
    const wpm = cpm / 5;

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    const backspaces = keystrokes.filter((k) => k.key === "Backspace").length;
    const backspaceRatio = backspaces / keystrokes.length;

    const wpmScore = this.wpmHumanness(wpm);
    const durationScore = taskDurationMs !== undefined ? this.durationHumanness(taskDurationMs) : null;
    const pauseScore = preTypingPauseMs !== undefined ? this.pauseHumanness(preTypingPauseMs) : null;

    const durationLabel = durationScore !== null ? `, Total: ${(taskDurationMs! / 1000).toFixed(1)}s` : "";
    const pauseLabel = pauseScore !== null ? `, Pre-pause: ${(preTypingPauseMs! / 1000).toFixed(1)}s` : "";

    // Blend: typing signals 50%, duration 30%, pause 20%
    // Weights normalise automatically based on what data is available
    const blend = (baseScore: number): number => {
      let score = baseScore * 0.5;
      let weight = 0.5;
      if (durationScore !== null) { score += durationScore * 0.3; weight += 0.3; }
      if (pauseScore !== null)    { score += pauseScore    * 0.2; weight += 0.2; }
      return Math.round(score / weight);
    };

    // Hard override: impossibly fast total time = bot
    if (durationScore !== null && durationScore <= 5) {
      return {
        humannessScore: 5,
        reasoning: `Impossibly fast completion (Total: ${(taskDurationMs! / 1000).toFixed(1)}s). Bot behaviour.`,
        needsAI: false,
      };
    }

    // 1. Obvious Bot: fast + rhythmic + zero corrections
    if (wpm > this.WPM_BOT && stdDev < this.BOT_JITTER_THRESHOLD && backspaces === 0) {
      return {
        humannessScore: blend(5),
        reasoning: `Bot-level speed, rhythmic, zero corrections (WPM: ${Math.round(wpm)}, Jitter: ${Math.round(stdDev)}ms${durationLabel}).`,
        needsAI: false,
      };
    }

    // 2. Suspicious WPM + no corrections
    if (wpm > this.WPM_SUSPICIOUS && backspaces === 0) {
      return {
        humannessScore: blend(20),
        reasoning: `High WPM, no corrections (WPM: ${Math.round(wpm)}${durationLabel}${pauseLabel}).`,
        needsAI: false,
      };
    }

    // 3. Strong human: corrections + slow/irregular
    if (backspaceRatio > 0.05 && (stdDev > this.HUMAN_JITTER_THRESHOLD || wpm < this.WPM_HUMAN_MAX)) {
      const score = Math.min(98, Math.round((wpmScore + 95) / 2));
      return {
        humannessScore: blend(score),
        reasoning: `Corrections + natural pace (WPM: ${Math.round(wpm)}, Jitter: ${Math.round(stdDev)}ms, Backspaces: ${backspaces}${durationLabel}${pauseLabel}).`,
        needsAI: false,
      };
    }

    // 4. High jitter alone
    if (stdDev > this.HUMAN_JITTER_THRESHOLD) {
      const score = Math.round((wpmScore + 80) / 2);
      return {
        humannessScore: blend(score),
        reasoning: `Natural timing variety (WPM: ${Math.round(wpm)}, Jitter: ${Math.round(stdDev)}ms${durationLabel}${pauseLabel}).`,
        needsAI: false,
      };
    }

    // 5. Slow but no corrections — ambiguous
    if (wpm < 40 && backspaces === 0) {
      return {
        humannessScore: blend(50),
        reasoning: `Slow but no corrections (WPM: ${Math.round(wpm)}${durationLabel}${pauseLabel}). Ambiguous.`,
        needsAI: durationScore === null, // duration breaks the tie if available
      };
    }

    // 6. Slow with corrections
    if (wpm < this.WPM_HUMAN_MAX && stdDev > 30) {
      const score = Math.round((wpmScore + 78) / 2);
      return {
        humannessScore: blend(score),
        reasoning: `Slow and irregular (WPM: ${Math.round(wpm)}, Jitter: ${Math.round(stdDev)}ms, Backspaces: ${backspaces}${durationLabel}${pauseLabel}).`,
        needsAI: false,
      };
    }

    // 7. Grey area — escalate to AI
    return {
      humannessScore: blend(wpmScore),
      reasoning: `Grey area (WPM: ${Math.round(wpm)}, Jitter: ${Math.round(stdDev)}ms, Backspaces: ${backspaces}${durationLabel}${pauseLabel}). Escalate to AI.`,
      needsAI: true,
    };
  }
}
