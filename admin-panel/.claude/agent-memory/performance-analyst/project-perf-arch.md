---
name: project-perf-arch
description: Performance subsystem files, device tier logic, LOD and draw call systems in Unity codebase
metadata:
  type: project
---

The entire performance subsystem lives under `Assets/_Game/Core/Performance/` in the Unity project.

Key files:
- `DeviceTier.cs` — enum: Low, Medium, High, Ultra
- `MobileQualityManager.cs` — detects tier from RAM/VRAM, applies QualitySettings per tier; mobile platform applies -1 tier penalty. Samsung A54 resolves to Medium.
- `MobileLODManager.cs` — drives `QualitySettings.lodBias` dynamically using a 30-frame rolling average; adjusts every 2s with DynamicCooldown. Uses `LODBudget` ScriptableObject for per-tier starting bias values.
- `LODBudget.cs` — ScriptableObject: lowBias=2.5, mediumBias=1.8, highBias=1.2, ultraBias=0.8; dynamicAdjustStep=0.1, minBias=0.5, maxBias=3.0.
- `TextureMemoryBudget.cs` — static helper with GetMaxDrawCalls (Low=150, Medium=300, High=500, Ultra=1000), GetMaxParticles (Low=50, Medium=200, High=500, Ultra=1000), GetMaxTextureSize, GetLODBias.
- `DrawCallProfiler.cs` — UNITY_EDITOR/DEVELOPMENT_BUILD only overlay; currently tracks heap memory and FPS, not actual draw calls (note: draw call count not accessible via public Unity runtime API).
- `FramerateLimiter.cs` — SetTarget, ApplyForTier (Low=30fps, others=60fps), BoostMode; backgrounds at 30fps.
- `ThermalThrottleDetector.cs` — iOS: uses native thermal state. Android: frame spike ratio over 60 samples; Serious at 25%, Critical at 50% spikes >20ms. Forces 30fps on Serious/Critical.

**Why:** needed for every performance analysis task involving draw calls, memory budgets, or frame rate.
**How to apply:** always cross-reference these files when making budget recommendations or regression assessments. Numbers in the code are authoritative over any prior estimate.
