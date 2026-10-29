# Chatbot Web App

A simple React + TypeScript chat UI that talks to the chatbot API in `../api`.

## Run it

1. Start the API server (separate terminal):

   ```bash
   cd ../api
   npm install
   npm run build
   npm start        # or: npm run dev
   ```

2. Start this web app:

   ```bash
   npm install
   npm run dev      # → http://localhost:5173
   ```

`/api/*` requests are proxied to `http://localhost:3000` by Vite (see `vite.config.ts`), so no CORS setup is needed. To point at a different API host, change `API_TARGET` in `vite.config.ts`.

## Scripts

- `npm run dev` — start the dev server with hot reload
- `npm run build` — type-check and produce a production bundle in `dist/`
- `npm run preview` — serve the production build (proxy stays active)
- `npm run typecheck` — TypeScript check only
