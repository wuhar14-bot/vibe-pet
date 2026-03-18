"""Render the vibe-pet Clawd character (Phase 2) into an animated GIF.
READY state: arms slightly raised, twinkling stars, breathing animation."""

from PIL import Image, ImageDraw
import math, random

# ── Canvas constants (matching live_demo.html) ────────────────────
W, H = 200, 150
S = 3
FOOT_Y = 119
CX = int(100 - 7.5 * S)   # 77
CY = FOOT_Y - 15 * S       # 74

def gx(x): return CX + x * S
def gy(y): return CY + y * S

# ── Palette ───────────────────────────────────────────────────────
C_BODY   = (222, 136, 109)
C_EYE    = (0, 0, 0)
C_SKY1   = (8,  12,  24)
C_SKY2   = (13, 21,  40)
C_GROUND = (26, 42,  26)
C_GLINE  = (34, 51,  34)
C_GDASH  = (42, 61,  42)

STAR_COLORS = [(255,255,255), (64,196,255), (255,224,102), (255,138,128)]

# ── Fixed star positions (seeded so GIF is consistent) ───────────
random.seed(42)
STARS = [
    {
        'x': random.random() * W,
        'y': random.random() * 60,
        's': 2 if random.random() < 0.25 else 1,
        'tw': random.random() * math.pi * 2,
        'sp': 0.018 + random.random() * 0.025,
        'c': random.choice(STAR_COLORS),
    }
    for _ in range(20)
]

# ── Helpers ───────────────────────────────────────────────────────
def r(d, x, y, w, h, c):
    """Draw filled rectangle."""
    d.rectangle([int(x), int(y), int(x + w - 1), int(y + h - 1)], fill=c)

def rotated_square_poly(cx, cy, half, angle):
    """Return polygon points for a 2*half square rotated by angle (radians)."""
    corners = [(-half, -half), (half, -half), (half, half), (-half, half)]
    cos_a, sin_a = math.cos(angle), math.sin(angle)
    return [
        (cx + px * cos_a - py * sin_a,
         cy + px * sin_a + py * cos_a)
        for px, py in corners
    ]

def lerp_color(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))

# ── Render one frame ──────────────────────────────────────────────
def render_frame(tick):
    bT  = tick * 0.016   # slow breath
    aL  = -50 * math.pi / 180  # READY: both arms -50°
    aR  = -50 * math.pi / 180
    aLdy = -2; aRdy = -2
    eye_sq = -0.2

    breathe = 1 + math.sin(bT) * 0.014

    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)

    # ─ Sky ─
    r(d, 0, 0, W, 75, C_SKY1)
    r(d, 0, 75, W, H - 75, C_SKY2)

    # ─ Stars ─
    for st in STARS:
        tw = st['tw'] + st['sp'] * tick
        alpha = 0.3 + 0.7 * abs(math.sin(tw))
        sc = tuple(int(c * alpha) for c in st['c'])
        sx, sy, ss = int(st['x']), int(st['y']), st['s']
        d.rectangle([sx, sy, sx + ss - 1, sy + ss - 1], fill=sc)

    # ─ Ground ─
    r(d, 0, FOOT_Y + 1, W, H - FOOT_Y - 1, C_GROUND)
    r(d, 0, FOOT_Y + 1, W, 3, C_GLINE)
    for x in range(2, W, 8):
        r(d, x, FOOT_Y + 1, 3, 2, C_GDASH)

    # ─ Shadow ─
    r(d, gx(2) + 2, FOOT_Y + 1, 11 * S - 4, 2, (0, 0, 0))

    # ─ Legs ─
    for lx in [gx(3), gx(5), gx(9), gx(11)]:
        r(d, lx, gy(13), S, S * 2, C_BODY)

    # ─ Torso (breathing) ─
    tH = int(round(7 * S * breathe))
    tY = gy(6) + (7 * S - tH)
    r(d, gx(2), tY, 11 * S, tH, C_BODY)

    # ─ Arms ─
    for (acx, acy, angle) in [
        (gx(1),  gy(10) + aLdy, aL),
        (gx(14), gy(10) + aRdy, aR),
    ]:
        poly = rotated_square_poly(acx, acy, S, angle)
        d.polygon(poly, fill=C_BODY)

    # ─ Eyes ─
    eye_h = max(1, round(S * 2 * (1 - eye_sq)))  # 7 px tall (open wide)
    ey = int(gy(8) + (S * 2 - eye_h))
    r(d, gx(4),  ey, S, eye_h, C_EYE)
    r(d, gx(10), ey, S, eye_h, C_EYE)

    return img


def upscale(img, scale):
    return img.resize((W * scale, H * scale), Image.NEAREST)


# ── Generate GIF frames ───────────────────────────────────────────
SCALE = 2       # output 400×300
N_FRAMES = 40   # frames in GIF
DT = 2.5        # animation ticks per GIF frame

frames = []
for i in range(N_FRAMES):
    tick = i * DT
    f = render_frame(tick)
    frames.append(upscale(f, SCALE))

# ── Save ──────────────────────────────────────────────────────────
out = "E:/claude-code/vibe-pet/docs/clawd.gif"
frames[0].save(
    out,
    save_all=True,
    append_images=frames[1:],
    optimize=False,
    duration=50,   # 50ms per frame = 20fps
    loop=0,
)
print(f"Saved {N_FRAMES} frames to {out}")
print(f"Output size: {W * SCALE}x{H * SCALE}px")
