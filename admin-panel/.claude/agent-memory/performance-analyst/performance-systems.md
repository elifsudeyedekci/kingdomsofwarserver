---
name: performance-systems
description: Summary of all implemented performance management systems and their key constants/behaviors
metadata:
  type: project
---

All singletons use DontDestroyOnLoad and a standard Instance guard.

**ThermalThrottleDetector.cs**
- Enum: ThermalLevel { Nominal=0, Fair=1, Serious=2, Critical=3 }
- iOS: polls `UnityEngine.iOS.Device.thermalState` every 2s
- Android: frame-spike heuristic over 60-frame window, SPIKE_THRESHOLD_MS=20, SERIOUS_RATIO=0.25, CRITICAL_RATIO=0.50
- On Serious/Critical: calls FramerateLimiter.SetTarget(30) — does NOT yet adjust shadows/particles/LOD
- Recovery: calls FramerateLimiter.ApplyForTier(MobileQualityManager.CurrentTier)
- Fires: OnThermalWarning event

**FramerateLimiter.cs**
- FPS_BACKGROUND=30, FPS_BOOST=120, FPS_DEFAULT=60, BOOST_DURATION=30s
- ApplyForTier: Low→30fps, all others→60fps
- BoostMode: 120fps for 30s then reverts; not gated by thermal state (gap: THERM-01)
- OnApplicationFocus(false): caps to 30fps

**MobileQualityManager.cs**
- DeviceTier: Low, Medium, High, Ultra
- DetectTier: RAM-based (<2GB Low, <4GB Medium, <4GB High, else Ultra), -1 tier for VRAM<1GB, -1 tier for mobile platform
- Low: FPS=30, shadows=Disable, AA=0, lodBias=0.5
- Medium: FPS=30, shadows=HardOnly, AA=0, lodBias=0.75
- High: FPS=60, shadows=All, AA=2x, lodBias=1.0
- Ultra: FPS=-1(platform max), shadows=All, AA=4x, lodBias=1.5

**TextureMemoryBudget.cs (static)**
- GetMaxTextureSize: Low=512, Medium=1024, High=2048, Ultra=4096
- GetLODBias: Low=0.5, Medium=0.75, High=1.0, Ultra=1.5
- GetMaxParticles: Low=50, Medium=200, High=500, Ultra=1000
- GetMaxDrawCalls: Low=150, Medium=300, High=500, Ultra=1000

**MobileLODManager.cs**
- Singleton, DontDestroyOnLoad. Requires LODBudget ScriptableObject ([SerializeField]); falls back to GetDefaultBiasForTier().
- FrameHistorySize=30 frames rolling average. IsUnder60FPS = averageFrameMs > 16.67f (public bool, other systems can poll).
- TryAdjustBias(): DynamicCooldown=2.0s; step=0.1; OverBudgetMs=33.0ms.
  GAP: OverBudgetMs is 33ms (30fps territory), not 16.67ms. LOD won't increase aggressively until already at 30fps.
  Consider whether it should be ~20ms for a 60fps target.

**LODBudget.cs** (ScriptableObject, MenuName "KoW/Performance/LOD Budget")
- Tier bias values: Low=2.5, Medium=1.8, High=1.2, Ultra=0.8
- dynamicAdjustStep=0.1, minBias=0.5, maxBias=3.0, targetFrameMs=16.67
- CONFLICT: LODBudget and TextureMemoryBudget.GetLODBias() define OPPOSITE scales.
  LODBudget > 1.0 on Low (more aggressive = lower quality); TextureMemoryBudget < 1.0 on Low (same direction, different convention).
  MobileLODManager uses LODBudget; MobileQualityManager uses TextureMemoryBudget. Last writer wins.
  This must be reconciled before ship.

**DrawCallProfiler.cs**
- EDITOR/DEVELOPMENT_BUILD only — stripped from release
- Tracks FPS (0.5s interval), heap MB, Mono MB
- Warning/Critical thresholds are draw-call named but actually fire on heap MB
- Default warning=500MB, critical=1000MB -- far above mobile per-tier memory budgets (512MB max on Low).
  These thresholds need lowering for meaningful mobile alerts.

**FramerateLimiter vs MobileQualityManager inconsistency on Medium tier:**
- FramerateLimiter.ApplyForTier(Medium) -> 60fps
- MobileQualityManager.ApplySettings(Medium) -> 30fps
- Both run at different times; last call wins. Needs resolution.
