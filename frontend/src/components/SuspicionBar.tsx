import React from "react";
import { motion } from "framer-motion";

interface SuspicionBarProps {
  score: number;
}

export const SuspicionBar: React.FC<SuspicionBarProps> = ({ score }) => {
  // Determine color based on score
  const getColor = (s: number) => {
    if (s < 30) return "#22c55e"; // Green (Safe)
    if (s < 70) return "#eab308"; // Yellow (Suspicious)
    return "#ef4444"; // Red (Critical)
  };

  return (
    <div style={{
      position: "fixed",
      top: 24,
      right: 24,
      width: 300,
      background: "rgba(30, 41, 59, 0.8)",
      padding: 16,
      borderRadius: 12,
      backdropFilter: "blur(8px)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      zIndex: 100
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Suspicion Level</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: getColor(score) }}>{Math.round(score)}%</span>
      </div>
      <div style={{
        height: 8,
        background: "rgba(15, 23, 42, 0.5)",
        borderRadius: 4,
        overflow: "hidden"
      }}>
        <motion.div
          animate={{ width: `${score}%`, backgroundColor: getColor(score) }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          style={{ height: "100%" }}
        />
      </div>
      {score > 80 && (
        <motion.div
          animate={{ opacity: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 1 }}
          style={{ 
            marginTop: 8, 
            fontSize: 12, 
            color: "var(--danger)", 
            textAlign: "center",
            fontWeight: 800
          }}
        >
          🚨 CRITICAL SUSPICION - TERMINATION IMMINENT 🚨
        </motion.div>
      )}
    </div>
  );
};
