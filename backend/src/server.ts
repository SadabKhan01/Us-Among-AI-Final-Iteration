import express from "express";
import type { Request, Response } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
<<<<<<< HEAD
import { PlayerManager } from "./logic/PlayerManager.js";
import { AIEvaluator } from "./services/AIEvaluator.js";
=======
import { GoogleGenAI } from "@google/genai";
>>>>>>> origin/brett-backend-2

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

<<<<<<< HEAD
const playerManager = new PlayerManager();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle player join
  socket.on("join", (data: { name: string }) => {
    playerManager.addPlayer(socket.id, data.name);
    io.emit("players-update", playerManager.getAllPlayers());
  });

  // Handle movement
  socket.on("move", (data: { x: number; y: number }) => {
    playerManager.updatePosition(socket.id, data.x, data.y);
    io.emit("players-update", playerManager.getAllPlayers());
  });

  // Handle general keystrokes (passive analysis)
  socket.on("keystroke", (data: { key: string, timestamp: number }) => {
    playerManager.addKeystroke(socket.id, data);
  });

  // --- Task Events ---

  socket.on("request-task:typewriter", async () => {
    const paragraph = await AIEvaluator.generateParagraph();
    playerManager.startTask(socket.id, paragraph);
    socket.emit("task-start:typewriter", { text: paragraph });
  });

  socket.on("task-keystroke", (data: { key: string, timestamp: number }) => {
    playerManager.handleTaskKeystroke(socket.id, data);
  });

  socket.on("submit-task:typewriter", async () => {
    const newScore = await playerManager.evaluateTypewriterTask(socket.id);
    io.emit("players-update", playerManager.getAllPlayers());
    socket.emit("suspicion-update", { score: newScore });
    socket.emit("task-complete:typewriter");
  });

  // Trigger general evaluation
  socket.on("evaluate-suspicion", async () => {
    const newScore = await playerManager.evaluatePlayer(socket.id);
    io.emit("players-update", playerManager.getAllPlayers());
    socket.emit("suspicion-update", { score: newScore });
  });

  socket.on("disconnect", () => {
    playerManager.removePlayer(socket.id);
    io.emit("players-update", playerManager.getAllPlayers());
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = 3001; 
=======
const PORT = 3001;
>>>>>>> origin/brett-backend-2
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



app.get("/sorting", async (req: Request, res: Response) => {
  try {
    const question = `
Return ONLY a JSON array of 5 integers.
Example: [1,2,3,4,5]
`;

    const answer = await askGemini(question);
    

    res.json({ answer });

  } catch (error: unknown) {
    console.error(error);

    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/notes", async (req: Request, res: Response) => {
  
    const notes = ["♩", "♪", "♫", "♬", "♭", "♮", "♯"];
   
    const getRandomElement = <T>(arr: T[]): T => {
        return arr[Math.floor(Math.random() * arr.length)];
      };

    const randomNote = getRandomElement(notes);


    res.json(randomNote);
 
  
});