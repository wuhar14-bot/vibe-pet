# Findings — Clawd Vibe-Pet Research
*Created: 2026-03-17*

---

## Clawd Character Specs

- **Grid**: 15×16 pixel grid, S=3 (3px per cell)
- **Buffer**: 200×150 canvas → scaled to 400×300 display
- **`imageSmoothingEnabled = false`** — pixel-perfect rendering
- **Body color**: `#DE886D` (official), dimmed `#8B4A38` (offline state)
- **Eye color**: `#000000` normal, `#334` sad (disconnected)
- **Origin**: `github.com/marciogranzotto/clawd-tank` (ESP32 hardware pet)

---

## JSONL File Format (Claude Code)

**Location**: `C:\Users\harwu\.claude\projects\**\*.jsonl`

Three line types matter:
```json
{ "type": "user", "message": { "role": "user", ... } }
{ "type": "assistant", "message": { "role": "assistant", "content": [
    { "type": "tool_use", "name": "Write", "input": {} },
    { "type": "text", "text": "..." }
]}}
{ "type": "tool", "content": [
    { "type": "tool_result", "tool_use_id": "...", "content": "..." }
]}
```

**Tool classification**:
- WRITE_TOOLS: `Write, Edit, NotebookEdit, Bash`
- SEARCH_TOOLS: `Read, Grep, Glob, WebFetch, WebSearch`

---

## Animation System Findings

### lerp smoothing
All state transitions use `lerp(current, target, 0.09 * dt)` — smooth ~60 frame transition.

### Bounce physics (fixed 2026-03-16)
- `bounceY` = upward displacement (positive = up)
- Gravity: `bounceV += 0.4 * dt` (was -= causing infinite upward)
- Reset: `if (bounceY >= 0) { bounceY=0; bounceV = -(str + rand) }`
- Render: `by(y) = gy(y) + jy - bounceY` (subtract, not add)

### Particle system
- `emit(x, y, options)` → `parts[]` array
- `P` class: vx, vy, life, decay, sz, color, type (sq/star/ball)
- Hard cap: `if (parts.length < 40) D.spawn(A.t)`
- Density fix: halved spawn rates + faster decay (dc 0.016 → 0.028)

### Prop system
- Props fade in/out via `A.propO` (lerp 0→1)
- Drawn only when `A.propO > 0.02`
- Available: laptop, bubble, zzz, qmarks, alert, juggle, smoke, wizard, offline, broom

---

## Vibe Animation Skill — 三层结构规范

参考秒秒 Guo 的 clawd-animation skill 设计。

### 目录结构

```
skill/
├── SKILL.md              ← 给 Claude 看的工作手册（命令式语气，不是教程）
└── references/
    ├── palette.json      ← 官方色板（clawd / night / day / ui）
    ├── template.html     ← 每次生成的起点（含固定种子 RNG、px 辅助函数）
    └── night_scene.html  ← 质量标杆（夜树 + Clawd idle，S=3 一致）
```

### 关键设计决策

- **Clawd 绘制方法**：所有动画中的 Clawd 必须使用 live_demo.html 的 S=3 网格方法，保持角色一致性
- **固定种子 RNG**：`let _s=N; const rand=()=>{_s=(_s*1664525+1013904223)&0x7fffffff;return _s/0x7fffffff;}`，保证每次刷新画面相同
- **dt 单位**：帧基准（frame-based），与 live_demo 一致：`dt = Math.min((ts - lastTs) / (1000/60), 3)`，秒换算：`t += dt/60`
- **单角色原则**：质量标杆只有 Clawd，不引入第二角色

### SKILL.md 核心章节

1. 工作流五步（强制先读 night_scene.html）
2. 硬约束（≤16色、坐标取整、零依赖）
3. 动画质量标准（节奏感 / 表现力 / 循环设计 / 层次感）
4. Clawd 角色规格（S=3 网格，体色 #DE886D）
5. 复杂度边界（scope 内 vs 超出范围）

---

New states injected before closing `};` in STATES object:

```javascript
// === PATCH: [label] ===
  myState: {
    label: 'LABEL',
    aL: 0, aR: 0, aLdy: 0, aRdy: 0,
    eyeSq: 0, eyeDy: 0,
    prop: null,
    color: null,
    spawn: null,
    // optional: bounce, bounceStr, breathSlow, headTilt, slump, sweepRock, jitter
  },
```

Buttons auto-register via `Object.entries(STATES)` loop — no extra wiring.

---

## Mode 2 Architecture Findings

- **chokidar** watches JSONL glob — reliable on Windows with `awaitWriteFinish`
- **tailFile()**: synchronous readFileSync slice from byte offset (works because JSONL is ASCII-dominant)
- **First-sight handling**: on `add`, set offset to current file size (skip history replay)
- **Tool window**: rolling 5s array to detect juggling (>3 tools)
- **Happy timer**: setTimeout 3s → auto-reset to idle
- **WS client**: auto-reconnect every 3s on close
- **Status dot**: top-right corner of canvas, blue=connected grey=disconnected

---

## Known Issues / TODOs

| Issue | Priority | Notes |
|-------|----------|-------|
| ZZZ particles don't clear cleanly on state exit | Low | Minor visual artifact |
| tailFile byte offset ≠ char offset for non-ASCII | Low | JSONL is mostly ASCII JSON, acceptable |
| No "currently active JSONL" detection | Medium | Watches ALL projects equally — any session triggers |
| Tool window tracks timestamps but not file source | Low | Multi-session simultaneous use would merge events |

---

## Mode 2 State Machine — Current Triggers (2026-03-17)

| State | Trigger | Notes |
|-------|---------|-------|
| `idle` | Default / happy timer / settle timer | |
| `typing` | Write/Edit/NotebookEdit/Bash | settle → idle after 8s |
| `thinking` | Read/Grep/Glob/WebFetch/WebSearch/Task | settle → idle after 8s |
| `juggling` | Agent tool / >3 tools in 5s window | settle → idle after 8s |
| `happy` | Stop hook (each turn end) | 3s timer → idle |
| `sleeping` | 90s no activity | |
| `disconnected` | 300s no activity | |
| `confused` | tool_result with error/failed text | |
| `ending` | bye keyword via bye_hook.js | 2s → session removed |
| `notification` | ❌ not wired | candidate: UserPromptSubmit |
| `overheated` | ❌ not wired | candidate: 3+ consecutive confused |
| `wizard` | ❌ not wired | candidate: separate from juggling |
| `sweeping` | ❌ not wired | candidate: git/rm Bash commands |

## Session Panel — Title & Detail (2026-03-17)

- **title**: extracted from `transcript_path` JSONL — first user message, XML tags stripped, `[...]` messages filtered, max 32 chars; set once, never overwritten
- **detail**: extracted from `tool_input` per tool type: `📖 filename` (Read), `✏️ filename` (Write/Edit), `$ command` (Bash), `🔍 pattern` (Grep/Glob), `🌐 url/query` (WebSearch/WebFetch), `🤖 prompt` (Agent); cleared when state → idle/sleeping/disconnected

