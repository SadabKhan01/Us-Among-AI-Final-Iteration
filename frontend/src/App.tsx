import React, { useRef, useEffect } from "react";
import "./index.css";
import { SuspicionBar } from "./components/SuspicionBar";
import { useGameLoop } from "./hooks/useGameLoop";

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { players, myPos, suspicion } = useGameLoop("Player1");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Game loop for rendering
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw players
      players.forEach((player) => {
        const isMe = player.id === players.find(p => p.x === myPos.x && p.y === myPos.y)?.id; 
        
        ctx.fillStyle = isMe ? "var(--accent-pink)" : "var(--accent-blue)";
        ctx.beginPath();
        ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
        ctx.fill();

        // Draw name
        ctx.fillStyle = "white";
        ctx.font = "12px Inter";
        ctx.textAlign = "center";
        ctx.fillText(player.name, player.x, player.y - 30);
      });

      requestAnimationFrame(render);
    };

    render();
  }, [players, myPos]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <SuspicionBar score={suspicion} />
      
      <div style={{
        position: "fixed",
        bottom: 24,
        left: 24,
        color: "var(--text-muted)",
        fontSize: 14,
        zIndex: 100
      }}>
        <p>Use <b>WASD</b> to move.</p>
        <p>Press <b>Enter</b> to trigger AI evaluation.</p>
      </div>

      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
      />
    </div>
  );
};

export default App;
