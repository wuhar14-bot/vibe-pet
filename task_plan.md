# Task Plan — Clawd Interaction Modes
*Created: 2026-03-16*

## Goal

Build a living desktop companion (Clawd) that reacts to Claude Code activity in real-time, and can be extended with new animated states on demand.

---

## Two Interaction Modes

### Mode 1 — Patch (On-Demand State Injection)
User describes a scene → Claude generates a new STATES entry → injected into `clawd_demo.html`

**Status**: ✅ Architecture ready, no build needed
**How**: User says e.g. "Clawd is celebrating" → Claude injects new state before `};`
**File**: `E:\claude-code\vibe-pet\examples\clawd_demo.html`

### Mode 2 — Live Companion (Real-Time JSONL → State)
watcher.js tails JSONL → WebSocket → live_demo.html auto-switches state

**Status**: ✅ Built (2026-03-17 Session 1)
**Startup**:
```bash
cd E:/claude-code/vibe-pet/live
node watcher.js
# open live_demo.html → blue dot = connected
```

---

## Phase Plan

| Phase | Description | Status |
|-------|-------------|--------|
| P1 | Static demo (12 states, lerp, particles) | ✅ complete |
| P2 | Live watcher + WS + live_demo.html | ✅ complete |
| P2b | Skill 升级：references/ + 质量标杆动画 night_scene.html | ✅ complete (2026-03-16) |
| P3a | End-to-end test in real Claude Code session | ⬜ next |
| P3b | Mode 1 patch examples (add new states) | ⬜ next |
| P4 | Phase 3 ideas (tray icon, overlay, always-on-top) | 🔮 future |

---

## Key Files

| File | Role |
|------|------|
| `examples/clawd_demo.html` | Mode 1 target — 12 states, manual buttons |
| `live/watcher.js` | JSONL tail → state machine → WS port 3721 |
| `live/package.json` | deps: chokidar, ws |
| `live_demo.html` | Mode 2 UI — clawd_demo + WS client + status dot |
| `skill/SKILL.md` | vibe-animation skill 定义（已升级为三层结构） |
| `skill/references/palette.json` | 官方色板 (clawd / night / day / ui) |
| `skill/references/template.html` | 每次生成的起点模板 |
| `skill/references/night_scene.html` | 质量标杆动画（夜树 + Clawd S=3 idle） |
| `PLAN_PHASE2.md` | Full architecture reference |

---

## State Machine Rules (Priority)

```
1. tool_result error            → confused
2. Write / Edit / Bash          → typing
3. Read / Grep / Glob           → thinking
4. Agent tool                   → juggling
5. >3 tools in 5s window        → juggling
6. assistant text (no tool)     → happy (3s → idle)
7. 90s idle                     → sleeping
8. 5min idle                    → disconnected
```

---

## Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-03-16 | S=3 (not S=4) | Matches 33% of SVG viewBox ratio |
| 2026-03-16 | No Express for WS | file:// open works, simpler |
| 2026-03-16 | port 3721 | Arbitrary, avoids common conflicts |
| 2026-03-16 | Particle cap = 40 | Prevents WIZARD/HAPPY particle buildup |
| 2026-03-16 | tailFile() uses readFileSync slice | Sync, no async complexity |
| 2026-03-16 | skill/references/ 三层结构 | 参考秒秒 Guo：SKILL.md + template + 质量标杆 + palette |
| 2026-03-16 | night_scene.html 用 live_demo S=3 Clawd | 保持角色绘制方法一致，场景单角色（无伴侣） |
