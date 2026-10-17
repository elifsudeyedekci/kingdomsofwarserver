---
name: project-tech-stack
description: Core technology stack and performance system file locations for Kingdoms of War
metadata:
  type: project
---

Unity 2022+ mobile RTS game (AoE IV-like). Performance systems live at:
`KingdomsOfWar/Assets/_Game/Core/Performance/`

Backend is NestJS; admin panel is Next.js. Performance analysis scope is primarily the Unity client.

**Why:** Phase 1 complete as of cbb6c0c. Phase 2 (Core Architect) in progress.
**How to apply:** All Unity performance file reads should start in `_Game/Core/Performance/`. Docs go in `C:/Projects/KingdomsOfWar/docs/performance/`.
