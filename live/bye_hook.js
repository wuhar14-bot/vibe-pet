// ─── Vibe-Pet Bye Hook (UserPromptSubmit) ─────────────────────────────────
// Fires when user submits a message. If message starts with a bye keyword,
// immediately triggers session removal — no transcript reading needed.

import http from 'http';

const WATCHER_HOST = '127.0.0.1';
const WATCHER_PORT = 3722;
// Matches if message STARTS WITH a bye keyword, OR contains "pet close" / "pet off" anywhere
const BYE_PATTERNS = /^(bye|byebye|sign[\s-]?off|goodbye|再见|关窗|关闭|close\s+(?:session|window))(\s|[.!。]|$)|pet\s+(close|off|bye|gone)/i;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  let sessionId = 'main';
  let isBye = false;

  try {
    const obj = JSON.parse(raw);
    sessionId = obj.session_id ?? 'main';
    const prompt = (obj.prompt ?? '').trim();
    isBye = BYE_PATTERNS.test(prompt);
  } catch {}

  if (!isBye) { process.exit(0); return; }

  const body = JSON.stringify({ sessionId, bye: true, ts: Date.now() });
  const req = http.request({
    hostname: WATCHER_HOST, port: WATCHER_PORT,
    path: '/session-stop', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  });
  req.on('error', () => {});
  req.end(body);
  setTimeout(() => process.exit(0), 50);
});
