// ─── Vibe-Pet PreToolUse Hook ──────────────────────────────────────────────
// Called by Claude Code before each tool use (stdin = JSON).
// Posts to watcher HTTP endpoint — must exit quickly (non-blocking).
// Usage: node hook.js

import http from 'http';
import { readFileSync } from 'fs';

const WATCHER_HOST = '127.0.0.1';
const WATCHER_PORT = 3722;   // HTTP port (separate from WS 3721)

function extractTitle(transcriptPath) {
  try {
    const lines = readFileSync(transcriptPath, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const obj = JSON.parse(line);
      if (obj.type === 'user') {
        const content = obj.message?.content ?? obj.content ?? '';
        const text = Array.isArray(content)
          ? content.filter(b => b.type === 'text').map(b => b.text).join(' ')
          : String(content);
        // Strip XML-like tags (e.g. <ide_selection>...</ide_selection>, <system-reminder>...)
        const clean = text.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '')
                          .replace(/<[^>]+>/g, '')
                          .trim().replace(/\s+/g, ' ');
        // Skip system messages: [Request interrupted by user], empty, etc.
        if (clean.length > 0 && !clean.startsWith('[')) return clean.slice(0, 32);
      }
    }
  } catch {}
  return null;
}

function extractToolDetail(toolName, toolInput) {
  try {
    const inp = typeof toolInput === 'string' ? JSON.parse(toolInput) : (toolInput ?? {});
    switch (toolName) {
      case 'Read':      return inp.file_path ? '📖 ' + inp.file_path.split(/[\\/]/).pop() : null;
      case 'Write':     return inp.file_path ? '✏️ ' + inp.file_path.split(/[\\/]/).pop() : null;
      case 'Edit':      return inp.file_path ? '✏️ ' + inp.file_path.split(/[\\/]/).pop() : null;
      case 'Glob':      return inp.pattern   ? '🔍 ' + inp.pattern : null;
      case 'Grep':      return inp.pattern   ? '🔍 ' + inp.pattern.slice(0, 20) : null;
      case 'Bash':      return inp.command   ? '$ '  + inp.command.slice(0, 28) : null;
      case 'Agent':     return inp.prompt    ? '🤖 ' + inp.prompt.slice(0, 24)  : null;
      case 'WebSearch': return inp.query     ? '🌐 ' + inp.query.slice(0, 24)   : null;
      case 'WebFetch':  return inp.url       ? '🌐 ' + inp.url.replace(/^https?:\/\//, '').slice(0, 24) : null;
      default:          return null;
    }
  } catch {}
  return null;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  let tool = 'unknown', sessionId = 'main', title = null, detail = null;
  try {
    const obj = JSON.parse(raw);
    tool      = obj.tool_name ?? obj.tool ?? 'unknown';
    sessionId = obj.session_id ?? 'main';
    if (obj.transcript_path) {
      title = extractTitle(obj.transcript_path);
    }
    detail = extractToolDetail(tool, obj.tool_input);
  } catch {}

  const body = JSON.stringify({ tool, sessionId, title, detail, ts: Date.now() });
  const req  = http.request({
    hostname: WATCHER_HOST, port: WATCHER_PORT,
    path: '/hook', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  });
  req.on('error', () => {});   // watcher might not be running — silent fail
  req.end(body);
  // exit immediately — don't wait for response (non-blocking)
  setTimeout(() => process.exit(0), 50);
});
