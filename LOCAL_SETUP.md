# Local Setup

This project includes a local Node.js dev server (`scripts/local-dev-server.mjs`) so the browser app can call the Strava API routes in `api/` without deploying to Vercel.

## Prerequisites

- Node.js 18+
- A Strava account
- A Strava Developer App

## Strava OAuth Setup

1. In the Strava developer dashboard, create or open your app.
2. Set the app's callback domain to `localhost` for local development.
3. Copy the app's client ID and client secret.
4. Copy the example environment file:

```bash
cp .env.example .env.local
```

5. Fill in `.env.local`:

```bash
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
```

These two variables are the only ones declared in `.env.example`. Do not commit `.env.local`.

## Run Locally

```bash
npm install
npm run dev
```

`npm run dev` runs `node scripts/local-dev-server.mjs`. The script:

- Serves any static file from the repository root.
- Dynamically imports the matching module in `api/` for any request to `/api/*` and invokes its default export as a Vercel-style handler. Modules are re-imported per request, so edits to handlers take effect without restarting the server.
- Reads `.env.local` so the Strava credentials are available to the serverless modules.
- Listens on `PORT` (default `3001`). Override with `PORT=4000 npm run dev`.

Open the local URL printed by the dev server, then click Connect with Strava.

### Demo mode (no Strava account required)

The connect screen exposes a demo button that calls `loadDemoData()` in `js/app/auth.js`. This sets `localStorage('strava_demo_mode') = 'true'` (read everywhere through `isDemoMode()` in `js/demo/index.js`), synthesises ~250 sample activities through `js/demo/generator.js`, and installs a fake `demo_` token. Click the disconnect / logout control to clear the demo flag and the synthetic data.

If you switch to a different Strava app, clear the browser `localStorage` key named `strava_tokens` and sign in again.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `/api/strava-auth` returns 404 | Start the app with `npm run dev`; opening `index.html` directly will not run API functions. |
| Port 3001 already in use | Run `PORT=4000 npm run dev` (or any other free port). |
| Missing `STRAVA_CLIENT_ID` | Check that `.env.local` exists, contains `STRAVA_CLIENT_ID`, and restart `npm run dev`. |
| Strava auth failed | Confirm the frontend client ID and backend client secret belong to the same Strava app. |
| Token or cache issues | Clear `strava_tokens` and `strava_cache_version` from browser `localStorage`, then sign in again. |
| Stale derived fields after upgrade | Clear `strava_cache_version`; `js/app/main.js` invalidates cached preprocessed activities when this key does not match the current `CACHE_VERSION`. |
| CDN charts do not load | Check network access to jsdelivr, unpkg, and d3 resources. |
