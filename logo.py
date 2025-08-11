# Build a simple BorrowPower logo kit (SVG + PNG) based on the user's preferred mark.
# We'll generate a house-outline with three ascending bars and a wordmark lockup.
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math, io, zipfile, os

outdir = Path("/mnt/data/borrowpower_logo")
outdir.mkdir(parents=True, exist_ok=True)

# Brand colors
TEAL = "#157D83"     # icon
TEAL_DARK = "#0F6E73"
NAVY = "#1F3A5F"     # wordmark
BG = "#FFFFFF"

# ---------- SVG helpers ----------
def svg_icon(size=256, stroke=24, bar_color=TEAL, stroke_color=TEAL, bg=None):
    # Simple house outline + bars; house is a hex-like polygon
    s = size
    # Points for outer house polygon (normalized)
    pts = [
        (0.5, 0.12),  # apex
        (0.18, 0.34), # roof left
        (0.18, 0.86), # bottom left
        (0.82, 0.86), # bottom right
        (0.82, 0.34), # roof right
    ]
    # Convert to pixel coords
    P = [(x*s, y*s) for (x,y) in pts]
    # Bars geometry
    base_y = 0.80*s
    gap = 0.06*s
    w = 0.08*s
    x1 = 0.40*s - w - gap
    x2 = 0.40*s
    x3 = 0.40*s + w + gap
    h1, h2, h3 = 0.22*s, 0.34*s, 0.48*s
    rx = w/2.8  # rounded radius
    svg = []
    svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{s}" height="{s}" viewBox="0 0 {s} {s}">')
    if bg:
        svg.append(f'<rect width="100%" height="100%" fill="{bg}"/>' )
    # House outline path (rounded joins via stroke-linejoin/linecap)
    path = "M {} {} L {} {} L {} {} L {} {} L {} {} Z".format(
        P[0][0],P[0][1], P[1][0],P[1][1], P[2][0],P[2][1], P[3][0],P[3][1], P[4][0],P[4][1]
    )
    svg.append(f'<path d="{path}" fill="none" stroke="{stroke_color}" stroke-width="{stroke}" stroke-linejoin="round" stroke-linecap="round"/>')
    # Bars
    def rr(x,y,w,h,r):
        return f'M{x+r},{y}h{w-2*r}a{r},{r} 0 0 1 {r},{r}v{h-2*r}a{r},{r} 0 0 1 {-r},{r}h{-w+2*r}a{r},{r} 0 0 1 {-r},{-r}v{-h+2*r}a{r},{r} 0 0 1 {r},{-r}z'
    for x,h in [(x1,h1),(x2,h2),(x3,h3)]:
        y = base_y - h
        svg.append(f'<path d="{rr(x,y,w,h,rx)}" fill="{bar_color}"/>' )
    svg.append('</svg>')
    return "\n".join(svg)

def svg_lockup(size=512):
    # Icon + wordmark lockup: icon on left, text on right
    icon = svg_icon(size=256, stroke=24, bar_color=TEAL, stroke_color=TEAL)
    # Wrap icon as symbol (simplify by placing two <svg> side-by-side in one outer svg)
    s = size
    total_w = int(s*1.8)
    total_h = s
    # Wordmark using system fonts (not embedded)
    text = "BorrowPower"
    svg = []
    svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{total_w}" height="{total_h}" viewBox="0 0 {total_w} {total_h}">')
    svg.append(f'<rect width="100%" height="100%" fill="white"/>')
    # Insert icon via <g> with inner svg as <foreignObject> is messy; we'll recreate paths: call svg_icon and strip <svg> wrapper
    icon_inner = "\n".join(icon.splitlines()[1:-1])
    svg.append(f'<g transform="translate(0, {(total_h-256)//2})">{icon_inner}</g>')
    # Text
    svg.append(f'<text x="{256+24}" y="{total_h/2+32}" font-size="120" font-family="Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" fill="{NAVY}" font-weight="700">BorrowPower</text>')
    svg.append('</svg>')
    return "\n".join(svg)

# ---------- PNG Icon drawing (house outline simulated by outer+inner polygons) ----------
def png_icon(size=512, stroke_frac=0.1):
    img = Image.new("RGBA", (size, size), BG)
    d = ImageDraw.Draw(img, "RGBA")
    # Outer polygon
    pts = [
        (0.5, 0.12),
        (0.18, 0.34),
        (0.18, 0.86),
        (0.82, 0.86),
        (0.82, 0.34),
    ]
    P = [(int(x*size), int(y*size)) for (x,y) in pts]
    # Draw filled polygon as outline
    d.polygon(P, fill=TEAL)
    # Inner polygon (scale toward center to create stroke effect)
    cx = sum(x for x,_ in P)/len(P)
    cy = sum(y for _,y in P)/len(P)
    scale = 0.82  # inset amount
    Pin = [(int(cx + (x-cx)*scale), int(cy + (y-cy)*scale)) for (x,y) in P]
    d.polygon(Pin, fill=BG)

    # Bars
    base_y = int(0.80*size)
    gap = int(0.06*size)
    w = int(0.08*size)
    x1 = int(0.40*size - w - gap)
    x2 = int(0.40*size)
    x3 = int(0.40*size + w + gap)
    h1, h2, h3 = int(0.22*size), int(0.34*size), int(0.48*size)
    rx = int(w/3)  # corner radius
    def rrect(x,y,w,h,r,fill):
        d.rounded_rectangle([x,y,x+w,y+h], r, fill=fill)
    for x,h in [(x1,h1),(x2,h2),(x3,h3)]:
        y = base_y - h
        rrect(x,y,w,h,rx,TEAL_DARK)
    return img

# ---------- Generate files ----------
# SVGs
(outdir / "borrowpower-icon.svg").write_text(svg_icon(256), encoding="utf-8")
(outdir / "borrowpower-logo-horizontal.svg").write_text(svg_lockup(512), encoding="utf-8")
(outdir / "favicon.svg").write_text(svg_icon(64), encoding="utf-8")

# PNGs (icon only, for favicons/app icons)
png_sizes = [32, 48, 64, 128, 180, 192, 256, 512]
for sz in png_sizes:
    img = png_icon(sz)
    img.save(outdir / f"icon-{sz}.png")

# A simple README with usage
readme = f"""BorrowPower Logo Kit
======================

This kit includes:
- SVG: borrowpower-icon.svg (icon), borrowpower-logo-horizontal.svg (icon + wordmark), favicon.svg
- PNG icons: icon-32/48/64/128/180/192/256/512.png

Brand colors:
- Teal: {TEAL}
- Teal (dark for bars): {TEAL_DARK}
- Navy (wordmark): {NAVY}

HTML includes:
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<link rel="alternate icon" type="image/png" href="/assets/icon-32.png">
<link rel="apple-touch-icon" href="/assets/icon-180.png">
"""

(outdir / "README.txt").write_text(readme, encoding="utf-8")

# Zip it
zip_path = "/mnt/data/borrowpower-logo-kit.zip"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    for p in outdir.iterdir():
        z.write(str(p), p.name)

zip_path
