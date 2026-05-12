# Skyfall Royale

Browser-based third-person battle royale prototype: **React Three Fiber** client, **Node.js + Socket.IO** authoritative server, optional **MongoDB** for stats.

## Prerequisites

- Node.js 20+ and npm
- (Optional) MongoDB URI for persistent player stats — without `MONGODB_URI`, stats are skipped.

## Install

From the **project root** (`game/`) — required for npm workspaces so `vite` and other bins resolve correctly:

```bash
npm install
```

On Windows PowerShell, if `npm` is blocked by execution policy, use **`npm.cmd`** instead of `npm`.

Or install each workspace explicitly:

```bash
cd server && npm install
cd ../client && npm install
```

If you see `'vite' is not recognized`, dependencies were not installed: run `npm install` (or `npm.cmd install`) from the **root** folder first, wait until it finishes without errors, then run the client again.

## Run locally (development)

Terminal 1 — game server (default port **3333**):

```bash
cd server
npm run dev
```

Terminal 2 — Vite client (default port **5173**):

```bash
cd client
npm run dev
```

Open **http://localhost:5173**. The client expects the API at `http://localhost:3333` by default (`client/src/net/clientSocket.ts`).

Optional — override server URL:

```bash
# client/.env.local
VITE_SERVER_URL=http://localhost:3333
```

Optional — server CORS / DB:

```bash
# server — environment variables
set CLIENT_ORIGIN=http://localhost:5173
set MONGODB_URI=mongodb://localhost:27017/skyfall
set PORT=3333
```

## Production build

```bash
cd client && npm run build
cd ../server && npm run build && npm run start
```

Serve the client `dist/` with any static host (e.g. Vercel) and point `VITE_SERVER_URL` at your deployed Socket.IO server.

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move |
| Shift | Sprint |
| Space | Jump |
| Mouse | Look (click canvas for pointer lock) |
| LMB | Fire (hold for full auto on AR) |
| RMB | Aim down sights (zoom; strongest on sniper) |
| 1–4 | Weapon slots |
| R | Reload |
| B | Emote (broadcast) |

## World & combat (prototype)

- **Trees / rocks / ruins**: server-side collision (push-out + bullet blocking). Client visuals still use instanced meshes without Rapier — you may see tiny desync until the next snapshot.
- **Storm**: translucent vertical wall + HUD banner; damage still applies outside the cylinder radius on the server.
- **Tracers**: originate near the character muzzle and stop at the first terrain **or** prop hit along aim (client-only FX).

## Architecture notes

- **Server** (`server/src/GameRoom.ts`): Fixed tick (~20 Hz), movement, hitscan + RPG projectiles, storm ring, air drops, damage, win condition.
- **Client**: Renders terrain, instanced props, third-person camera from snapshots, HUD, procedural audio (no binary asset files required).

Terrain mesh on the client is **visual-only**; authoritative ground + **prop collision** live on the server (`terrain.ts` + `propColliders.ts`).
