#!/usr/bin/env python3
"""Crop the uploaded selfies into clean square character portraits for the game."""
from PIL import Image, ImageDraw, ImageFilter
import os

SRC = "/root/.claude/uploads/ce54a476-1dac-5f5d-9c48-ad2639739f86"
OUT = "/home/user/Robbs/game/assets/chars"
ICONS = "/home/user/Robbs/game/assets/icons"
os.makedirs(OUT, exist_ok=True)
os.makedirs(ICONS, exist_ok=True)

# id -> (source filename, horizontal focus, vertical focus, zoom)  focus in 0..1; zoom<1 = tighter
ROSTER = [
    ("toxic",       "4c2d379e-1000024395.png", 0.50, 0.46, 0.82),
    ("frost",       "cb5ed3c5-1000024393.jpg", 0.50, 0.45, 0.82),
    ("shellshock",  "8107db8e-1000024301.jpg", 0.50, 0.46, 0.86),
    ("captain",     "54fcf8c4-1000024266.jpg", 0.50, 0.50, 0.92),
    ("aphex",       "13f18545-1000024247.jpg", 0.50, 0.46, 0.90),
    ("nightshift",  "0b828633-1000024237.jpg", 0.50, 0.50, 0.88),
    ("panmaster",   "348ce2b0-1000024200.png", 0.76, 0.54, 0.60),
    ("phantom",     "2f1a2dc2-1000024134.png", 0.42, 0.44, 0.95),
    ("golfgod",     "760fa398-1000024118.jpg", 0.46, 0.48, 0.90),
    ("mustache",    "dff4c56c-1000024128.jpg", 0.46, 0.50, 0.92),
    ("stormcaller", "c022fbf2-1000024000.png", 0.45, 0.46, 0.95),
    ("swap",        "6fc809d1-1000023997.jpg", 0.45, 0.48, 0.90),
    ("rookie",      "6187c9bd-1000023995.jpg", 0.45, 0.50, 0.92),
    ("contractor",  "2d5cb6bd-1000023991.jpg", 0.45, 0.42, 0.82),
    ("goblin",      "fd8924d6-1000023985.jpg", 0.55, 0.50, 0.95),
    ("licker",      "6224b698-1000023984.jpg", 0.45, 0.50, 0.98),
    ("possessed",   "ea2bbe49-1000023983.jpg", 0.50, 0.50, 0.98),
    ("bluehour",    "29f5d468-1000023970.jpg", 0.50, 0.52, 0.92),
    ("cursed",      "2ab22897-1000023972.png", 0.50, 0.54, 0.92),
    ("closer",      "168a36e1-1000023917.jpg", 0.50, 0.46, 0.86),
]

SIZE = 600

def crop_square(im, fx, fy, zoom):
    w, h = im.size
    side = int(min(w, h) * zoom)
    cx, cy = int(w * fx), int(h * fy)
    left = max(0, min(w - side, cx - side // 2))
    top = max(0, min(h - side, cy - side // 2))
    return im.crop((left, top, left + side, top + side))

for cid, fname, fx, fy, zoom in ROSTER:
    path = os.path.join(SRC, fname)
    im = Image.open(path).convert("RGB")
    sq = crop_square(im, fx, fy, zoom).resize((SIZE, SIZE), Image.LANCZOS)
    out = os.path.join(OUT, f"{cid}.webp")
    sq.save(out, "WEBP", quality=84, method=6)
    print(f"{cid:12s} {im.size} -> {out} ({os.path.getsize(out)//1024}kb)")

# App icon: use the "panmaster" art (the AI render) framed nicely
icon_src = Image.open(os.path.join(OUT, "panmaster.webp")).convert("RGB")
for sz in (192, 512):
    icon_src.resize((sz, sz), Image.LANCZOS).save(os.path.join(ICONS, f"icon-{sz}.png"))
    print(f"icon-{sz}.png written")
print("DONE")
