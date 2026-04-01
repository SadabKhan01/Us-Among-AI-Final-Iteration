import type { KeystrokeData, EvaluationResult } from "./AIEvaluator.js";

export class HeuristicEvaluator {
  private static readonly BOT_SPEED_THRESHOLD = 400; // CPM (Characters Per Minute)
  private static readonly BOT_JITTER_THRESHOLD = 15; // ms (Standard Deviation)
  private static readonly HUMAN_JITTER_THRESHOLD = 60; // ms

  static analyze(keystrokes: KeystrokeData[]): EvaluationResult & { needsAI: boolean } {
    if (keystrokes.length < 5) {
      return { humannessScore: 50, reasoning: "Insufficient data for heuristics.", needsAI: true };
    }

    // Calculate intervals (deltas)
    const intervals: number[] = [];
    for (let i = 1; i < keystrokes.length; i++) {
      intervals.push(keystrokes[i]!.timestamp - keystrokes[i - 1]!.timestamp);
    }

    // Calculate metrics
    const totalTimeMs = keystrokes[keystrokes.length - 1]!.timestamp - keystrokes[0]!.timestamp;
    const cpm = (keystrokes.length / (totalTimeMs / 60000));
    
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // 1. Obvious Bot (Impossible speed + Perfect timing)
    if (stdDev < this.BOT_JITTER_THRESHOLD && cpm > 200) {
      return { 
        humannessScore: 10, 
        reasoning: `Highly rhythmic and fast (CPM: ${Math.round(cpm)}, Jitter: ${Math.round(stdDev)}ms).`, 
        needsAI: false 
      };
    }

    // 2. Likely Human (High variety)
    if (stdDev > this.HUMAN_JITTER_THRESHOLD) {
      return { 
        humannessScore: 90, 
        reasoning: `Natural timing variety (Jitter: ${Math.round(stdDev)}ms).`, 
        needsAI: false 
      };
    }

    // 3. Grey Area (Escalate to AI)
    return { 
      humannessScore: 50, 
      reasoning: `Subtle timing patterns (CPM: ${Math.round(cpm)}, Jitter: ${Math.round(stdDev)}ms). Escalate to AI.`, 
      needsAI: true 
    };
  }
}
