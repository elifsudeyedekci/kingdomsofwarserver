---
name: memory-budget-analysis
description: Memory budget by device tier, asset category budgets, texture compression, LOD memory impact, audio strategy, Addressables bundle layout, leak detection patterns, GC reduction, and crash thresholds for KoW mobile
metadata:
  type: project
---

Authored 2026-06-13. Full analysis at `C:\Projects\KingdomsOfWar\docs\performance\memory-budget-analysis.md`.

**Key decisions recorded:**

- MobileQualityManager applies two mobile platform downgrades: VRAM < 1 GB drops one tier; any mobile platform drops one additional tier. Ultra tier is unreachable on mobile.
- Effective Low tier budget: 150 MB heap, 128 MB textures, 20 MB audio, 50 MB OS reserve.
- Effective Medium budget: 300 MB heap, 256 MB textures, 40 MB audio.
- Effective High budget: 512 MB heap, 512 MB textures, 60 MB audio.
- TextureMemoryBudget.GetMaxTextureSize(): Low=512px, Medium=1024px, High=2048px. Enforced at import and runtime downsample.
- GPU instancing is mandatory for unit rendering at 20v20 scale; without it draw calls exceed the Low tier budget (150) before any other rendering.
- Addressables bundle layout: core-always, civilizations/{civ-id}, buildings/{civ-id}, terrain/{map-id}, lod0-units (dynamic), vfx-combat, audio-music, audio-sfx-{civ}.
- iOS crash thresholds: 900 MB RSS on 2 GB device, 1.4 GB on 3 GB device.
- Android crash thresholds: 700 MB on 2 GB device; no reliable pre-kill callback -- use ActivityManager.getMemoryInfo().
- Emergency demotion sequence: framerate cap 30 -> max LOD bias -> particle limit 50 -> shadows off -> release lod0-units -> GC.Collect() -> release audio bundles -> prompt restart.
- EventBus subscription leaks are highest-risk managed heap leak pattern in this codebase -- all Subscribe() calls need paired Dispose()/Unsubscribe() in lifecycle methods.

**Why:** Requested by technical-director to establish formal memory targets before art production scales to full unit/building roster. Budgets align with existing MobileQualityManager tier definitions to avoid divergence.

**How to apply:** Use these budgets as the baseline for all future per-category performance reports. Any texture or audio asset exceeding tier max sizes is a budget violation requiring artist or engineer action before it can merge to main.
