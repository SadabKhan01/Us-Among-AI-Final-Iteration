import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export interface KeystrokeData {
  key: string;
  timestamp: number;
}

export interface EvaluationResult {
  humannessScore: number;
  reasoning: string;
}

export class AIEvaluator {
  private static generalPrompt = `
    Analyze the following sequence of keystrokes and their timing.
    Assess whether the behavior appears to be from a human or an AI/bot.

    Human patterns show:
    - Varying delays between keys (irregularity).
    - Longer delays for distant keys.
    - Subtle pauses after certain patterns.
    - Possible backspaces or corrections.

    Machine patterns show:
    - Highly consistent timing (fixed ms intervals).
    - Impossible speed for complex tasks.
    - Zero variation in press duration (if provided).

    Data is provided as an array of { key: string, timestamp: number }.

    Return ONLY a JSON object with:
    {
      "humannessScore": 0-100,
      "reasoning": "A brief explanation"
    }
  `;

  private static typewriterPrompt = `
    Analyze this REVERSE TEXT task performance.
    The user was asked to type the paragraph character-by-character in reverse.

    Target Text (Reversed): [TARGET]

    Bot Traps:
    1. Humans find character-by-character reversal extremely difficult. They pause, hesitate, and often make typos.
    2. Bots type with mechanical precision (e.g., exactly 50ms between every character).
    3. Humans often double-check the original text, leading to irregular rhythmic pauses.

    Data: [KEYSTROKES]

    Return ONLY a JSON object with:
    {
      "humannessScore": 0-100,
      "reasoning": "A brief explanation"
    }
  `;

  private static sortingPrompt = `
    Analyze this NUMBER SORTING task performance.
    The user was given 5 integers and asked to type them in ascending order.

    Numbers given: [TARGET]

    Bot Traps:
    1. Humans pause to think before typing — expect irregular delays, especially at the start.
    2. Bots sort and type instantly with uniform key intervals.
    3. Humans may backspace and correct mistakes.

    Data: [KEYSTROKES]

    Return ONLY a JSON object with:
    {
      "humannessScore": 0-100,
      "reasoning": "A brief explanation"
    }
  `;

  private static notesPrompt = `
    Analyze this MUSIC NOTE IDENTIFICATION task performance.
    The user was shown 3 music note symbols and had up to 3 attempts to name all of them.

    Context: [TARGET]

    Scoring guide:
    - "Correct on attempt: 1" with fast typing and short total time → VERY suspicious (score 10-25). A human seeing note symbols needs time to recall names.
    - "Correct on attempt: 1" with slow typing or hesitation pauses → moderately suspicious (score 30-50).
    - "Correct on attempt: 2 or 3" → more human-like (score 55-80).
    - "Correct on attempt: none" (all 3 failed) → ambiguous, evaluate timing only.
    - Fast uniform keystroke intervals with no backspaces → bot-like, lower score.
    - Irregular timing, backspaces, slow start → human-like, higher score.

    Keystroke Data: [KEYSTROKES]

    Return ONLY a JSON object with:
    {
      "humannessScore": 0-100,
      "reasoning": "A brief explanation"
    }
  `;

  static async generateParagraph(): Promise<string> {
    if (!process.env.GOOGLE_API_KEY) return "The quick brown fox jumps over the lazy dog near the river.";

    try {
      const result = await model.generateContent("Generate a simple, unique sentence of exactly 15 words. Return only the sentence with no formatting, punctuation, or line breaks.");
      return result.response.text().trim().replace(/\n/g, " ");
    } catch (error) {
      console.error("Paragraph generation error:", error);
      return "The quick brown fox jumps over the lazy dog near the river.";
    }
  }

  static async evaluate(keystrokes: KeystrokeData[]): Promise<EvaluationResult> {
    return this.runEvaluation(this.generalPrompt, JSON.stringify(keystrokes));
  }

  static async evaluateTypewriter(keystrokes: KeystrokeData[], targetText: string): Promise<EvaluationResult> {
    const prompt = this.typewriterPrompt.replace("[TARGET]", targetText);
    return this.runEvaluation(prompt, JSON.stringify(keystrokes));
  }

  static async evaluateSorting(keystrokes: KeystrokeData[], numbers: number[]): Promise<EvaluationResult> {
    const prompt = this.sortingPrompt.replace("[TARGET]", numbers.join(", "));
    return this.runEvaluation(prompt, JSON.stringify(keystrokes));
  }

  static async evaluateNotes(keystrokes: KeystrokeData[], note: string): Promise<EvaluationResult> {
    const prompt = this.notesPrompt.replace("[TARGET]", note);
    return this.runEvaluation(prompt, JSON.stringify(keystrokes));
  }

  private static async runEvaluation(systemPrompt: string, dataStr: string): Promise<EvaluationResult> {
    if (!process.env.GOOGLE_API_KEY) {
      console.warn("GOOGLE_API_KEY not found. Returning baseline score.");
      return { humannessScore: 50, reasoning: "API Key missing; baseline score." };
    }

    try {
      const result = await model.generateContent([systemPrompt, dataStr]);
      const responseText = result.response.text();
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}') + 1;
      const jsonStr = responseText.substring(jsonStart, jsonEnd);
      return JSON.parse(jsonStr) as EvaluationResult;
    } catch (error) {
      console.error("AI Evaluation error:", error);
      return { humannessScore: 50, reasoning: "Error during evaluation." };
    }
  }
}
