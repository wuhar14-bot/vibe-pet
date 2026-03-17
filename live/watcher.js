// ─── Vibe-Pet Live Watcher v2 ─────────────────────────────────────────────
// Dual input:
//   1. PreToolUse hook  → HTTP POST /hook       (main session, precise)
//   2. chokidar JSONL   → subagent JSONL files  (subagent sessions)
// Output: WebSocket broadcast → { sessions: [{id, state, isMain}] }
//
// Run: node watcher.js
// WS:  ws://localhost:3721
// HTTP: http://localhost:3722

import chokidar from 'chokidar';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync, statSync } from 'fs';

// ─── Config ───────────────────────────────────────────────────────────────
const JSONL_GLOB    = 'C:/Users/harwu/.claude/projects/E--claude-code/**/*.jsonl';
const WS_PORT       = 3721;
const HTTP_PORT     = 3722;
const IDLE_INTERVAL = 5_000;
const SLEEP_AFTER   = 90_000;
const DISC_AFTER    = 300_000;
const HAPPY_TTL     = 3_000;
const TOOL_WINDOW   = 5_000;
const AGENT_EXPIRE  = 60_000;   // remove subagent after 60s of no activity
const STOP_GRACE    = 10 * 60_000;  // 10 min grace after Stop hook before removing session
const TOOL_SETTLE   = 8_000;        // return to idle N ms after last tool call with no new activity

const WRITE_TOOLS  = new Set(['Write', 'Edit', 'NotebookEdit', 'Bash']);
const SEARCH_TOOLS = new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Task']);

// ─── Session state machine ─────────────────────────────────────────────────
class Session {
  constructor(id, isMain, onChanged) {
    this.id           = id;
    this.isMain       = isMain;
    this.state        = 'idle';
    this.title        = null;   // first user message (set once)
    this.detail       = null;   // current tool action (cleared on idle)
    this.lastActivity = Date.now();
    this.toolWindow   = [];
    this.happyTimer   = null;
    this.stopTimer    = null;
    this.settleTimer  = null;
    this.onChanged    = onChanged;
    this.currentTool  = null;
  }

  setState(s) {
    if (s === this.state) return;
    this.state = s;
    if (s === 'idle' || s === 'sleeping' || s === 'disconnected') {
      this.detail = null;
      this.currentTool = null;
    }
    console.log(`[${this.id}] → ${s}`);
    this.onChanged();
  }

  tick(event) {
    this.lastActivity = Date.now();
    this.cancelStopGrace();  // new activity cancels any pending stop grace
    this.clearSettle();      // new activity resets settle timer
    const cutoff = Date.now() - TOOL_WINDOW;
    this.toolWindow = this.toolWindow.filter(t => t > cutoff);

    if (!event) return;

    if (event.kind === 'tool_result' && event.error) {
      this.clearHappy(); this.setState('confused'); return;
    }

    if (event.kind === 'tool_use') {
      this.toolWindow.push(Date.now());
      this.clearHappy();
      const names = event.tools;
      this.currentTool = names[0] ?? null;
      if (names.some(n => n === 'Agent'))              { this.setState('juggling'); this.startSettle(); return; }
      if (this.toolWindow.length > 3)                  { this.setState('juggling'); this.startSettle(); return; }
      if (names.some(n => WRITE_TOOLS.has(n)))         { this.setState('typing');   this.startSettle(); return; }
      if (names.some(n => SEARCH_TOOLS.has(n)))        { this.setState('thinking'); this.startSettle(); return; }
      this.setState('typing'); this.startSettle();  // unknown tool → assume writing
      return;
    }

    if (event.kind === 'text') {
      this.clearHappy(); this.clearSettle();
      this.setState('happy');
      this.happyTimer = setTimeout(() => {
        if (this.state === 'happy') this.setState('idle');
      }, HAPPY_TTL);
    }
  }

  idleTick() {
    const elapsed = Date.now() - this.lastActivity;
    if      (elapsed > DISC_AFTER)  this.setState('disconnected');
    else if (elapsed > SLEEP_AFTER) this.setState('sleeping');
  }

  clearHappy() {
    if (this.happyTimer) { clearTimeout(this.happyTimer); this.happyTimer = null; }
  }

  startSettle() {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      if (['thinking','typing','juggling'].includes(this.state)) this.setState('idle');
    }, TOOL_SETTLE);
  }

  clearSettle() {
    if (this.settleTimer) { clearTimeout(this.settleTimer); this.settleTimer = null; }
  }

  startStopGrace(registry) {
    if (this.stopTimer) return;   // already counting down
    // Normal stop: don't change visual state, just start grace timer silently
    this.stopTimer = setTimeout(() => {
      console.log(`[registry] stop grace expired: ${this.id}`);
      registry.delete(this.id);
      this.onChanged();
    }, STOP_GRACE);
  }

  cancelStopGrace() {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
      if (this.state === 'ending') this.setState('idle');
    }
  }
}

// ─── Session registry ─────────────────────────────────────────────────────
const sessions = new Map();   // id → Session
const byeSessions = new Set(); // ids that have said bye — ignore subsequent Stop hooks

function getOrCreate(id, isMain) {
  if (!sessions.has(id)) {
    const s = new Session(id, isMain, broadcast);
    sessions.set(id, s);
    console.log(`[registry] new session: ${id} (main=${isMain})`);
  }
  return sessions.get(id);
}

function pruneStaleSessions() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (s.isMain) continue;   // keep main session always
    if (now - s.lastActivity > AGENT_EXPIRE) {
      console.log(`[registry] removing stale: ${id}`);
      sessions.delete(id);
      broadcast();
    }
  }
}

// ─── WebSocket server ─────────────────────────────────────────────────────
const wss = new WebSocketServer({ port: WS_PORT });
console.log(`[ws] listening on ws://localhost:${WS_PORT}`);

function broadcast() {
  const payload = JSON.stringify({
    sessions: [...sessions.values()].map(s => ({
      id: s.id, state: s.state, isMain: s.isMain,
      title: s.title, detail: s.detail, currentTool: s.currentTool,
    })),
    ts: Date.now(),
  });
  for (const c of wss.clients) {
    if (c.readyState === 1) c.send(payload);
  }
}

wss.on('connection', ws => {
  console.log('[ws] client connected');
  // Send current state immediately
  ws.send(JSON.stringify({
    sessions: [...sessions.values()].map(s => ({
      id: s.id, state: s.state, isMain: s.isMain,
      title: s.title, detail: s.detail, currentTool: s.currentTool,
    })),
    ts: Date.now(),
  }));
});

// ─── HTTP server (receives PreToolUse hook) ───────────────────────────────
const httpServer = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/hook') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { tool, sessionId = 'main', title = null, detail = null } = JSON.parse(body);
        const id = sessionId || 'main';
        const s  = getOrCreate(id, true);
        if (title && !s.title) s.title = title;   // set once, never overwrite
        if (detail) s.detail = detail;
        const names = [tool];
        s.tick({ kind: 'tool_use', tools: names, ts: Date.now() });
        console.log(`[hook] ${id} tool_use:${tool}`);
      } catch (e) { console.error('[hook] parse error', e.message); }
      res.writeHead(200); res.end('ok');
    });
  } else if (req.method === 'POST' && req.url === '/session-stop') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { sessionId = 'main', bye = false } = JSON.parse(body);
        const id = sessionId || 'main';
        if (bye) {
          // Explicit sign-off: mark as bye, remove immediately after brief ending state
          byeSessions.add(id);
          const s = sessions.get(id);
          if (s) {
            s.setState('ending');
            setTimeout(() => { sessions.delete(id); broadcast(); }, 2000);
          }
          console.log(`[stop] ${id} signed off (bye)`);
        } else {
          // Normal stop: skip if session said bye, create if needed, then HAPPY → READY
          if (byeSessions.has(id)) {
            console.log(`[stop] ${id} skipped (already said bye)`);
          } else {
            const s = getOrCreate(id, true);
            s.clearSettle();
            s.clearHappy();
            s.setState('happy');
            s.happyTimer = setTimeout(() => {
              if (s.state === 'happy') s.setState('notification');
            }, 1500);
            s.startStopGrace(sessions);
            console.log(`[stop] ${id} happy → ready`);
          }
        }
      } catch (e) { console.error('[stop] parse error', e.message); }
      res.writeHead(200); res.end('ok');
    });
  } else {
    res.writeHead(404); res.end();
  }
});
httpServer.listen(HTTP_PORT, '127.0.0.1', () =>
  console.log(`[http] hook endpoint on http://localhost:${HTTP_PORT}/hook`));

// ─── JSONL tail (for subagent files) ─────────────────────────────────────
const fileOffsets = new Map();

function tailFile(filePath) {
  let size;
  try { size = statSync(filePath).size; } catch { return []; }
  if (!fileOffsets.has(filePath)) { fileOffsets.set(filePath, size); return []; }
  const prev = fileOffsets.get(filePath);
  if (size <= prev) { fileOffsets.set(filePath, size); return []; }
  let raw;
  try { raw = readFileSync(filePath, 'utf8'); } catch { return []; }
  fileOffsets.set(filePath, size);
  return raw.slice(prev).split('\n').filter(l => l.trim());
}

function parseEvent(line) {
  let obj;
  try { obj = JSON.parse(line); } catch { return null; }
  const ts = Date.now();
  if (obj.type === 'user') return { kind: 'user', ts };
  if (obj.type === 'assistant') {
    const content = obj.message?.content ?? [];
    const toolNames = []; let hasText = false;
    for (const b of content) {
      if (b.type === 'tool_use') toolNames.push(b.name);
      else if (b.type === 'text' && b.text?.trim()) hasText = true;
    }
    if (toolNames.length > 0) return { kind: 'tool_use', tools: toolNames, ts };
    if (hasText)              return { kind: 'text', ts };
    return null;
  }
  if (obj.type === 'tool') {
    for (const b of (obj.content ?? [])) {
      if (b.type === 'tool_result') {
        const text = typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '');
        return { kind: 'tool_result', error: /error|failed|exception|traceback/i.test(text), ts };
      }
    }
  }
  return null;
}

// Detect if a JSONL path is a subagent (contains /subagents/ in path)
function extractAgentId(filePath) {
  const m = filePath.match(/\\subagents\\(agent-[^\\]+)\.jsonl$/i)
         || filePath.match(/\/subagents\/(agent-[^/]+)\.jsonl$/i);
  return m ? m[1] : null;
}

// Watch subagent JSONL files only (main session handled by hook)
const watcher = chokidar.watch(JSONL_GLOB, {
  persistent: true, ignoreInitial: false, usePolling: false,
  awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 50 },
});

watcher.on('add', filePath => {
  try { fileOffsets.set(filePath, statSync(filePath).size); } catch {}
});

watcher.on('change', filePath => {
  const agentId = extractAgentId(filePath);
  if (!agentId) return;  // skip main session JSONL — handled by hook

  for (const line of tailFile(filePath)) {
    const event = parseEvent(line);
    if (event && event.kind !== 'user') {
      const s = getOrCreate(agentId, false);
      s.tick(event);
    }
  }
});

watcher.on('error', err => console.error('[watch error]', err));
console.log(`[watcher] glob: ${JSONL_GLOB}`);

// ─── Idle timer ───────────────────────────────────────────────────────────
setInterval(() => {
  for (const s of sessions.values()) {
    if (s.isMain && !s.stopTimer) s.idleTick();
  }
  pruneStaleSessions();
}, IDLE_INTERVAL);

console.log('[watcher] ready — open live_demo.html in browser');
