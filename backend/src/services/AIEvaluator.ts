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
      "humannessScore": 0-100, // 100 = perfectly human, 0 = machine
      "reasoning": "A brief explanation"
    }
  `;

  private static typewriterPrompt = `
    Analyze this REVERSE TEXT task performance.
    The user was asked to type the paragraph character-by-character in reverse.
    
    Target Text (Reversed): [TARGET]
    
    Bot Traps for Tasks:
    1. Humans find character-by-character reversal extremely difficult. They pause, hesitate, and often make typos.
    2. Bots are "instant" or show "mechanical precision" (e.g., exactly 50ms between every character).
    3. Humans often double-check the original text, leading to irregular rhythmic pauses.
    
    Data: [KEYSTROKES]
    
    Return ONLY a JSON object with:
    {
      "humannessScore": 0-100,
      "reasoning": "A brief explanation"
    }
  `;

  static async generateParagraph(): Promise<string> {
    if (!process.env.GOOGLE_API_KEY) return "The quick brown\nfox jumps over\nthe lazy dog."; 
    
    try {
      const result = await model.generateContent("Generate a simple, unique 15-word paragraph, split into exactly 3 lines. Do not include any formatting or other text.");
      return result.response.text();
    } catch (error) {
      console.error("Paragraph generation error:", error);
      return "Default text for\ntesting the system\nin 3 lines.";
    }
  }

  static async evaluate(keystrokes: KeystrokeData[]): Promise<EvaluationResult> {
    return this.runEvaluation(this.generalPrompt, JSON.stringify(keystrokes));
  }

  static async evaluateTypewriter(keystrokes: KeystrokeData[], targetText: string): Promise<EvaluationResult> {
    const prompt = this.typewriterPrompt.replace("[TARGET]", targetText);
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
