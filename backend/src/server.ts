import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { PlayerManager } from "./logic/PlayerManager.js";
import { AIEvaluator } from "./services/AIEvaluator.js";

dotenv.config();

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

const playerManager = new PlayerManager();

// Helper: generate random integers
function randomIntegers(count: number, min = 1, max = 99): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * (max - min + 1)) + min);
}

// Helper: pick random note
const NOTES = [
  { symbol: "♩", name: "quarter note" },
  { symbol: "♪", name: "eighth note" },
  { symbol: "♫", name: "beamed eighth notes" },
  { symbol: "♬", name: "beamed sixteenth notes" },
  { symbol: "♭", name: "flat" },
  { symbol: "♮", name: "natural" },
  { symbol: "♯", name: "sharp" },
];

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join", (data: { name: string }) => {
    playerManager.addPlayer(socket.id, data.name);
    io.emit("players-update", playerManager.getAllPlayers());
  });

  socket.on("move", (data: { x: number; y: number }) => {
    playerManager.updatePosition(socket.id, data.x, data.y);
    io.emit("players-update", playerManager.getAllPlayers());
  });

  socket.on("keystroke", (data: { key: string; timestamp: number }) => {
    playerManager.addKeystroke(socket.id, data);
  });

  // --- Typewriter Task ---

  socket.on("request-task:typewriter", async () => {
    const paragraph = await AIEvaluator.generateParagraph();
    playerManager.startTask(socket.id, paragraph);
    socket.emit("task-start:typewriter", { text: paragraph });
  });

  socket.on("submit-task:typewriter", async () => {
    const { suspicionScore, wpm, hasBackspaces } = await playerManager.evaluateTypewriterTask(socket.id);

    // WPM-based suspicion calibration (0–100 scale, higher = more suspicious)
    // Above 50 WPM: linearly scale from 50 suspicion at 50 WPM → 100 at 150+ WPM
    // Below 40 WPM with no mistakes: moderate suspicion (could be a careful bot)
    // Below 40 WPM with mistakes: low suspicion (very human)
    let wpmSuspicion: number;
    let verdict: string;

    if (wpm > 50) {
      // Scale: 50 WPM = 50 suspicion, 150 WPM = 100 suspicion (capped)
      wpmSuspicion = Math.min(100, Math.round(50 + ((wpm - 50) / 100) * 50));
      verdict = wpm >= 120 ? "AI" : wpm >= 80 ? "Highly Suspicious" : "Suspicious";
    } else if (wpm <= 40 && hasBackspaces) {
      // Mistakes present — very human-like
      wpmSuspicion = Math.max(0, Math.round(10 + (wpm / 40) * 15)); // 10–25
      verdict = "Human";
    } else if (wpm <= 40) {
      // No mistakes but slow — could be careful bot, mild suspicion
      wpmSuspicion = Math.round(20 + (wpm / 40) * 20); // 20–40
      verdict = "Likely Human";
    } else {
      // 40–50 WPM gap: interpolate between low and moderate suspicion
      wpmSuspicion = Math.round(35 + ((wpm - 40) / 10) * 15); // 35–50
      verdict = "Uncertain";
    }

    // Blend WPM suspicion (60%) with heuristic/AI suspicion score (40%)
    const blendedScore = Math.min(100, Math.round(wpmSuspicion * 0.6 + suspicionScore * 0.4));

    io.emit("players-update", playerManager.getAllPlayers());
    socket.emit("suspicion-update", { score: blendedScore, wpm, verdict });
    socket.emit("task-complete:typewriter");
  });

  // --- Sorting Task ---

  socket.on("request-task:sorting", () => {
    const numbers = randomIntegers(5);
    playerManager.startSortingTask(socket.id, numbers);
    socket.emit("task-start:sorting", { numbers });
  });

  socket.on("submit-task:sorting", async () => {
    const newScore = await playerManager.evaluateSortingTask(socket.id);
    io.emit("players-update", playerManager.getAllPlayers());
    socket.emit("suspicion-update", { score: newScore });
    socket.emit("task-complete:sorting");
  });

  // --- Notes Task ---

  socket.on("request-task:notes", () => {
    const note = NOTES[Math.floor(Math.random() * NOTES.length)]!;
    playerManager.startNotesTask(socket.id, note.symbol);
    socket.emit("task-start:notes", { symbol: note.symbol, answer: note.name });
  });

  socket.on("submit-task:notes", async () => {
    const newScore = await playerManager.evaluateNotesTask(socket.id);
    io.emit("players-update", playerManager.getAllPlayers());
    socket.emit("suspicion-update", { score: newScore });
    socket.emit("task-complete:notes");
  });

  // --- Shared keystroke event (used by all tasks) ---

  socket.on("task-keystroke", (data: { key: string; timestamp: number }) => {
    playerManager.handleTaskKeystroke(socket.id, data);
  });

  // --- General evaluation ---

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
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
