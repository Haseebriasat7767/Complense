# ComplyLens AI — Demo & Explainer Video

**Deliverable:** `demo/complylens-demo-video.mp4` — 2:48, 1280×720 @ 30 fps, narrated (H.264 + AAC, ~16 MB).
**Narration clips:** `demo/audio/s00…s09` (voice-00). Rebuild with `/home/user/tools/render.py`.

The video opens with the **problem companies face**, then proves — with real captures of the
running product (headless Chromium driving the live app) — **how ComplyLens AI solves it**.

| # | Audio clip | Visual | Beat |
|---|-----------|--------|------|
| 0 | s00-open | Title card: logo, name, tagline, capability chips | “Two frameworks, fifty controls…” |
| 1 | s01-problem | Problem slide, staggered bullets + red “THE SCRAMBLE” stamp | Evidence in 10+ tools, spreadsheet controls, six-figure consultants, gaps found by the auditor |
| 2 | s02-meet | Live: landing hero → click **Try the Demo** → dashboard | One click, no sign-up / API keys / credit card |
| 3 | s03-dashboard | Live dashboard pan; on-screen chips answer “are we ready?” | Chips show live figures: **SOC 2 94% Strong · ISO 27001 84% · 18 passed · 10 open findings** |
| 4 | s04-evidence | Live evidence list → document analysis detail | Classify, summarise, flag needs-review / failed |
| 5 | s05-mappings | Live controls library → evidence→control mapping | 28 SOC 2 TSC + 22 ISO 27001 Annex A, confidence scores |
| 6 | s06-gaps | Live gap list (critical→low) → gap detail | Recommended fix, suggested owner, timeline per finding |
| 7 | s07-reports | Live reports → SOC 2 Readiness Assessment detail | Branded PDF, 12 sections, score components |
| 8 | s08-resolve | Resolution slide: problem → solution rows | Scramble becomes a plan |
| 9 | s09-end | End card | “Know what's missing before the auditor does.” |

## Accuracy notes
- All app screens are genuine captures of the running demo workspace (AcmeCloud, labelled Demo Data), taken by Puppeteer clicking through the real UI at record time.
- Scene 3 narration was cut (verified by offline speech recognition at the 4.52–4.87 s silence) to the question “are we ready?”; the current live figures are shown on screen instead, so nothing spoken ever contradicts the screen.
- Figures shown (94% / 84% / 23 of 28 reviewed / 18 passed / 10 open) are the engine's current deterministic output for the seeded evidence set.
