import React, { useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "./index.css";
import { SuspicionBar } from "./components/SuspicionBar";
import { TypewriterTask } from "./components/tasks/TypewriterTask";
import { useGameLoop } from "./hooks/useGameLoop";

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { players, myPos, suspicion, activeTask, socket, setActiveTask, taskResult, setTaskResult } = useGameLoop("Player1");

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
      
      <AnimatePresence>
        {activeTask?.type === "typewriter" && (
          <TypewriterTask
            text={activeTask.text}
            onKey={(key, timestamp) => {
              socket?.emit("task-keystroke", { key, timestamp });
            }}
            onComplete={() => {
              socket?.emit("submit-task:typewriter");
            }}
            onCancel={() => {
              setActiveTask(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!activeTask && taskResult && (
          <motion.div
            key="typewriter-result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 400,
              backgroundColor: "var(--bg-card)",
              padding: 32,
              borderRadius: 24,
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
              zIndex: 200,
              color: "white",
              textAlign: "center",
            }}
          >
            <h2 style={{ fontSize: 20, marginBottom: 24, color: "var(--accent-blue)" }}>ANALYSIS COMPLETE</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
              <div style={{ backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 12, padding: "12px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>TYPING SPEED</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: "var(--accent-pink)" }}>{taskResult.wpm} <span style={{ fontSize: 14 }}>WPM</span></div>
              </div>

              <div style={{ backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 12, padding: "12px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>SUSPICION SCORE</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: taskResult.suspicionScore > 60 ? "#ef4444" : taskResult.suspicionScore > 35 ? "#f59e0b" : "#22c55e" }}>
                  {Math.round(taskResult.suspicionScore)}<span style={{ fontSize: 14 }}> / 100</span>
                </div>
              </div>

              <div style={{
                backgroundColor: "rgba(0,0,0,0.3)",
                borderRadius: 12,
                padding: "12px 20px",
                border: `1px solid ${taskResult.verdict === "AI" ? "#ef4444" : taskResult.verdict === "Suspicious" ? "#f59e0b" : "#22c55e"}`,
              }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>VERDICT</div>
                <div style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: taskResult.verdict === "AI" ? "#ef4444" : taskResult.verdict === "Suspicious" ? "#f59e0b" : "#22c55e"
                }}>
                  {taskResult.verdict}
                </div>
              </div>
            </div>

            <button
              onClick={() => setTaskResult(null)}
              style={{
                backgroundColor: "var(--accent-blue)",
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "10px 32px",
                fontSize: 15,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{
        position: "fixed",
        bottom: 24,
        left: 24,
        color: "var(--text-muted)",
        fontSize: 14,
        zIndex: 100
      }}>
        <p>Use <b>WASD</b> to move.</p>
        <p>Press <b>E</b> near a terminal to start task.</p>
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
