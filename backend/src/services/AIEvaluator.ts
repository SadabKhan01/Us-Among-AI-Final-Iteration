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
  private static prompt = `
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

  static async evaluate(keystrokes: KeystrokeData[]): Promise<EvaluationResult> {
    if (!process.env.GOOGLE_API_KEY) {
      console.warn("GOOGLE_API_KEY not found. Returning fake score.");
      return { humannessScore: 50, reasoning: "API Key missing; baseline score." };
    }

    try {
      const result = await model.generateContent([this.prompt, JSON.stringify(keystrokes)]);
      const responseText = result.response.text();
      // Basic JSON extraction
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
