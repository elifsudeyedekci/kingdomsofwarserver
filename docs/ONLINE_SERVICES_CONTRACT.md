# Online services contract (2026-10-09)

`KoW.Network.Backend.OnlineServices` (Assets/_Game/Network/Backend/OnlineServices.cs) is the only place the game talks to ranked / matchmaking / rewards.
- Interfaces: `IMatchmakingService` (enqueue, cancel, poll, veto), `IRankingService` (rating per queue/season), `IRewardService` (list, claim).
- Default `NotConfiguredServices`: every call returns `Unavailable` with no data. Nothing is simulated - no fake queue, rank or reward.
- A real backend registers with `OnlineServices.Register(...)`; it must be server-authoritative (rating, queue, veto outcome, reward grants, result reporting by the match server).
- Queue ids, map pools and seasons are data: `Data/UI/map_pool.json`, `Data/UI/seasons.json` (catalogue ships empty). Reference facts (CONFIRMED): ranked pool is server-side, veto 4 maps (1v1/teams) / 1 (FFA).
- UI use today: the profile shows a rating only when a service is registered and answers; otherwise "Unranked".
- Tests: `ParityTests5` (unavailable by default, partial registration never faked).
Existing `BackendClient` (login, profile, result report) is unchanged.

## Update 2026-10-10: a real implementation exists
- **Server** (`admin-backend/src/modules/matchmaking`, NestJS, registered in `app.module.ts`): `POST /matchmaking/enqueue`, `GET /matchmaking/:ticketId` (poll; `{match:null}` while waiting), `POST /matchmaking/:ticketId/veto`, `DELETE /matchmaking/:ticketId`. Server-authoritative: pairs by rating (window 100 + 25 per waiting second, cap 600), balances teams by snake order, applies the vetoes (4 in 1v1/team queues, 1 in FFA, CONFIRMED reference facts), picks the map from the server pool, creates the match record through the existing `MatchService` (whose Elo update already runs on result). Jest: `matchmaking.service.spec.ts` (6 tests, pairing/window/teams/veto limits/cancel/map pick).
- **Client** (`KoW.Network.Backend.HttpOnlineServices`): implements `IMatchmakingService` + `IRankingService` over HTTP (bearer token, 3 s timeout); rating comes from `GET /player/:id` (`profile.mmr/currentRank/wins/losses`). `BackendClient` registers it as soon as a token exists. Transport failures are `Unavailable`/`Error`, never invented data. Tests: `ParityTests10` against a local HTTP server with the same JSON (real sockets).
- **Rewards:** `admin-backend/src/modules/rewards` (GET `/rewards/me`, POST `/rewards/me/:id/claim`): season tiers bronze..master earned by the PEAK rating of the active season, claim is idempotent and writes a `player_inventory` row (`season_reward`); jest `rewards.service.spec.ts`; client side `HttpOnlineServices` implements `IRewardService` (lists earned ones).
- **Still not provided:** match-server result reporting for ranked (the relay / dedicated match server is deployment work); a hosted instance (needs Postgres/Redis, see `docker-compose.yml`).

### Result reporting (consensus), 2026-10-10
`POST /matchmaking/match/:matchId/report` `{winnerUserIds, durationTicks, dataHash}`: every player of a finished lockstep match reports the winners and the hash of the final simulation state. The server records the result (-> `MatchService.recordResult` -> Elo update) only when ALL reports agree; a deterministic simulation gives the same hash on every honest client, so a cheater cannot move the rating alone. Disagreement = `disputed` (nothing recorded); players that never report within 120 s count as disconnected when the reports present agree. Client: `HttpOnlineServices.ReportResult`. Jest: 3 consensus tests (9 in the file). NOT wired yet: the in-game queue screen that stores the `MatchFound.MatchId` and calls `ReportResult` at `MatchEndedEvent`; a dedicated match server / relay endpoint (deployment).
