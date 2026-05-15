#!/usr/bin/env python3
"""
remove-pet-bg.py — make pet PNGs have a transparent background.

Strategy: flood-fill all "white-ish" pixels CONNECTED TO THE BORDER
and set their alpha to 0. White pixels INSIDE the pet's body (belly
highlights, eye reflections) are NOT touched because they're enclosed
by the black outline.

Usage:
    python scripts/remove-pet-bg.py                          # process all
    python scripts/remove-pet-bg.py 01-emberlet.png ...      # specific files
"""

from __future__ import annotations
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

THRESHOLD = 230   # min RGB channel value to be considered "near-white"
PET_DIR = Path(__file__).resolve().parent.parent / "web-game" / "assets" / "pets"


def remove_exterior_white(path: Path) -> dict:
    """Modify the PNG at `path` in-place so border-connected white → transparent."""
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]

    # Mask of pixels that are "near white" — min of RGB channels >= threshold
    is_white = arr[..., :3].min(axis=2) >= THRESHOLD

    # BFS from every border pixel through the white region
    visited = np.zeros_like(is_white, dtype=bool)
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if is_white[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if is_white[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))

    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and is_white[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    # Set alpha to 0 for exterior white pixels
    arr[visited, 3] = 0

    # Optional cleanup: any pixel adjacent to the cleared region that has
    # alpha=255 but a faint white tint gets a gentler alpha (anti-aliased edge)
    # — skip for now; the flood-fill alone produces clean results.

    Image.fromarray(arr).save(path, "PNG", optimize=True)

    n_clear = int(visited.sum())
    pct = n_clear / (w * h) * 100
    return {"path": str(path.name), "cleared_px": n_clear, "pct": round(pct, 1)}


def main(argv: list[str]) -> int:
    if not PET_DIR.exists():
        print(f"  pet dir not found: {PET_DIR}", file=sys.stderr)
        return 1

    targets: list[Path]
    if argv:
        targets = [PET_DIR / a if "/" not in a and "\\" not in a else Path(a) for a in argv]
    else:
        targets = sorted(p for p in PET_DIR.glob("*.png") if p.name[0].isdigit())

    if not targets:
        print("  no PNGs found")
        return 0

    print(f"Processing {len(targets)} files...")
    for p in targets:
        if not p.exists():
            print(f"  skip {p.name} (not found)")
            continue
        try:
            r = remove_exterior_white(p)
            print(f"  OK   {r['path']}  ({r['cleared_px']:,} px cleared, {r['pct']}%)")
        except Exception as e:
            print(f"  FAIL {p.name}  -> {e}")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
