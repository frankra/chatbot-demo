# Chatbot Demo

A local chatbot stack: an Express + MCP orchestration API and a React chat UI.

## Running

**1. API server** (`api/`, port 3000) — requires [Ollama](https://ollama.com) with the `llama3.1` model pulled:

```bash
cd api
npm install
npm run build
npm start        # or: npm run dev (tsx watch)
```

**2. Web app** (`webapp/`, port 5173):

```bash
cd webapp
npm install
npm run dev      # → http://localhost:5173
```

The web app proxies `/api/*` to `http://localhost:3000` (see `webapp/vite.config.ts`), so no CORS setup is needed.
