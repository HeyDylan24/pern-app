# PERN starter

PostgreSQL + Express + React (Vite) + Node. Includes a working todos CRUD example.

## Setup
1. Install Node 20.6+ and PostgreSQL, then create a database:
   `createdb pern_app` (or create it in pgAdmin).
2. Configure the server:
   `cp server/.env.example server/.env` (Windows: `copy server\.env.example server\.env`)
   and edit `DATABASE_URL` with your Postgres password.
3. Install everything: `npm run install:all`
4. Create the table: `npm run db:init`
5. Start both apps: `npm run dev`

- Web: http://localhost:5173
- API: http://localhost:5000/api/health

## Layout
- `server/` Express API (`routes/`, `db.js`, `schema.sql`)
- `client/` React app; Vite proxies `/api` to the server

## Deploy (free): Neon + Render
1. Create a Neon project and copy its connection string.
2. Push this repo to GitHub.
3. On Render, create a Web Service from the repo:
   - Build command: `npm run build`
   - Start command: `npm start`
   - Environment variable: `DATABASE_URL` = your Neon connection string
   - Instance type: Free
The server serves the built React app and creates the table on first start.
