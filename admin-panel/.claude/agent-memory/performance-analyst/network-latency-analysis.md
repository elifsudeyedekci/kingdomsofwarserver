---
name: network-latency-analysis
description: Network latency analysis document for KoW Photon Fusion lockstep multiplayer — key thresholds, buffer depth model, reconnect protocol, bandwidth budget
metadata:
  type: project
---

Authored 2026-06-13. Located at `C:/Projects/KingdomsOfWar/docs/performance/network-latency-analysis.md`.

**Key numbers:**
- Tick interval: 50 ms, default buffer: 2 ticks, default input lag: 100 ms
- RTT green < 50 ms, yellow 50-100 ms, red > 150 ms
- Command wire size: 129 bytes (81 payload + 48 overhead)
- Incoming bandwidth typical: ~20 KB/s; burst (10 cmd/tick): ~132 KB/s
- Data per 30-min match: ~35 MB
- Max reconnect window: 60 seconds; max replay: 300 ticks (15 sec)
- Target NQS >= 85 for 95% of matches; zero tolerance on desync events

**Architecture decision recorded:** Lockstep chosen over rollback for RTS. Rollback unsuitable due to unbounded re-simulation scope (500+ entities), unpredictable opponent command prediction, and severe visual correction artifacts.

**Open issues tracked in doc (NET-01 through NET-07):**
- NET-01: LockstepDelayTicks must become dynamic (server-negotiated at match start)
- NET-02: Per-tick state hash broadcast needed in production (current SHA-256 is test-only)
- NET-04: Client-side region ping logic not yet implemented
- NET-05: Synthetic network test suite (NL-S01 to NL-S10) does not exist yet

**Relates to:** [[performance-systems]], [[open-thermal-issues]]
