#!/usr/bin/env python3
"""Crop the new uploaded Snapchat photos into square 600x600 character portraits.

Each entry maps a new character id to (source-prefix, cx, cy, side) where cx/cy
are the crop center as a fraction of width/height and side is the square side as
a fraction of the image width. Tuned by eye against the crop preview sheet.
"""
import os, glob
from PIL import Image

UP = "/root/.claude/uploads/fd42ff9d-522d-5a95-8631-989b0c9d1539"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "game", "assets", "chars")
SIZE = 600

# id: (8-char source prefix, cx, cy, side_frac_of_width)
CHARS = {
    "doppel":    ("06ae9540", 0.50, 0.30, 0.82),
    "bedhead":   ("1658b576", 0.50, 0.47, 1.00),
    "trippy":    ("276622d6", 0.50, 0.34, 1.00),
    "skipper":   ("2e29a8cb", 0.50, 0.35, 1.00),
    "smug":      ("39ff743c", 0.50, 0.34, 1.00),
    "freshface": ("40686280", 0.50, 0.42, 1.00),
    "tastemaker":("4855a3c4", 0.50, 0.34, 1.00),
    "deckhand":  ("4a2b22b9", 0.50, 0.42, 1.00),
    "tourist":   ("5b583d25", 0.50, 0.55, 0.42),
    "lowkey":    ("6ab5cdc1", 0.50, 0.35, 1.00),
    "grin":      ("6f9b1ce9", 0.50, 0.34, 1.00),
    "lurker":    ("717de1bc", 0.50, 0.52, 0.42),
    "selfie":    ("825e497b", 0.50, 0.40, 1.00),
    "chin":      ("89ba82d3", 0.50, 0.40, 1.00),
    "drowsy":    ("8e11ae18", 0.50, 0.36, 1.00),
    "unhinged":  ("9c6ad5d2", 0.50, 0.42, 1.00),
    "billion":   ("dfb9f9f1", 0.50, 0.42, 1.00),
    "android":   ("e6db9445", 0.50, 0.38, 1.00),
    "feral":     ("f43e8d72", 0.50, 0.32, 0.72),
    "regular":   ("fd111d26", 0.53, 0.45, 0.46),
}


def resolve(prefix):
    hits = glob.glob(os.path.join(UP, prefix + "*"))
    if not hits:
        raise FileNotFoundError(prefix)
    return hits[0]


def crop(path, cx, cy, side_frac):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    side = min(int(side_frac * w), w, h)
    left = max(0, min(int(cx * w - side / 2), w - side))
    top = max(0, min(int(cy * h - side / 2), h - side))
    return im.crop((left, top, left + side, top + side)).resize((SIZE, SIZE), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    for cid, (prefix, cx, cy, side) in CHARS.items():
        crop(resolve(prefix), cx, cy, side).save(
            os.path.join(OUT, cid + ".webp"), "WEBP", quality=88, method=6)
    print(f"wrote {len(CHARS)} portraits to {OUT}")


if __name__ == "__main__":
    main()
