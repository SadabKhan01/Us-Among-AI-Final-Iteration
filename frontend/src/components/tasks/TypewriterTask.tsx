import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface TypewriterTaskProps {
  text: string;
  onKey: (key: string, timestamp: number) => void;
  onComplete: () => void;
  onCancel: () => void;
}

export const TypewriterTask: React.FC<TypewriterTaskProps> = ({ text, onKey, onComplete, onCancel }) => {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The goal: type the text in REVERSE
  const reversedTarget = text.split("").reverse().join("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    if (val === reversedTarget) {
      onComplete();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKey(e.key, Date.now());
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 500,
        backgroundColor: "var(--bg-card)",
        padding: 32,
        borderRadius: 24,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        zIndex: 200,
        color: "white"
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8, color: "var(--accent-blue)" }}>TASK: DATA REVERSAL</h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Reverse the following data packets to stabilize the connection.
          <br />
          <b>Bot Warning:</b> Artificial efficiency will trigger security protocols.
        </p>
      </div>

      <div style={{
        backgroundColor: "rgba(0, 0, 0, 0.3)",
        padding: 16,
        borderRadius: 12,
        fontFamily: "monospace",
        fontSize: 18,
        lineHeight: 1.5,
        marginBottom: 24,
        whiteSpace: "pre-wrap",
        color: "var(--accent-pink)"
      }}>
        {text}
      </div>

      <textarea
        ref={inputRef}
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type reversed text here..."
        style={{
          width: "100%",
          height: 120,
          backgroundColor: "rgba(15, 23, 42, 0.5)",
          color: "white",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: 12,
          padding: 16,
          fontSize: 16,
          fontFamily: "monospace",
          outline: "none",
          resize: "none"
        }}
      />

      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            background: "transparent",
            color: "var(--text-muted)",
            border: "none",
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: 14
          }}
        >
          Abort Task
        </button>
      </div>
    </motion.div>
  );
};
