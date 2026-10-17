---
name: release-checklist
description: Mobile release readiness optimization checklist — location, structure, gate thresholds, and what it supersedes
metadata:
  type: project
---

Created 2026-06-13. Located at `C:\Projects\KingdomsOfWar\docs\performance\optimization-checklist.md`.

**Document purpose:** Comprehensive pre-release checklist covering all performance disciplines.
Intended to be worked through per build before App Store / Google Play submission.

**8 sections:** Rendering, CPU Simulation, Memory, Network, Load Times, Thermal & Battery,
Platform-Specific (iOS Metal / Android Vulkan), Release Gate Metrics.

**Hard release gate thresholds ([GATE] items):**
- Crash-free rate: >99.0% (Firebase Crashlytics, min 500-session sample)
- Frame time p95: <=20ms on mid-range (60fps target); <=40ms on low-end (30fps)
- Match load time: <=8s on mid-range, <=15s on low-end
- Memory: <=1.5GB on mid-range (4 GB RAM device), <=800MB on low-end (3 GB RAM device)
- Battery drain: <=20% per hour at medium settings, <=15% per hour at low settings
- iOS IPA base download: <=150MB after App Thinning
- Android base APK: <=100MB (additional content via Play Asset Delivery)
- Android ANR rate: 0 per 1000 sessions

**Key cross-references to existing memory:**
- Draw call target: 200 per frame in 4v4 (consistent with [[draw-call-budget]] Medium tier)
- Network command bundle: <=256 bytes per tick per 4-player match (consistent with [[network-latency-analysis]] 129-byte command size)
- Load time gate: 8s / 15s (consistent with [[project-load-time]] targets)
- Texture compression: ASTC for Android + iOS; ETC2 RGBA8 OpenGL ES3 fallback (consistent with [[memory-budget-analysis]])
- Addressable group layout specified (consistent with [[memory-budget-analysis]] bundle layout)

**Physical test device matrix referenced in checklist:**
- Android mid: Samsung Galaxy A53 (Exynos 1280)
- Android low: Xiaomi Redmi 9 (Helio G85, OpenGL ES3 fallback)
- Android high: Samsung Galaxy S23 (Snapdragon 8 Gen 2, Vulkan)
- iOS mid: iPhone 12 (A14)
- iOS low/min: iPhone SE Gen 2 (A13)
- iOS tablet: iPad Pro 12.9" 4th gen (A12X)

**Why:** Requested by user to consolidate all optimization checks into a single actionable release gate document before mobile submission.
**How to apply:** Reference this doc when reporting release readiness status to Technical Director. Any [GATE] item failure is a release blocker — escalate immediately, do not waive without TD approval.
