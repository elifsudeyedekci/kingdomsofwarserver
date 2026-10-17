---
name: open-thermal-issues
description: Open thermal/battery issues (THERM-01 to THERM-10) identified in Phase 1 audit, June 2026
metadata:
  type: project
---

Identified during thermal-battery-analysis.md, 2026-06-13. Assigned from `docs/performance/thermal-battery-analysis.md`.

| ID | Issue | Priority | Assignee |
|---|---|---|---|
| THERM-01 | Boost mode (120fps) not gated by thermal state | High | engine-programmer |
| THERM-02 | ApplyLevel() only adjusts FPS; no shadow/particle/LOD response | High | engine-programmer |
| THERM-03 | Recovery path does not restore shadow/particle/LOD overrides | High | engine-programmer |
| THERM-04 | No graduated recovery hysteresis (requires 2 consecutive cycles) | Medium | engine-programmer |
| THERM-05 | Android: consecutive-window confirmation to reduce false positives | Medium | engine-programmer |
| THERM-06 | Critical level triggers no player notification | Medium | engine-programmer |
| THERM-07 | iPhone 15 Pro (8GB RAM) may resolve to Medium instead of High tier | Low | engine-programmer |
| THERM-08 | Android PowerManager.getThermalHeadroom JNI supplement for Android 10+ | Low | engine-programmer |
| THERM-09 | Run 30-minute battery drain protocol on all 4 test devices | High | devops-engineer |
| THERM-10 | Critical warning copy: include screen brightness reduction suggestion | Low | technical-director |

**Why:** Phase 1 implementation covers detection and FPS throttling only. Quality-setting response to thermal state is the largest gap.
**How to apply:** When reviewing engine-programmer PRs touching ThermalThrottleDetector or FramerateLimiter, check whether these issues are being addressed.
