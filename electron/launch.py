"""
Vibe Pet — always-on-top frameless overlay using pywebview (WebView2)
Run: python launch.py

Controls:
  - Drag on background (not on canvas) to move  [easy_drag=True handles this]
  - Drag bottom-right grip to resize
  - Right-click -> Close to quit
"""
import webview
import os

html_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'live_demo.html')
url = 'file:///' + html_path.replace('\\', '/')

DRAG_JS = """
(function() {
  document.querySelectorAll('canvas').forEach(c => c.style.cursor = 'default');
})();
"""

class Api:
    def __init__(self):
        self._window = None

    def set_window(self, w):
        self._window = w

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
    easy_drag=True,   # pywebview handles drag natively — 1:1 on any DPI
    js_api=api,
)

api.set_window(window)


def on_loaded():
    window.evaluate_js(DRAG_JS)


window.events.loaded += on_loaded

webview.start()
