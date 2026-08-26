#!/usr/bin/env python3
"""Genera le icone PNG dell'app "Frasi" (nessuna dipendenza esterna).

    python3 tools/make_icons_lingua.py

Disegna un fumetto con tre puntini: la frase che sta per uscire.
Stesso motore di rendering di make_icons.py (supersampling + PNG a mano).
"""
import os
import struct
import zlib

BG = (0x0D, 0x11, 0x17)
FG = (0x59, 0xD3, 0xB0)
RING = (0x2A, 0x34, 0x44)

SS = 3
BASE = 512


def circle(cx, cy, r):
    return lambda x, y: (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def ring(cx, cy, r_out, r_in):
    return lambda x, y: r_in * r_in <= (x - cx) ** 2 + (y - cy) ** 2 <= r_out * r_out


def polygon(points):
    def hit(x, y):
        inside = False
        n = len(points)
        for i in range(n):
            x1, y1 = points[i]
            x2, y2 = points[(i + 1) % n]
            if (y1 > y) != (y2 > y):
                xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
                if x < xi:
                    inside = not inside
        return inside

    return hit


# Fumetto: corpo arrotondato, coda in basso a sinistra, tre puntini.
R = 0.10
LEFT, RIGHT, TOP, BOTTOM = 0.18, 0.82, 0.26, 0.64

SHAPES = [
    (RING, ring(0.5, 0.5, 0.470, 0.442)),
    (FG, polygon([(LEFT + R, TOP), (RIGHT - R, TOP), (RIGHT - R, BOTTOM), (LEFT + R, BOTTOM)])),
    (FG, polygon([(LEFT, TOP + R), (RIGHT, TOP + R), (RIGHT, BOTTOM - R), (LEFT, BOTTOM - R)])),
    (FG, circle(LEFT + R, TOP + R, R)),
    (FG, circle(RIGHT - R, TOP + R, R)),
    (FG, circle(LEFT + R, BOTTOM - R, R)),
    (FG, circle(RIGHT - R, BOTTOM - R, R)),
    (FG, polygon([(0.30, 0.60), (0.48, 0.60), (0.32, 0.78)])),
    (BG, circle(0.34, 0.45, 0.047)),
    (BG, circle(0.50, 0.45, 0.047)),
    (BG, circle(0.66, 0.45, 0.047)),
]


def render(size):
    big = size * SS
    rows = []
    for py in range(big):
        row = []
        y = (py + 0.5) / big
        for px in range(big):
            x = (px + 0.5) / big
            color = BG
            for shape_color, hit in SHAPES:
                if hit(x, y):
                    color = shape_color
            row.append(color)
        rows.append(row)

    out = bytearray()
    area = SS * SS
    for y in range(size):
        out.append(0)  # filtro "None" per la scanline
        for x in range(size):
            r = g = b = 0
            for dy in range(SS):
                src = rows[y * SS + dy]
                for dx in range(SS):
                    c = src[x * SS + dx]
                    r += c[0]
                    g += c[1]
                    b += c[2]
            out += bytes((r // area, g // area, b // area, 255))
    return bytes(out)


def write_png(path, size, raw):
    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xFFFFFFFF)

    header = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png = (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', header)
        + chunk(b'IDAT', zlib.compress(raw, 9))
        + chunk(b'IEND', b'')
    )
    with open(path, 'wb') as fh:
        fh.write(png)
    print(f'{path} ({size}x{size}, {len(png) // 1024} KB)')


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(root, 'lingua', 'assets', 'icons')
    os.makedirs(out_dir, exist_ok=True)
    for size in (180, 192, 512):
        write_png(os.path.join(out_dir, f'icon-{size}.png'), size, render(size))


if __name__ == '__main__':
    main()
