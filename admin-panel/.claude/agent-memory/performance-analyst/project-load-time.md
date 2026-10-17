---
name: project-load-time
description: Load time targets, device test matrix, Addressables group strategy, and regression protocol for Kingdoms of War mobile
metadata:
  type: project
---

Load time analysis document created at docs/performance/load-time-analysis.md (2026-06-13).

**Key targets:**
- Cold start to main menu: 5s target / 7s hard limit
- Main menu to lobby: 2s / 3s
- Match start to first playable frame: 8s / 10s (reference); 12s / 15s on Galaxy A32
- Mid-game streaming per chunk: 0.5s / 1.0s

**Why:** These targets are set to maintain D1 retention. >8s cold start correlates with elevated uninstall rates in the RTS genre.

**How to apply:** Any perf recommendation or CI gate proposal should be checked against these targets. Escalate target changes to Technical Director only.

**Slow-device floor:** Samsung Galaxy A32 (2020) — Helio G80, 4 GB RAM, eMMC 5.1. Quality.Low tier path.

**5-device test matrix:** DEV-A (A32), DEV-B (A53), DEV-C (Redmi Note 12 Pro), DEV-D (iPhone SE 3rd gen), DEV-E (iPhone 15).

**Regression CI gate:** >10% regression vs baseline blocks merge. Technical Director must waive. >25% = no waiver without root cause.

**Critical open issues:** LT-001 (shader warmup), LT-002 (no asset variants yet), LT-005 (no CI device farm yet), LT-007 (lobby preload not implemented).

**Asset sizes (estimates):** civ-full bundle ~35 MB each; map bundle ~80 MB. Worst-case match load ~255 MB decompressed resident.
