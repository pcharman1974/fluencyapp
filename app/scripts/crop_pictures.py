#!/usr/bin/env python3
"""Crop the picture from each story screenshot: the block of non-white pixels left of the text."""
import sys, numpy as np
from PIL import Image

def runs(mask):
    out, start = [], None
    for i, v in enumerate(list(mask) + [False]):
        if v and start is None: start = i
        if not v and start is not None: out.append((start, i)); start = None
    return out

def picture_box(im, cover=False):
    a = np.asarray(im.convert('RGB')).astype(int)
    H, W, _ = a.shape
    nonwhite = a.min(axis=2) < 232
    frame = (a[:, :, 2] > 200) & (a[:, :, 0] < 170)            # the light-blue frame round the page
    m = nonwhite & ~frame
    y0, y1 = int(.04 * H), int(.80 * H)                          # inside the panel, above the page counter
    x0, x1 = int(.03 * W), int(.80 * W if cover else .40 * W)
    sub = m[y0:y1, x0:x1]
    cols = sub.mean(axis=0) > .25
    cr = [r for r in runs(cols) if r[1] - r[0] > .04 * W]
    if not cr: return None
    c0, c1 = (min(r[0] for r in cr), max(r[1] for r in cr)) if cover else max(cr, key=lambda r: r[1] - r[0])
    rows = m[y0:y1, x0 + c0:x0 + c1].mean(axis=1) > .5
    rr = [r for r in runs(rows) if r[1] - r[0] > .04 * H]
    if not rr: return None
    r0, r1 = (min(r[0] for r in rr), max(r[1] for r in rr)) if cover else max(rr, key=lambda r: r[1] - r[0])
    return (x0 + c0 + 2, y0 + r0 + 2, x0 + c1 - 2, y0 + r1 - 2)

if __name__ == '__main__':
    src, dst, kind = sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'page'
    im = Image.open(src)
    box = picture_box(im, cover=kind == 'cover')
    if not box: sys.exit(f'no picture found in {src}')
    pic = im.convert('RGB').crop(box)
    if pic.width > 1200: pic = pic.resize((1200, round(pic.height * 1200 / pic.width)), Image.LANCZOS)
    pic.save(dst, quality=85)
    print(dst, box, pic.size)
