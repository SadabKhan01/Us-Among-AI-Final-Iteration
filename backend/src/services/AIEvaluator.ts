import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

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
    The user was asked to type a sentence character-by-character in reverse order.

    Context: [TARGET]

    Evaluate ALL of the following signals:

    1. WPM (words per minute):
       - > 80 WPM: impossible for a human doing character reversal → bot
       - 40–80 WPM: suspiciously fast
       - 15–40 WPM: plausible human range
       - < 15 WPM: slow and careful, very human

    2. TOTAL TIME: Time from task shown to submission.
       - < 5s: almost certainly AI (text reversal takes mental effort)
       - 5–20s: fast but possible
       - > 20s: human range for this cognitive task

    3. KEYSTROKE INTERVAL stdDev:
       - < 20ms: robotic uniformity → bot
       - > 60ms: natural human variation

    4. BACKSPACES: Character reversal is hard — humans make mistakes.
       - Zero backspaces + correct answer: very suspicious
       - Backspaces present: human-like

    5. ANSWER CORRECTNESS:
       - Perfect reversal on first try + fast = strong bot signal
       - Errors or near-misses = human-like

    6. RHYTHM PATTERN: Humans pause more often mid-word while mentally scanning backwards.
       Bots maintain perfectly even spacing throughout.

    Scoring guide — humannessScore means HOW HUMAN the behaviour is (100 = definitely human, 0 = definitely bot):
    - 0–20: fast + correct + rhythmic + no backspaces → bot
    - 20–40: high WPM + correct + no backspaces → suspicious
    - 40–60: moderate pace, some irregularity → ambiguous
    - 60–80: slower pace, irregular timing or backspaces → likely human
    - 80–100: slow + mistakes + irregular + hesitation pauses → human

    Keystroke Data: [KEYSTROKES]

    Return ONLY a JSON object with:
    {
      "humannessScore": 0-100,
      "reasoning": "A brief explanation covering the key signals"
    }
  `;

  private static sortingPrompt = `
    Analyze this NUMBER SORTING task performance.
    The user was given 5 integers and asked to type them in ascending order.

    Context: [TARGET]

    Evaluate ALL of the following signals:

    1. PRE-TYPING PAUSE: Time from task shown to first keystroke.
       - < 500ms: bot-like (no thinking time) → very suspicious
       - 500ms–2s: fast but plausible
       - > 2s: human thinking time → less suspicious

    2. TOTAL TIME: Time from task shown to submission.
       - < 5s: almost certainly AI
       - 5–15s: human range
       - > 15s: clearly human

    3. KEYSTROKE INTERVALS: stdDev of gaps between keypresses.
       - Very low stdDev (< 20ms): robotic, uniform → bot
       - High stdDev (> 60ms): natural human variation

    4. BACKSPACES: Any corrections made?
       - Zero backspaces + correct answer: suspicious (bots don't mistype)
       - Backspaces present: human-like

    5. ANSWER CORRECTNESS:
       - Always correct + fast + no backspaces = strong bot signal
       - Wrong answer = human-like (bots don't make sorting errors)

    6. INTER-DIGIT PAUSES: Humans pause between each number as they scan the list.
       Bots type digits with perfectly even spacing.

    Scoring guide — humannessScore means HOW HUMAN the behaviour is (100 = definitely human, 0 = definitely bot):
    - 0–20: instant + correct + rhythmic + no backspaces → bot
    - 20–40: fast + correct + no backspaces → suspicious
    - 40–60: moderate pace, some irregularity → ambiguous
    - 60–80: slower pace, irregular timing or backspaces → likely human
    - 80–100: slow + mistakes + irregular + thinking pause → human

    Keystroke Data: [KEYSTROKES]

    Return ONLY a JSON object with:
    {
      "humannessScore": 0-100,
      "reasoning": "A brief explanation covering the key signals"
    }
  `;

  private static notesPrompt = `
    Analyze this MUSIC NOTE IDENTIFICATION task performance.
    The user was shown 3 music note symbols and had up to 3 attempts to name all of them.

    Context: [TARGET]

    Scoring guide — humannessScore means HOW HUMAN the behaviour is (100 = definitely human, 0 = definitely bot):
    - "Correct on attempt: 1" with fast typing and short total time → score 10–25 (bot — nailed it instantly).
    - "Correct on attempt: 1" with slow typing or hesitation → score 30–50 (somewhat human).
    - "Correct on attempt: 2 or 3" → score 55–80 (human — needed multiple tries).
    - "Correct on attempt: none" (all failed) → score 70–90 (very human — struggled).
    - Fast uniform keystroke intervals with no backspaces → lower score (bot-like).
    - Irregular timing, backspaces, slow start → higher score (human-like).

    Keystroke Data: [KEYSTROKES]

    Return ONLY a JSON object with:
    {
      "humannessScore": 0-100,
      "reasoning": "A brief explanation"
    }
  `;

  static async generateParagraph(): Promise<string> {
    if (!process.env.GOOGLE_API_KEY) return "hello world";

    try {
      const result = await model.generateContent("Generate a random 2 word phrase with no symbols, no punctuation, and all lowercase letters. Return only the two words separated by a space, with no extra formatting or line breaks.");
      return result.response.text().trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\n/g, " ");
    } catch (error) {
      console.error("Paragraph generation error:", error);
      return "hello world";
    }
  }

  static async evaluate(keystrokes: KeystrokeData[]): Promise<EvaluationResult> {
    return this.runEvaluation(this.generalPrompt, JSON.stringify(keystrokes));
  }

  static async evaluateTypewriter(keystrokes: KeystrokeData[], context: string): Promise<EvaluationResult> {
    const prompt = this.typewriterPrompt.replace("[TARGET]", context);
    return this.runEvaluation(prompt, JSON.stringify(keystrokes));
  }

  static async evaluateSorting(keystrokes: KeystrokeData[], context: string): Promise<EvaluationResult> {
    const prompt = this.sortingPrompt.replace("[TARGET]", context);
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
