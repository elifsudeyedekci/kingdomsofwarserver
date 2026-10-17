# Performance Analyst Memory Index

- [Project Tech Stack](project-tech-stack.md) — Unity 2022+ RTS mobile, NestJS backend, Next.js admin panel; performance systems in Assets/_Game/Core/Performance/
- [Performance Systems](performance-systems.md) — ThermalThrottleDetector, FramerateLimiter, MobileQualityManager, DeviceTier enum, TextureMemoryBudget, DrawCallProfiler
- [Open Thermal Issues](open-thermal-issues.md) — THERM-01 through THERM-10 tracking thermal/battery gaps identified in Phase 1 audit
- [Network Latency Analysis](network-latency-analysis.md) — Photon Fusion lockstep; RTT thresholds, buffer depth model, reconnect protocol, bandwidth budget; NET-01..NET-07 open issues
- [Memory Budget Analysis](memory-budget-analysis.md) — Full memory budget by tier, compression formats, LOD impact, audio strategy, Addressables layout, leak detection, GC, crash thresholds
- [Load Time Analysis](project-load-time.md) — Load time targets, device matrix, Addressables groups strategy, regression protocol for KoW mobile
- [Draw Call Budget](draw-call-budget.md) — Medium-tier 200-call target, Samsung A54 analysis, top risks (HealthBarPool Canvas, instancing breaks)
- [Project Performance Architecture](project-perf-arch.md) — Performance subsystem files, device tier logic, LOD and draw call system constants
- [Release Checklist](release-checklist.md) — Pre-release optimization checklist at docs/performance/optimization-checklist.md; 8 sections, hard gate thresholds (crash %, p95 frame time, load time, memory, battery)
