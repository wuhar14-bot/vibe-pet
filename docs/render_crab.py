"""Render the vibe-pet crab sprite into an animated GIF."""
from PIL import Image, ImageDraw
import math

# Palette
P = {
    1: (232, 106,  51),   # body  orange-red
    2: (245, 214, 160),   # belly light
    3: (196,  83,  26),   # claw  darker
    4: ( 17,  17,  17),   # eye
    5: (238,  68,  68),   # hat   red
    6: (136,  34,  34),   # hat brim
}

# Sky / water colors
SKY1   = ( 91, 141, 217)
SKY2   = (138, 180, 248)
SUN    = (255, 224, 102)
WATER1 = ( 37,  99, 168)
WATER2 = ( 59, 130, 196)
WATER3 = (106, 172, 224)
FOAM   = (189, 224, 255)
BG     = ( 26,  26,  46)

W, H = 200, 150   # internal resolution
SCALE = 3         # output scale factor

# ── Sprite frames (16×12) ─────────────────────────────────────────
F0 = [
    [0,0,0,0,0,5,5,5,5,5,0,0,0,0,0,0],
    [0,0,0,0,5,5,5,5,5,5,5,0,0,0,0,0],
    [0,0,0,0,6,6,6,6,6,6,6,0,0,0,0,0],
    [0,1,0,0,1,1,1,1,1,1,0,0,0,1,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,1,2,2,4,2,2,4,2,2,2,1,0,0,0],
    [0,3,1,2,2,2,2,2,2,2,2,2,1,3,0,0],
    [3,3,1,1,1,1,1,1,1,1,1,1,1,3,3,0],
    [0,3,0,1,0,0,0,0,0,0,0,1,0,3,0,0],
    [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0],
    [0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0],
]
F1 = [
    [0,0,0,0,5,5,5,5,5,5,0,0,0,0,0,0],
    [0,0,0,5,5,5,5,5,5,5,5,0,0,0,0,0],
    [0,0,0,6,6,6,6,6,6,6,6,0,0,0,0,0],
    [0,1,0,0,1,1,1,1,1,1,0,0,0,1,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,1,2,2,4,2,2,4,2,2,2,1,0,0,0],
    [0,3,1,2,2,2,2,2,2,2,2,2,1,3,0,0],
    [3,3,1,1,1,1,1,1,1,1,1,1,1,3,3,0],
    [0,3,0,1,0,0,0,0,0,0,0,1,0,3,0,0],
    [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0],
    [0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0],
]
F2 = [
    [0,0,0,0,0,5,5,5,5,5,0,0,0,0,0,0],
    [0,0,0,0,5,5,5,5,5,5,5,0,0,0,0,0],
    [0,0,0,0,6,6,6,6,6,6,6,0,0,0,0,0],
    [0,1,0,0,1,1,1,1,1,1,0,0,0,1,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,1,2,2,4,2,2,4,2,2,2,1,0,0,0],
    [3,3,1,2,2,2,2,2,2,2,2,2,1,3,0,0],
    [0,3,1,1,1,1,1,1,1,1,1,1,1,3,3,0],
    [0,0,0,1,0,0,0,0,0,0,0,1,0,3,0,0],
    [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0],
    [0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0],
]
F3 = [
    [0,0,0,0,0,0,5,5,5,5,5,0,0,0,0,0],
    [0,0,0,0,0,5,5,5,5,5,5,5,0,0,0,0],
    [0,0,0,0,0,6,6,6,6,6,6,6,0,0,0,0],
    [0,1,0,0,1,1,1,1,1,1,0,0,0,1,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,1,2,2,4,2,2,4,2,2,2,1,0,0,0],
    [0,3,1,2,2,2,2,2,2,2,2,2,1,3,0,0],
    [3,3,1,1,1,1,1,1,1,1,1,1,1,3,3,0],
    [0,3,0,1,0,0,0,0,0,0,0,1,0,3,0,0],
    [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0],
    [0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0],
]
FRAMES = [F0, F1, F2, F3]


def draw_sprite(img, frame, px, py):
    for row_i, row in enumerate(frame):
        for col_i, ci in enumerate(row):
            if ci == 0:
                continue
            color = P[ci]
            img.putpixel((px + col_i, py + row_i), color)


def make_scene(sprite_frame_idx, tick):
    """Render one frame of the ocean scene."""
    img = Image.new("RGB", (W, H))
    d = img.load()

    # Sky bands
    for y in range(45):
        for x in range(W):
            d[x, y] = SKY1
    for y in range(45, 72):
        t = (y - 45) / 27
        r = int(SKY1[0] + (SKY2[0] - SKY1[0]) * t)
        g2 = int(SKY1[1] + (SKY2[1] - SKY1[1]) * t)
        b = int(SKY1[2] + (SKY2[2] - SKY1[2]) * t)
        for x in range(W):
            d[x, y] = (r, g2, b)

    # Sun (pixel cross)
    sx, sy = W - 26, 8
    for dy in range(12):
        for dx in range(12):
            d[sx + dx, sy + dy] = SUN
    for dy in range(-2, 14):
        for dx in range(-2, 10):
            if 0 <= sx + dx < W and 0 <= sy + dy < H:
                if dy < 0 or dy >= 12 or dx < 0 or dx >= 12:
                    if (dx >= 0 and dx < 12) or (dy >= 0 and dy < 12):
                        d[sx + dx, sy + dy] = SUN

    # Clouds (3 drifting)
    cloud_defs = [
        (20, 18, 28, 0.12),
        (110, 10, 36, 0.08),
        (160, 22, 22, 0.15),
    ]
    for (cx, cy, cw, spd) in cloud_defs:
        ox = int(cx - spd * tick * 1.0) % (W + cw) - cw
        # 3 rectangles per cloud
        for dy in range(4):
            for dx in range(cw):
                px2 = ox + dx
                if 0 <= px2 < W:
                    d[px2, cy + 4 + dy] = (255, 255, 255)
        for dy in range(4):
            for dx in range(cw - 8):
                px2 = ox + 4 + dx
                if 0 <= px2 < W:
                    d[px2, cy + 2 + dy] = (255, 255, 255)
        for dy in range(4):
            for dx in range(max(0, cw - 16)):
                px2 = ox + 8 + dx
                if 0 <= px2 < W:
                    d[px2, cy + dy] = (255, 255, 255)

    # Water background
    for y in range(72, H):
        for x in range(W):
            d[x, y] = WATER1
    for y in range(76, 88):
        for x in range(W):
            d[x, y] = WATER2

    # Foam line
    for fx in range(0, W, 6):
        if 0 <= fx < W:
            d[fx, 74] = FOAM
            if fx + 1 < W:
                d[fx + 1, 74] = FOAM
            if fx + 2 < W:
                d[fx + 2, 74] = FOAM

    # Waves
    for i in range(8):
        wx = int(i * 28 - 10 - 0.35 * tick) % (W + 20) - 10
        wy = 90 + (i % 3)
        for wi in range(5):
            xx = wx + wi * 4
            yy = wy + (0 if wi % 2 == 0 else 1)
            if 0 <= xx < W and 0 <= yy < H:
                d[xx, yy] = WATER3
                if xx + 1 < W:
                    d[xx + 1, yy] = WATER3

    # Crab
    bob = math.sin(tick * 0.15) * 2
    drift = math.sin(tick * 0.07) * 1.2
    cx2 = int(W / 2 - 8 + drift)
    cy2 = int(82 + bob)
    draw_sprite(img, FRAMES[sprite_frame_idx], cx2, cy2)

    return img


def upscale(img, scale):
    return img.resize((W * scale, H * scale), Image.NEAREST)


# Generate frames: 32 animation frames, cycling through 4 sprite frames
# 24 fps equivalent: sprite frame rate = 10 ticks each
GIF_FRAMES = 32
TICKS_PER_GIF_FRAME = 2.5  # each gif frame = 2.5 animation ticks
SPRITE_FRAME_RATE = 10      # sprite frame changes every 10 ticks

frames = []
for i in range(GIF_FRAMES):
    t = i * TICKS_PER_GIF_FRAME
    sprite_idx = int(t / SPRITE_FRAME_RATE) % len(FRAMES)
    img = make_scene(sprite_idx, t)
    frames.append(upscale(img, SCALE))

# Save animated GIF
out_path = "E:/claude-code/vibe-pet/docs/crab.gif"
frames[0].save(
    out_path,
    save_all=True,
    append_images=frames[1:],
    optimize=False,
    duration=42,   # ~24fps per frame
    loop=0,
)
print(f"Saved {len(frames)} frames to {out_path}")
print(f"Size: {W * SCALE}×{H * SCALE}px")
