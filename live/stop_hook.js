// ─── Vibe-Pet Stop Hook ────────────────────────────────────────────────────
// Called by Claude Code when the agent finishes a turn (Stop hook).
// Posts to watcher /session-stop endpoint.
//
// Payload from Claude Code:
//   { session_id, transcript_path, stop_hook_active }
//
// Also detects explicit "bye" sign-off from last user message.

import http from 'http';
import { readFileSync } from 'fs';

const WATCHER_HOST = '127.0.0.1';
const WATCHER_PORT = 3722;

// Keywords that trigger explicit sign-off (immediate removal)
// Matches if message STARTS WITH a bye keyword (allows extra words like "bye close session")
const BYE_PATTERNS = /^(bye|byebye|sign[\s-]?off|goodbye|再见|关窗|关闭|close\s+(?:session|window))(\s|[.!。]|$)/i;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  let sessionId = 'main';
  let bye = false;

  try {
    const obj = JSON.parse(raw);
    sessionId = obj.session_id ?? 'main';

    // Check if the transcript ends with a bye message
    const transcriptPath = obj.transcript_path;
    if (transcriptPath) {
      try {
        const lines = readFileSync(transcriptPath, 'utf8').trim().split('\n');
        // Look at the last few lines for a user message with bye keyword
        for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
          try {
            const entry = JSON.parse(lines[i]);
            if (entry.type === 'user') {
              const content = Array.isArray(entry.message?.content)
                ? entry.message.content.filter(b => b.type === 'text').map(b => b.text).join(' ')
                : String(entry.message?.content ?? '');
              if (BYE_PATTERNS.test(content.trim())) { bye = true; break; }
            }
          } catch {}
        }
      } catch {}
    }
  } catch {}

  const body = JSON.stringify({ sessionId, bye, ts: Date.now() });
  const req = http.request({
    hostname: WATCHER_HOST, port: WATCHER_PORT,
    path: '/session-stop', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  });
  req.on('error', () => {});  // watcher might not be running — silent fail
  req.end(body);
  setTimeout(() => process.exit(0), 50);
});
