#!/usr/bin/env python3
"""Generate Android launcher icons for SNAP SQUAD from the game's app icon.

Source: game/assets/icons/icon-512.png (a full-bleed photographic icon).
Output: resources/android-res/  (mirrors android/app/src/main/res structure)

The CI release workflow copies resources/android-res/* over the Capacitor-
generated android/app/src/main/res/ so the APK ships with branded icons and
no image-processing dependency is needed at build time.

Run locally after changing the source icon:
    python3 scripts/gen_android_icons.py
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "game", "assets", "icons", "icon-512.png")
OUT = os.path.join(ROOT, "resources", "android-res")

# Background color shown behind adaptive foreground (matches the game theme).
BG_COLOR = "#0b0f1a"

# Legacy launcher icon is 48dp, adaptive foreground is 108dp.
DENSITIES = {
    "mdpi": 1.0,
    "hdpi": 1.5,
    "xhdpi": 2.0,
    "xxhdpi": 3.0,
    "xxxhdpi": 4.0,
}


def focus_crop(img):
    """Square crop that lifts the face into the center of the frame.

    The source face sits in the upper third; shift the crop window up so the
    face lands inside the adaptive-icon safe zone (center ~66%)."""
    w, h = img.size
    side = int(min(w, h) * 0.82)            # 82% square window
    cx = w // 2
    cy = int(h * 0.41)                       # bias upward toward the face
    left = max(0, min(cx - side // 2, w - side))
    top = max(0, min(cy - side // 2, h - side))
    return img.crop((left, top, left + side, top + side))


def circle_mask(size):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.ellipse((0, 0, size - 1, size - 1), fill=255)
    return m


def save(img, density, name):
    d = os.path.join(OUT, f"mipmap-{density}")
    os.makedirs(d, exist_ok=True)
    img.save(os.path.join(d, name), "PNG")


def main():
    src = Image.open(SRC).convert("RGBA")
    face = focus_crop(src)

    for density, scale in DENSITIES.items():
        legacy = int(round(48 * scale))      # ic_launcher / ic_launcher_round
        fg = int(round(108 * scale))         # adaptive foreground (full-bleed)

        square = face.resize((legacy, legacy), Image.LANCZOS)
        save(square, density, "ic_launcher.png")

        rnd = square.copy()
        rnd.putalpha(circle_mask(legacy))
        save(rnd, density, "ic_launcher_round.png")

        # Full-bleed adaptive foreground: photo fills the whole 108dp canvas so
        # the system mask reveals the face with no letterbox borders.
        save(face.resize((fg, fg), Image.LANCZOS), density, "ic_launcher_foreground.png")

    # Override the (white) default adaptive background with the dark theme color.
    vals = os.path.join(OUT, "values")
    os.makedirs(vals, exist_ok=True)
    with open(os.path.join(vals, "ic_launcher_background.xml"), "w") as f:
        f.write(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            "<resources>\n"
            f'    <color name="ic_launcher_background">{BG_COLOR}</color>\n'
            "</resources>\n"
        )

    print(f"Icons written to {OUT}")


if __name__ == "__main__":
    main()
