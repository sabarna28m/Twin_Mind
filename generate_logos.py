"""Generate all TwinMind logo assets (SVG + PNG)."""
import os
from pathlib import Path

# PNG conversion is handled by convert_to_png.js (uses Node.js sharp)
# This script generates SVG files only.

OUT = Path(__file__).parent / "logo"
OUT.mkdir(exist_ok=True)

# ── Brain half paths (512x512 viewBox, split at x=256) ─────────────────────
LEFT  = ("M 256,108 C 238,91 208,81 177,87 "
         "C 142,93 108,116 89,155 "
         "C 65,202 68,260 87,304 "
         "C 106,348 141,373 179,383 "
         "C 209,391 234,389 256,382 Z")

RIGHT = ("M 256,108 C 274,91 304,81 335,87 "
         "C 370,93 404,116 423,155 "
         "C 447,202 444,260 425,304 "
         "C 406,348 371,373 333,383 "
         "C 303,391 278,389 256,382 Z")

# ── Circuit trace waypoints (left half) ────────────────────────────────────
L_TRACES = [
    [(128, 152), (172, 152), (172, 198)],
    [(104, 218), (152, 218)],
    [(156, 182), (156, 234), (204, 234)],
    [(106, 282), (150, 282), (150, 246)],
    [(126, 328), (170, 328), (170, 360)],
    [(200, 140), (200, 176), (242, 176)],
    [(176, 308), (218, 308), (218, 268)],
]
# Mirror for right half (x → 512 - x)
R_TRACES = [[(512 - x, y) for x, y in tr] for tr in L_TRACES]

NODE_R = 5.5


def _polyline(pts, color, opacity=0.65, sw=2.5):
    p = " ".join(f"{x},{y}" for x, y in pts)
    el = (f'<polyline points="{p}" fill="none" stroke="{color}" '
          f'stroke-width="{sw}" stroke-opacity="{opacity}" '
          f'stroke-linecap="round" stroke-linejoin="round"/>')
    nodes = "".join(
        f'<circle cx="{x}" cy="{y}" r="{NODE_R}" fill="{color}" '
        f'fill-opacity="{min(opacity + 0.25, 1):.2f}"/>'
        for x, y in pts
    )
    return el + "\n    " + nodes


def _circuits(traces, color, opacity=0.65, sw=2.5):
    return "\n    ".join(_polyline(t, color, opacity, sw) for t in traces)


# ══════════════════════════════════════════════════════════════════════════════
# 1. MAIN SVG  (512×512, transparent background)
# ══════════════════════════════════════════════════════════════════════════════
MAIN_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
  <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%"   stop-color="#00D4FF"/>
    <stop offset="100%" stop-color="#0066FF"/>
  </linearGradient>
  <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%"   stop-color="#8B00FF"/>
    <stop offset="100%" stop-color="#FF00CC"/>
  </linearGradient>
  <filter id="lglow" x="-25%" y="-25%" width="150%" height="150%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b"/>
    <feColorMatrix in="b" type="matrix"
      values="0 0.6 1 0 0   0 0.7 1 0 0.7   0 0 0 0 1   0 0 0 0.55 0" result="g"/>
    <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="rglow" x="-25%" y="-25%" width="150%" height="150%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b"/>
    <feColorMatrix in="b" type="matrix"
      values="0.5 0 0.5 0 0.4   0 0 0.3 0 0   0 0 1 0 0.8   0 0 0 0.55 0" result="g"/>
    <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <clipPath id="lc"><path d="{LEFT}"/></clipPath>
  <clipPath id="rc"><path d="{RIGHT}"/></clipPath>
</defs>

<!-- Left half -->
<g filter="url(#lglow)">
  <path d="{LEFT}" fill="url(#lg)" opacity="0.95"/>
  <g clip-path="url(#lc)">
    {_circuits(L_TRACES, "#7FEFFF")}
  </g>
</g>

<!-- Right half -->
<g filter="url(#rglow)">
  <path d="{RIGHT}" fill="url(#rg)" opacity="0.95"/>
  <g clip-path="url(#rc)">
    {_circuits(R_TRACES, "#D4A0FF")}
  </g>
</g>

<!-- Centre divider -->
<line x1="256" y1="108" x2="256" y2="382"
  stroke="rgba(255,255,255,0.38)" stroke-width="1.5" stroke-dasharray="5 4"/>
</svg>"""

(OUT / "twinmind-logo.svg").write_text(MAIN_SVG, encoding="utf-8")
print("OK twinmind-logo.svg (512x512 transparent)")
# PNGs generated separately by convert_to_png.js


# ══════════════════════════════════════════════════════════════════════════════
# 4. HORIZONTAL LOCKUP  (brain 64px + text, 380×80, dark bg)
# ══════════════════════════════════════════════════════════════════════════════
HORIZ_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 80" width="380" height="80">
<defs>
  <linearGradient id="hlg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%"   stop-color="#00D4FF"/>
    <stop offset="100%" stop-color="#0066FF"/>
  </linearGradient>
  <linearGradient id="hrg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%"   stop-color="#8B00FF"/>
    <stop offset="100%" stop-color="#FF00CC"/>
  </linearGradient>
  <linearGradient id="tg" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="#00D4FF"/>
    <stop offset="60%"  stop-color="#818CF8"/>
    <stop offset="100%" stop-color="#C084FC"/>
  </linearGradient>
</defs>
<rect width="380" height="80" rx="12" fill="#0D0D1A"/>

<!-- Brain icon: scale 512→64 (factor 0.125), place at (8,8) -->
<g transform="translate(8,8) scale(0.125)">
  <path d="{LEFT}"  fill="url(#hlg)" opacity="0.95"/>
  <path d="{RIGHT}" fill="url(#hrg)" opacity="0.95"/>
  <line x1="256" y1="108" x2="256" y2="382"
    stroke="rgba(255,255,255,0.38)" stroke-width="12" stroke-dasharray="35 25"/>
</g>

<!-- TwinMind wordmark -->
<text x="84" y="46" font-family="'Segoe UI',system-ui,sans-serif"
  font-size="28" font-weight="800" letter-spacing="-0.5"
  fill="url(#tg)">TwinMind</text>
<!-- Subtitle -->
<text x="85" y="64" font-family="'Segoe UI',system-ui,sans-serif"
  font-size="11" font-weight="500" letter-spacing="1.8"
  fill="rgba(148,163,184,0.85)">AI LEARNING PLATFORM</text>
</svg>"""

(OUT / "twinmind-logo-horizontal.svg").write_text(HORIZ_SVG, encoding="utf-8")
print("OK twinmind-logo-horizontal.svg (380x80 dark lockup)")


# ══════════════════════════════════════════════════════════════════════════════
# 5. MONOCHROME WHITE
# ══════════════════════════════════════════════════════════════════════════════
MONO_WHITE = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
  <clipPath id="wlc"><path d="{LEFT}"/></clipPath>
  <clipPath id="wrc"><path d="{RIGHT}"/></clipPath>
</defs>
<path d="{LEFT}"  fill="white" opacity="0.92"/>
<path d="{RIGHT}" fill="white" opacity="0.92"/>
<g clip-path="url(#wlc)">
  {_circuits(L_TRACES, "rgba(30,30,60,0.35)", 0.85)}
</g>
<g clip-path="url(#wrc)">
  {_circuits(R_TRACES, "rgba(30,30,60,0.35)", 0.85)}
</g>
<line x1="256" y1="108" x2="256" y2="382"
  stroke="rgba(30,30,60,0.25)" stroke-width="1.5" stroke-dasharray="5 4"/>
</svg>"""

(OUT / "twinmind-logo-monochrome-white.svg").write_text(MONO_WHITE, encoding="utf-8")
print("OK twinmind-logo-monochrome-white.svg")


# ══════════════════════════════════════════════════════════════════════════════
# 6. MONOCHROME GRADIENT (blue → purple)
# ══════════════════════════════════════════════════════════════════════════════
MONO_GRAD = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
  <linearGradient id="mg" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="#00D4FF"/>
    <stop offset="100%" stop-color="#8B5CF6"/>
  </linearGradient>
  <clipPath id="mglc"><path d="{LEFT}"/></clipPath>
  <clipPath id="mgrc"><path d="{RIGHT}"/></clipPath>
</defs>
<path d="{LEFT}"  fill="url(#mg)" opacity="0.92"/>
<path d="{RIGHT}" fill="url(#mg)" opacity="0.92"/>
<g clip-path="url(#mglc)">
  {_circuits(L_TRACES, "rgba(255,255,255,0.5)", 0.72)}
</g>
<g clip-path="url(#mgrc)">
  {_circuits(R_TRACES, "rgba(255,255,255,0.5)", 0.72)}
</g>
<line x1="256" y1="108" x2="256" y2="382"
  stroke="rgba(255,255,255,0.38)" stroke-width="1.5" stroke-dasharray="5 4"/>
</svg>"""

(OUT / "twinmind-logo-monochrome-gradient.svg").write_text(MONO_GRAD, encoding="utf-8")
print("OK twinmind-logo-monochrome-gradient.svg")


# ══════════════════════════════════════════════════════════════════════════════
# 7. OUTLINE ONLY (stroke, no fill)
# ══════════════════════════════════════════════════════════════════════════════
OUTLINE = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
  <linearGradient id="og" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="#00D4FF"/>
    <stop offset="100%" stop-color="#8B5CF6"/>
  </linearGradient>
  <clipPath id="olc"><path d="{LEFT}"/></clipPath>
  <clipPath id="orc"><path d="{RIGHT}"/></clipPath>
</defs>
<path d="{LEFT}"  fill="none" stroke="#00D4FF" stroke-width="4" opacity="0.9"/>
<path d="{RIGHT}" fill="none" stroke="#8B5CF6" stroke-width="4" opacity="0.9"/>
<g clip-path="url(#olc)">
  {_circuits(L_TRACES, "#00D4FF", 0.72, 2)}
</g>
<g clip-path="url(#orc)">
  {_circuits(R_TRACES, "#8B5CF6", 0.72, 2)}
</g>
<line x1="256" y1="108" x2="256" y2="382"
  stroke="rgba(150,150,255,0.45)" stroke-width="1.5" stroke-dasharray="5 4"/>
</svg>"""

(OUT / "twinmind-logo-outline.svg").write_text(OUTLINE, encoding="utf-8")
print("OK twinmind-logo-outline.svg")


# ══════════════════════════════════════════════════════════════════════════════
# 8. APP ICON (1024×1024, dark rounded-rect background)
# ══════════════════════════════════════════════════════════════════════════════
# Brain scaled 512→780, centred in 1024 (offset = 122 each side)
BSCALE = 780 / 512   # ≈ 1.523
BOX    = (1024 - 780) / 2  # ≈ 122

APP_ICON = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
<defs>
  <linearGradient id="alg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%"   stop-color="#00D4FF"/>
    <stop offset="100%" stop-color="#0066FF"/>
  </linearGradient>
  <linearGradient id="arg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%"   stop-color="#8B00FF"/>
    <stop offset="100%" stop-color="#FF00CC"/>
  </linearGradient>
  <radialGradient id="bgr" cx="35%" cy="30%" r="75%">
    <stop offset="0%"   stop-color="#0D1A38"/>
    <stop offset="100%" stop-color="#08081C"/>
  </radialGradient>
  <filter id="aglow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <clipPath id="alc"><path d="{LEFT}"/></clipPath>
  <clipPath id="arc"><path d="{RIGHT}"/></clipPath>
</defs>

<!-- App background -->
<rect width="1024" height="1024" rx="200" fill="#1A1A2E"/>
<rect width="1024" height="1024" rx="200" fill="url(#bgr)"/>

<!-- Brain: scale up and centre -->
<g transform="translate({BOX:.1f},{BOX:.1f}) scale({BSCALE:.4f})">
  <g filter="url(#aglow)">
    <path d="{LEFT}"  fill="url(#alg)" opacity="0.95"/>
    <path d="{RIGHT}" fill="url(#arg)" opacity="0.95"/>
  </g>
  <g clip-path="url(#alc)">
    {_circuits(L_TRACES, "#7FEFFF", 0.6)}
  </g>
  <g clip-path="url(#arc)">
    {_circuits(R_TRACES, "#D4A0FF", 0.6)}
  </g>
  <line x1="256" y1="108" x2="256" y2="382"
    stroke="rgba(255,255,255,0.35)" stroke-width="1" stroke-dasharray="5 4"/>
</g>
</svg>"""

(OUT / "twinmind-logo-app-icon.svg").write_text(APP_ICON, encoding="utf-8")
print("OK twinmind-logo-app-icon.svg (1024x1024 app store icon)")


# ══════════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════════
print("\n--- All files in /logo/ ---")
total = 0
for f in sorted(OUT.iterdir()):
    sz = f.stat().st_size
    total += sz
    kind = "PNG" if f.suffix == ".png" else "SVG"
    print(f"  [{kind}] {f.name:<48}  {sz:>8,} bytes")
print(f"\n  Total: {total:,} bytes across {len(list(OUT.iterdir()))} files")
