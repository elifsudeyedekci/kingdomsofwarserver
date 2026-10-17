# Kingdoms of War - server (backend, admin panel, database, deploy)

Everything that runs on the server. The game (Unity client, Codemagic iOS build) lives in the separate repo `KingdomsOfWar`.

| Folder | What |
|---|---|
| `admin-backend/` | NestJS API (game + admin), jest tests, e2e smoke scripts in `scripts/` |
| `admin-panel/` | Next.js admin panel |
| `database/` | Prisma schema + migrations (`0001_baseline`) |
| `deploy/contabo/` | Docker Compose + Caddy HTTPS + backups. See its README |
| `game-data/` | Snapshot of the game's shipped data (Balance, Civilizations, Localization, UI) used by the panel's "import shipped data" button. Copy it from the game repo's `KingdomsOfWar/Assets/StreamingAssets/Data/` when the shipped data changes |
| `landing-website/`, `deployment/`, `k8s/`, `infrastructure/` | older website and deployment material |

Install on Contabo: `deploy/contabo/README.md`. Local dev: `make install`, then see `admin-backend/.env.example`.
