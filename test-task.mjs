/**
 * Task Test Script
 * Usage: node test-task.mjs
 *
 * Connects to the backend via Socket.io, lets you pick a task,
 * captures your keystrokes + timestamps, validates your answer,
 * submits, and shows your suspicion result.
 */

import { io } from "socket.io-client";
import * as readline from "readline";

const SERVER_URL = "http://localhost:3001";

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function captureKeystrokes(promptText) {
  return new Promise((resolve) => {
    const keystrokes = [];
    let answer = "";

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdout.write(`\n${promptText}\n> `);

    function handler(key) {
      const timestamp = Date.now();

      if (key === "\r" || key === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", handler);
        process.stdout.write("\n");
        resolve({ answer, keystrokes });
        return;
      }

      if (key === "\u0003") process.exit(); // Ctrl+C

      if (key === "\u007F") {
        // Backspace
        answer = answer.slice(0, -1);
        process.stdout.write("\b \b");
        keystrokes.push({ key: "Backspace", timestamp });
        return;
      }

      answer += key;
      process.stdout.write(key);
      keystrokes.push({ key, timestamp });
    }

    process.stdin.on("data", handler);
  });
}

function checkAnswer(taskType, answer, taskData) {
  if (taskType === "typewriter") {
    const expected = taskData.text.split("").reverse().join("");
    return answer.trim() === expected.trim();
  }
  if (taskType === "sorting") {
    const sorted = [...taskData.numbers].sort((a, b) => a - b).join(" ");
    return answer.trim() === sorted;
  }
  if (taskType === "notes") {
    const lower = answer.toLowerCase();
    return taskData.answers.every((a) => lower.includes(a.toLowerCase()));
  }
  return false;
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n=== PRETEND TO BE AI — Task Tester ===");
  console.log("Goal: Act like a machine. Low suspicion = you fooled the system.\n");
  console.log("Tasks:");
  console.log("  1. typewriter  — Reverse a paragraph");
  console.log("  2. sorting     — Sort 5 numbers");
  console.log("  3. notes       — Name a music note\n");

  const choice = await ask(rl, "Choose a task (1/2/3 or name): ");
  rl.close();

  const taskMap = { "1": "typewriter", "2": "sorting", "3": "notes" };
  const taskType = taskMap[choice.trim()] || choice.trim().toLowerCase();

  if (!["typewriter", "sorting", "notes"].includes(taskType)) {
    console.error("Invalid task. Choose typewriter, sorting, or notes.");
    process.exit(1);
  }

  console.log(`\nConnecting to ${SERVER_URL}...`);
  const socket = io(SERVER_URL);

  await new Promise((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", (err) => reject(new Error(`Connection failed: ${err.message}`)));
  });

  console.log(`Connected. (${socket.id})`);
  socket.emit("join", { name: "TestPlayer" });
  socket.emit(`request-task:${taskType}`);

  const taskData = await new Promise((resolve) => {
    socket.once(`task-start:${taskType}`, resolve);
  });

  // Show the task
  let taskPrompt = "";
  if (taskType === "typewriter") {
    const reversed = taskData.text.split("").reverse().join("");
    console.log("\n--- TASK: DATA REVERSAL ---");
    console.log("Original : " + taskData.text);
    console.log("Reversed : " + reversed);
    taskPrompt = "Type the reversed text and press ENTER:";
  } else if (taskType === "sorting") {
    const sorted = [...taskData.numbers].sort((a, b) => a - b).join(" ");
    console.log("\n--- TASK: SORTING ---");
    console.log("Numbers : " + taskData.numbers.join(", "));
    console.log("Sorted  : " + sorted);
    taskPrompt = "Type them sorted ascending (space-separated) and press ENTER:";
  } else if (taskType === "notes") {
    console.log("\n--- TASK: MUSIC NOTES ---");
    console.log("Note symbols : " + taskData.symbols.join("  "));
    console.log("Answers      : " + taskData.answers.join(", "));
    console.log("You have 3 attempts.");
    taskPrompt = "Type the names (e.g. quarter note, flat, sharp) and press ENTER:";
  }

  // --- Notes: 3-attempt loop ---
  if (taskType === "notes") {
    let attemptsLeft = 3;
    let finalResult = null;
    const allKeystrokes = [];

    while (attemptsLeft > 0) {
      const { answer, keystrokes } = await captureKeystrokes(
        `Attempt ${4 - attemptsLeft}/3 — ${taskPrompt}`
      );
      allKeystrokes.push(...keystrokes);

      for (const ks of keystrokes) socket.emit("task-keystroke", ks);

      socket.emit("attempt-task:notes", { answer });

      const [response, suspicion] = await new Promise((resolve) => {
        let responseData = null;
        let suspicionData = null;
        const tryResolve = () => { if (responseData && (responseData.final ? suspicionData : true)) resolve([responseData, suspicionData]); };

        socket.once("attempt-result:notes", (d) => { responseData = { ...d, final: false }; tryResolve(); });
        socket.once("task-complete:notes", (d) => { responseData = { ...d, final: true }; tryResolve(); });
        socket.once("suspicion-update", (d) => { suspicionData = d; tryResolve(); });
      });

      if (response.correct) {
        console.log(`\n✓ Correct!`);
      } else {
        console.log(`\n✗ Wrong. Attempts left: ${response.attemptsLeft ?? 0}`);
      }

      if (response.final) {
        finalResult = suspicion;
        break;
      }
      attemptsLeft = response.attemptsLeft;
    }

    console.log("\n=== RESULT ===");
    console.log(`Suspicion Score : ${finalResult.score.toFixed(1)} / 100`);
    if (finalResult.verdict) console.log(`Verdict         : ${finalResult.verdict}`);
    console.log(`Correct answers : ${taskData.answers.join(", ")}`);

  } else {
    // --- Typewriter / Sorting ---
    const { answer, keystrokes } = await captureKeystrokes(taskPrompt);

    const correct = checkAnswer(taskType, answer, taskData);
    let wpmDisplay = "N/A";
    if (keystrokes.length >= 2) {
      const totalSec = (keystrokes[keystrokes.length - 1].timestamp - keystrokes[0].timestamp) / 1000;
      const wpm = (keystrokes.length / 5) / (totalSec / 60);
      wpmDisplay = `${Math.round(wpm)} WPM`;
    }

    console.log(`\nYour answer : "${answer}"`);
    console.log(`Correct     : ${correct ? "YES ✓" : "NO ✗"}`);
    console.log(`Keystrokes  : ${keystrokes.length}`);
    console.log(`Speed       : ${wpmDisplay}`);

    if (keystrokes.length < 5) {
      console.log("\nToo few keystrokes — flagged as bot behaviour (instant/minimal input).");
      console.log("Suspicion Score : 100 / 100");
      console.log("Verdict: CAUGHT. Only a machine submits without typing.");
      socket.disconnect();
      process.exit(0);
    }

    for (const ks of keystrokes) socket.emit("task-keystroke", ks);
    socket.emit(`submit-task:${taskType}`, { answer });

    const result = await new Promise((resolve) => socket.once("suspicion-update", resolve));

    const score = result.score;
    const totalSec = keystrokes.length >= 2
      ? ((keystrokes[keystrokes.length - 1].timestamp - keystrokes[0].timestamp) / 1000).toFixed(2)
      : "N/A";

    console.log("\n=== RESULT ===");
    console.log(`Total Time      : ${result.taskDurationSec !== undefined ? result.taskDurationSec + "s" : totalSec + "s (local)"}`);
    console.log(`Speed           : ${wpmDisplay}`);
    console.log(`Suspicion Score : ${score.toFixed(1)} / 100`);
    if (result.verdict) console.log(`Verdict         : ${result.verdict}`);
    console.log(`Answer Correct  : ${correct ? "YES" : "NO — humans make mistakes, AIs don't"}`);

    if (score >= 80) {
      console.log("→ CAUGHT. Unmistakably human.");
    } else if (score >= 60) {
      console.log("→ LIKELY HUMAN. Hard to fool the system.");
    } else if (score >= 40) {
      console.log("→ SUSPICIOUS. Borderline — could be either.");
    } else if (score >= 20) {
      console.log("→ HIGHLY SUSPICIOUS. Acting bot-like.");
    } else {
      console.log("→ AI. You fooled the system.");
    }
  }

  socket.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
