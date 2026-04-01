import express from "express";
import type { Request, Response } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY");
}

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function askGemini(text: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: text,
    });

    return response.text ?? "";
  } catch (error) {
    console.error("Gemini error:", error);
    throw new Error("Failed to get response from Gemini");
  }
}

function extractArray(text: string): number[] {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    const match = text.match(/\[.*?\]/s);
    if (!match) throw new Error("No array found in response");

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) throw new Error();

    return parsed;
  }
}

app.get("/sorting", async (req: Request, res: Response) => {
  try {
    const question = `
Return ONLY a JSON array of 5 integers.
Example: [1,2,3,4,5]
`;

    const answer = await askGemini(question);
    const array = extractArray(answer);

    res.json({ array });

  } catch (error: unknown) {
    console.error(error);

    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});