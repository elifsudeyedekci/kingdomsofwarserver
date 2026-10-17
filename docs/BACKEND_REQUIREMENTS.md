# Backend requirements (2026-10-09)

Server logic is not expected in the local files and was not searched for. This lists what *we* must build. Interfaces already exist client-side: `KoW.Network.Backend.OnlineServices` (see `ONLINE_SERVICES_CONTRACT.md`), `BackendClient` (login/profile/result), `Lockstep` transports (loopback, TCP), Photon Fusion code paths.

| Feature | Local client UI | Client game logic | Backend API | Real-time network | Auth / entitlement | Server authority / anti-cheat |
|---|---|---|---|---|---|---|
| Ping / taunt | ping wheel + taunt list (data: `ui_ping` attack/defend/question, 122 taunts + audio events exist) | ping marker view, taunt sound | none | **yes**: relayed as a non-simulation command through the lockstep/relay channel to allies | session membership | rate limit, mute lists, team-only scope |
| Lobby (custom/MP) | exists (ready, kick, ping, password) | exists | room list / join / host migration | **yes**: relay or P2P, chat | account, ban | server validates start conditions, kicks |
| Matchmaking (quick/ranked/team) | queue screen, map veto (4 / 1 picks) | none | **yes**: enqueue/poll/cancel, region, party | server picks relay + map, match start handshake | account, platform entitlement per civ/DLC | server owns MMR, queue rules, veto outcome |
| Ranked rating / ladders | profile rank, season screen | none | **yes**: rating, tiers, leaderboard, seasons | result submission by the match server | account | server-authoritative results; client results never trusted; anti-smurf |
| Rewards / seasons / battle pass | reward list/claim UI | none | **yes**: grants, inventory, claim | - | account + purchase receipts | server-only grants, idempotent claims |
| Replays / observers (MP) | replay viewer exists (SP) | deterministic lockstep (done) | replay storage | spectator stream | account | signed replays |
| Anti-cheat / desync | desync banner | state-hash checkpoints (done) | report endpoint | hash exchange per tick window | - | server compares hashes, sanctions |
| Entitlements (DLC civs) | civ gallery locks (done) | `Entitlements` (done) | **yes**: store/receipt validation | - | platform stores | server-side ownership check at match start |

## Independent backend scope (what to implement)
1. Identity service (accounts/platform ids, tokens) + entitlement check.
2. Matchmaking service (queues per mode from data, region ping, party, map-veto, relay allocation).
3. Rating service (Elo/Glicko variant: ours, not Relic's - formula UNKNOWN), seasons data (`seasons.json`), leaderboards.
4. Match service: relay/authoritative server for lockstep hash arbitration, result signing, replay upload.
5. Rewards/inventory service (idempotent grants).
6. Social: chat, mute, ping/taunt relay (+ rate limits), friends/invites.
7. Telemetry/anti-cheat pipeline.
Prerequisites on the client: transport that works beyond loopback/TCP (relay), reconnection (exists partly: `ReconnectManager`), signed result reports.
Confidence: scope CONFIRMED as necessary (requirements derived from the reference UX); numeric rules (MMR formula, queue timings, reward tables) UNKNOWN and must be our own design.
