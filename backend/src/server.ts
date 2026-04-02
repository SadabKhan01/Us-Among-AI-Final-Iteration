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
  { symbol: "Q", name: "Q" },
  { symbol: "E", name: "E" },
  { symbol: "B", name: "B" },
  { symbol: "S", name: "S" },
  { symbol: "F", name: "F" },
  { symbol: "N", name: "N" },
  { symbol: "A", name: "A" },
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

  socket.on("submit-task:typewriter", async (data: { answer: string }) => {
    const { suspicionScore, wpm } = await playerManager.evaluateTypewriterTask(socket.id, data?.answer ?? "");

    const verdict =
      suspicionScore >= 80 ? "Definitely Human" :
      suspicionScore >= 60 ? "Likely Human" :
      suspicionScore >= 40 ? "Ambiguous" :
      suspicionScore >= 20 ? "Likely AI" : "Perfect AI";

    io.emit("players-update", playerManager.getAllPlayers());
    socket.emit("suspicion-update", { score: suspicionScore, wpm, verdict });
    socket.emit("task-complete:typewriter");
  });

  // --- Sorting Task ---

  socket.on("request-task:sorting", () => {
    const numbers = randomIntegers(5);
    playerManager.startSortingTask(socket.id, numbers);
    socket.emit("task-start:sorting", { numbers });
  });

  socket.on("submit-task:sorting", async (data: { answer: string }) => {
    const { suspicionScore, taskDurationMs } = await playerManager.evaluateSortingTask(socket.id, data?.answer ?? "");
    const taskDurationSec = taskDurationMs / 1000;

    const verdict =
      suspicionScore >= 80 ? "Definitely Human" :
      suspicionScore >= 60 ? "Likely Human" :
      suspicionScore >= 40 ? "Ambiguous" :
      suspicionScore >= 20 ? "Likely AI" : "Perfect AI";

    io.emit("players-update", playerManager.getAllPlayers());
    socket.emit("suspicion-update", { score: suspicionScore, taskDurationSec: Math.round(taskDurationSec * 10) / 10, verdict });
    socket.emit("task-complete:sorting");
  });

  // --- Notes Task ---

  socket.on("request-task:notes", () => {
    // Pick 3 unique random notes
    const shuffled = [...NOTES].sort(() => Math.random() - 0.5).slice(0, 3);
    const symbols = shuffled.map((n) => n.symbol);
    const answers = shuffled.map((n) => n.name);
    playerManager.startNotesTask(socket.id, symbols, answers);
    socket.emit("task-start:notes", { symbols, answers });
  });

  socket.on("attempt-task:notes", async (data: { answer: string }) => {
    const { attemptsLeft, correct } = playerManager.recordNotesAttempt(socket.id, data.answer);
    if (correct || attemptsLeft === 0) {
      // Final — evaluate via Gemini
      const newScore = await playerManager.evaluateNotesTask(socket.id);
      io.emit("players-update", playerManager.getAllPlayers());
      const verdict =
        newScore >= 80 ? "Definitely Human" :
        newScore >= 60 ? "Likely Human" :
        newScore >= 40 ? "Ambiguous" :
        newScore >= 20 ? "Likely AI" : "Perfect AI";
      socket.emit("suspicion-update", { score: newScore, verdict: `${verdict} (${correct ? "Correct" : "Failed"})` });
      socket.emit("task-complete:notes", { correct, attemptsLeft });
    } else {
      socket.emit("attempt-result:notes", { correct, attemptsLeft });
    }
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

const PORT = 3002;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
