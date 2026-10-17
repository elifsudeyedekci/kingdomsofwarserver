---
name: draw-call-budget
description: Draw call budget analysis results — Medium tier 200-call target, Samsung A54, 20v20 battle scenario
metadata:
  type: project
---

Document written: `C:/Projects/KingdomsOfWar/docs/performance/draw-call-budget.md`

Key findings:
- Samsung A54 resolves to Medium tier (High by RAM, -1 for mobile platform, VRAM shared so no second penalty).
- Medium working budget: 200 draw calls per frame during 20v20 battle.
- Estimated actual calls at mid-game: ~141 enumerated + ~30 URP internal = ~171 total. 14.5% headroom.
- Units are the largest single source (~48 calls) but GPU instancing is the highest-leverage optimization.
- Shadows add 26 calls and are the single largest emergency lever (disabled on Low tier automatically).

Critical risks identified:
1. `HealthBarPool` — if each pool entry uses an independent Canvas, draw calls jump by up to +80. Must use a single shared world-space Canvas.
2. Unit color variation must use `MaterialPropertyBlock` (pattern already established in `SelectionRingPool`), not material instances — breaking instancing costs ~8x more draw calls.
3. Overdraw from death-smoke particle systems (alpha-blend) should be capped at 4 simultaneous on Medium; switch to cutout shader.
4. `DrawCallProfiler` does not currently track draw calls (only heap MB) — needs extension for actual draw call reporting.

Thermal throttle chain on A54: ThermalThrottleDetector Serious → FramerateLimiter 30fps → (needs manual wiring) MobileQualityManager Low tier → shadows disabled + LOD bias max → floor ~90 draw calls.

**Why:** baseline for all future regression comparisons and optimization prioritization.
**How to apply:** reference these estimates when reviewing new feature PRs or art asset imports that add renderers.
