# florr3d

A 3D reimagining of [florr.io](https://florr.io), a top-down/first-person
petal-collecting survival game, built with Three.js, Node, and WebSockets.

> **Unofficial fan project.** florr3d is not affiliated with, endorsed by,
> or sponsored by florr.io or its creators. It's an independent reinterpretation
> built for fun; some petal/mob stats and descriptions are referenced from the
> [florr.io wiki](https://florr.fandom.com) for gameplay-balance purposes.

## Features

- Authoritative server simulation (Node + `ws`) with a binary, delta-encoded
  snapshot protocol. The client is a pure renderer over server state.
- Petal-orbit combat system: rarity-scaled stats, projectile petals, passive
  healers, and a wing+bubble flight pair (glide + rocket-pop thrust)
- Procedural and `.glb` mob models (bee, hornet, ladybug, ant family) with
  toon shading, baked volumetric clouds, and instanced grass
- Biome-tiled world with a wall/collision grid, built via an included
  map-builder tool (`tools/map-builder.html`)
- Top-down and first-person camera modes, proximity chat, minimap,
  spectator mode, and optional Discord-login account persistence

## Getting started

```bash
npm install
npm run dev
```

This starts Vite's dev server with the game server (WebSocket + auth +
map routes) attached to it. Open the URL Vite prints (usually
`http://localhost:5173`) and you're playing against a local server, no
separate process needed.

### Production

```bash
npm run build     # bundles the client into dist/
npm run server    # runs the standalone game server (server/index.js)
```

The standalone server needs a static file server (or a reverse proxy like
Caddy/nginx) in front of it to serve `dist/`, plus WebSocket upgrade support
for `/ws`.

### Environment variables

All optional. The game runs with sensible defaults if none are set.

| Variable | Purpose |
|---|---|
| `PORT` | HTTP/WS port for the standalone server (default `8081`) |
| `MAP_PATH` | Path to a map JSON file (default: bundled `map.json`) |
| `DB_PATH` | SQLite path for account saves (default: `accounts.db` in the repo root) |
| `SESSION_SECRET` | Signs login session cookies. Unset = random per boot (sessions don't survive a restart) |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_REDIRECT_URI` | Enables Discord OAuth login + save persistence. Unset = guest-only, no persistence |
| `DISCORD_BOT_TOKEN` / `DISCORD_ULTRA_CHANNEL_ID` | Optional: posts an announcement when a top-rarity mob spawns |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile human-check before joining. Unset = disabled (fine for dev/local play) |
| `DEV_AUTH` | Set to `1` for a fake login without Discord (local testing only) |
| `DEV_STARTER_PETALS` | e.g. `wing:2,bubble:2`, grants inventory items on join, for testing (dev only, never set in prod) |

### Deploying to GitHub Pages

A workflow at `.github/workflows/deploy.yml` builds and publishes the
client to GitHub Pages on push to `main`. By default it falls back to an
in-browser worker simulation (no real multiplayer); set the repo variable
`GAME_SERVER_URL` (Settings, Secrets and variables, Actions, Variables)
to a `wss://` URL to point the Pages build at a real hosted server instead.

## Project layout

```
client/    three.js renderer, input, UI, HUD
server/    authoritative simulation: players, mobs, combat, petals, world
shared/    config/constants and the binary wire protocol, imported by both sides
tools/     map builder, asset decimation pipeline, dev scripts
```

`shared/config.js` is the single source of truth for anything both sides
need (stats, timings, rarities), never duplicated on either side.

Note: `client/assets-src/` (the original, pre-decimation `.glb` source
models) isn't included in this repo, only the optimized models in
`client/assets/` that the client actually loads. `tools/decimate.mjs` is
the pipeline used to produce them, if you want to regenerate optimized
models from your own source assets.

## License

[CC BY-NC 4.0](LICENSE): free to use, share, and modify with attribution,
**non-commercial only**. Want to use this commercially? Open an issue or
reach out, happy to talk about it.
