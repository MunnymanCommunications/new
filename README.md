# VibeCraft - AI App Builder Platform

A full-stack AI-powered web application builder that transforms natural language prompts into production-ready React applications.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **State:** Zustand, TanStack Query
- **AI:** Anthropic Claude API (streaming)
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **Version Control:** GitHub API two-way sync
- **Deployment:** Vercel / Netlify one-click deploy

## Quick Start

```bash
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```
VITE_ANTHROPIC_API_KEY=your_key
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
VITE_GITHUB_TOKEN=your_token
```

## Features

- Split-panel layout: Chat (35%) + Live Preview (65%)
- Conversational AI code generation with streaming responses
- Live preview with responsive device switching
- Visual editor with property inspector
- Virtual file system and code viewer
- Supabase, GitHub, and deployment integrations
- Credit-based usage system
- Dark mode with glassmorphism design
