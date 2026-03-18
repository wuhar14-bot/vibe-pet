"""
Vibe Pet — always-on-top frameless overlay using pywebview (WebView2)
Run: python launch.py

Controls:
  - Drag on background (not on canvas) to move
  - Right-click -> Close to quit
"""
import webview
import os

html_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'live_demo.html')
url = 'file:///' + html_path.replace('\\', '/')

# JS injected after page load: drag-to-move + resize grip + right-click close
DRAG_JS = """
(function() {
  // ── Resize grip (bottom-right corner) ──────────────────────────────
  const grip = document.createElement('div');
  grip.style.cssText = `
    position: fixed; bottom: 0; right: 0;
    width: 18px; height: 18px; cursor: se-resize; z-index: 9999;
    background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.25) 40%,
                rgba(255,255,255,0.25) 55%, transparent 55%,
                transparent 70%, rgba(255,255,255,0.25) 70%,
                rgba(255,255,255,0.25) 85%, transparent 85%);
  `;
  document.body.appendChild(grip);

  // ── State ───────────────────────────────────────────────────────────
  let mode = null; // 'move' | 'resize'
  let startClientX, startClientY, startScreenX, startScreenY;
  let startW, startH;

  // ── Grip: resize ────────────────────────────────────────────────────
  grip.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    mode = 'resize';
    startScreenX = e.screenX;
    startScreenY = e.screenY;
    startW = window.outerWidth;
    startH = window.outerHeight;
    e.preventDefault();
    e.stopPropagation();
  });

  // ── Body: move ──────────────────────────────────────────────────────
  document.body.style.cursor = 'move';
  document.addEventListener('mousedown', (e) => {
    if (e.target === grip) return;
    if (e.target.tagName === 'CANVAS') return;
    if (e.button !== 0) return;
    mode = 'move';
    startClientX = e.clientX;
    startClientY = e.clientY;
    e.preventDefault();
  });

  // ── Move / Resize ───────────────────────────────────────────────────
  document.addEventListener('mousemove', (e) => {
    if (!mode) return;
    if (mode === 'move') {
      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        window.pywebview.api.move_window(
          Math.round(window.screenX + dx),
          Math.round(window.screenY + dy)
        );
      }
    } else if (mode === 'resize') {
      const newW = Math.max(200, startW + (e.screenX - startScreenX));
      const newH = Math.max(120, startH + (e.screenY - startScreenY));
      window.pywebview.api.resize_window(newW, newH);
    }
  });

  document.addEventListener('mouseup', () => { mode = null; });

  // ── Right-click: close ──────────────────────────────────────────────
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (confirm('Close Vibe Pet?')) window.pywebview.api.close_window();
  });

  document.querySelectorAll('canvas').forEach(c => c.style.cursor = 'default');
})();
"""

class Api:
    def __init__(self):
        self._window = None

    def set_window(self, w):
        self._window = w

    def move_window(self, x, y):
        if self._window:
            self._window.move(x, y)

    def resize_window(self, w, h):
        if self._window:
            self._window.resize(int(w), int(h))

    def close_window(self):
        if self._window:
            self._window.destroy()


api = Api()

window = webview.create_window(
    'Clawd — Live Sessions',
    url,
    width=560,
    height=280,
    resizable=True,
    on_top=True,
    frameless=True,
    js_api=api,
)

api.set_window(window)


def on_loaded():
    window.evaluate_js(DRAG_JS)


window.events.loaded += on_loaded

webview.start()
