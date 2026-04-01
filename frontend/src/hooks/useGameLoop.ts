import { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  suspicionScore: number;
}

export const useGameLoop = (playerName: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myPos, setMyPos] = useState({ x: 400, y: 300 });
  const [suspicion, setSuspicion] = useState(0);

  useEffect(() => {
    const newSocket = io("http://localhost:3001");
    setSocket(newSocket);

    newSocket.on("connect", () => {
      newSocket.emit("join", { name: playerName });
    });

    newSocket.on("players-update", (allPlayers: Player[]) => {
      setPlayers(allPlayers);
    });

    newSocket.on("suspicion-update", (data: { score: number }) => {
      setSuspicion(data.score);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [playerName]);

  // Handle Movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const step = 8;
      let newX = myPos.x;
      let newY = myPos.y;

      if (e.key === "w") newY -= step;
      if (e.key === "s") newY += step;
      if (e.key === "a") newX -= step;
      if (e.key === "d") newX += step;

      if (newX !== myPos.x || newY !== myPos.y) {
        setMyPos({ x: newX, y: newY });
        socket?.emit("move", { x: newX, y: newY });
      }

      // Record keystroke for analysis
      socket?.emit("keystroke", { key: e.key, timestamp: Date.now() });

      // Trigger evaluation on specific keys (e.g.Space for tasks)
      if (e.key === "Enter") {
        socket?.emit("evaluate-suspicion");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [myPos, socket]);

  return { players, myPos, suspicion, socket };
};
