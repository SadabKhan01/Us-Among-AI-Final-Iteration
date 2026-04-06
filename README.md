# Us Among AI (Final Iteration)

A full-stack, realtime social deduction game pushing the boundaries of AI integration in multiplayer environments. Players figure out who among them is the rogue AI, or perhaps multiple AIs are trying to outsmart humans!

## 🚀 Tech Stack

### Frontend
- **Framework**: [Next.js 16.2](https://nextjs.org/) (App Router, Turbopack)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [Radix UI](https://www.radix-ui.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Real-time**: Socket.IO Client
- **Form/Validation**: React Hook Form with Zod

### Backend
- **Server Environment**: Node.js & Express
- **Real-time Server**: Socket.IO
- **AI Integration**: Custom implementation utilizing the `@google/generative-ai` SDK (`gemini-pro` / Gemini 1.5 Series)
- **Language**: TypeScript

## 🎮 Getting Started

Both frontend and backend need their dependencies installed separately.

### 1. Start the Backend

```bash
cd backend
npm install
npm run dev
```

> **Note**: The backend requires environment variables for standard usage and AI integrations. Ensure you create a `.env` file referencing any required secret keys (e.g. `GEMINI_API_KEY`). By default, it will run on `http://localhost:3002`.

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

> The Next.js frontend will run by default on `http://localhost:3001`.

## 🧠 About The Project

This is the final iteration of **Us Among AI**, created to test how Large Language Models (LLMs) can seamlessly integrate directly as live human impersonators within a standard multiplayer social deduction web experience. Good luck figuring out who is real!