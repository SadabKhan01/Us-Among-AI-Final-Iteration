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
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
