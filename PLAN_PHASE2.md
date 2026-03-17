# Vibe-Pet Phase 2 — Detailed Plan
*2026-03-16 · Live Companion Pet*

---

## Overview

```
Mode 1 (Patch): user prompt → new STATES entry injected into clawd_demo.html
Mode 2 (Live):  JSONL tail → watcher.js → WebSocket → live_demo.html auto-state
```

---

## Mode 1: Patch Format

### State Injection Protocol

When user describes a scene, I inject a new block into `clawd_demo.html`
immediately before the closing `};` of the `const STATES = {` object:

```javascript
// === PATCH: [label] ===
  [key]: {
    label: '[LABEL]',
    aL: 0, aR: 0, aLdy: 0, aRdy: 0,   // arm angles + y offsets
    eyeSq: 0, eyeDy: 0,                 // eye squint + y shift
    prop: null,                          // prop key (or null)
    color: null,                         // body color override (or null)
    spawn: null,                         // particle emitter fn (or fn)
    // optional modifiers:
    bounce: false,
    bounceStr: 1.8,
    breathSlow: false,
    headTilt: false,
    slump: false,
    sweepRock: false,
    jitter: 0,
  },
```

### Available Prop Slots

| Prop key | What it draws |
|---|---|
| `laptop` | Laptop with glow |
| `bubble` | Thought bubble with dots |
| `zzz` | Floating ZZZ letters |
| `qmarks` | Floating ? marks |
| `alert` | Red ! mark |
| `juggle` | 3 arcing balls |
| `smoke` | Particle-driven smoke |
| `wizard` | Hat + wand |
| `offline` | Dim + sad eyes |
| `broom` | Sweeping broom |
| *(new)* | Drawn inline in spawn fn |

### Button Auto-Registration

Injected states auto-appear in controls (existing `Object.entries(STATES)` loop).
No extra wiring needed.

---

## Mode 2: Live Companion Pet

### File Structure

```
vibe-pet/
  live/
    package.json        ← deps: ws, chokidar
    watcher.js          ← JSONL tail + state machine + WS server
  live_demo.html        ← clawd_demo.html + WS client (50 lines added)
```

*No Express needed — serve live_demo.html via `npx serve` or direct file open.*

---

### JSONL Event → State Mapping

Claude Code writes one JSON line per event to:
`C:\Users\harwu\.claude\projects\**\*.jsonl`

#### Line types we care about:

```json
{ "type": "user", "message": { "role": "user", "content": [...] } }
{ "type": "assistant", "message": { "role": "assistant", "content": [
    { "type": "tool_use", "name": "Write", "input": {...} },
    { "type": "text", "text": "..." }
] } }
{ "type": "tool", "content": [
    { "type": "tool_result", "tool_use_id": "...", "content": "..." }
] }
```

#### State machine rules (priority order):

```
PRIORITY  TRIGGER                                  → STATE
─────────────────────────────────────────────────────────────
1         tool_result contains "Error" / "failed"  → confused
2         tool_use.name in WRITE_TOOLS             → typing
3         tool_use.name in SEARCH_TOOLS            → thinking
4         tool_use.name === "Agent"                 → juggling
5         tool_use count in window > 3             → juggling
6         assistant text message (no tool)         → happy  (3s then idle)
7         no event for 90s                         → sleeping
8         no event for 5min                        → disconnected
9         (default)                                → idle
```

```javascript
const WRITE_TOOLS  = ['Write', 'Edit', 'NotebookEdit', 'Bash'];
const SEARCH_TOOLS = ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'];
```

---

### watcher.js Architecture

```
┌─────────────────────────────────────────────────────────┐
│  chokidar.watch(JSONL_GLOB)                             │
│    .on('change', file => tailNewLines(file))            │
└───────────────┬─────────────────────────────────────────┘
                │ new JSON lines
                ▼
┌─────────────────────────────────────────────────────────┐
│  parseEvent(line)                                        │
│    → { kind: 'tool_use'|'tool_result'|'text'|'user',   │
│        tool?, error?, timestamp }                        │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│  StateMachine                                           │
│    state: string                                        │
│    lastActivity: Date                                   │
│    toolWindow: Event[] (last 5s)                        │
│                                                         │
│    tick(event) → newState?                              │
│    idleTimer: setInterval(5s) → check lastActivity      │
└───────────────┬─────────────────────────────────────────┘
                │ state changed
                ▼
┌─────────────────────────────────────────────────────────┐
│  WebSocket.Server({ port: 3721 })                       │
│    broadcast({ state, label, ts })                      │
└─────────────────────────────────────────────────────────┘
```

---

### live_demo.html Additions (WS Client)

Appended to existing `<script>` block — ~50 lines:

```javascript
// ─── WebSocket Live State ──────────────────────────────
const WS_URL = 'ws://localhost:3721';
let ws, wsRetry;

function connectWS() {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    clearTimeout(wsRetry);
    document.getElementById('ws-dot').style.background = '#40C4FF';
  };
  ws.onmessage = e => {
    const { state } = JSON.parse(e.data);
    if (STATES[state]) {
      setTarget(state);
      autoCycle = false;   // pause auto-cycle when live
    }
  };
  ws.onclose = () => {
    document.getElementById('ws-dot').style.background = '#334';
    wsRetry = setTimeout(connectWS, 3000);   // auto-reconnect
  };
}
connectWS();
```

**Status dot** (top-right of canvas):
- 🔵 Blue = connected to watcher
- ⚫ Grey = disconnected (watcher not running), fallback to manual buttons

---

### package.json

```json
{
  "name": "vibe-pet-live",
  "type": "module",
  "scripts": {
    "start": "node watcher.js"
  },
  "dependencies": {
    "chokidar": "^3.6.0",
    "ws": "^8.18.0"
  }
}
```

---

### Startup

```bash
cd E:/claude-code/vibe-pet/live
npm install
node watcher.js
# → WS server on ws://localhost:3721
# → open live_demo.html in browser (blue dot = connected)
```

---

## State Transition Examples

| User does | JSONL event | → State |
|---|---|---|
| Types a prompt | `user` message | idle → (waiting) |
| Claude starts reading | tool_use: Read/Grep | thinking |
| Claude edits a file | tool_use: Write/Edit | typing |
| Claude runs bash | tool_use: Bash | typing |
| Claude launches agent | tool_use: Agent | juggling |
| Tool returns error | tool_result with Error | confused |
| Claude finishes reply | text message, no tool | happy (3s) |
| No activity 90s | idle timer | sleeping |
| No activity 5min | idle timer | disconnected |

---

## Build Order

```
Step 1: watcher.js         ← JSONL tail + state machine + WS broadcast
Step 2: live_demo.html     ← inject WS client into clawd_demo.html
Step 3: npm install + test ← verify state transitions with manual JSONL writes
Step 4: End-to-end test    ← open new Claude Code session, watch auto-state
```

---

*Estimated complexity: ~200 lines total (watcher.js ~150 + live_demo patch ~50)*
