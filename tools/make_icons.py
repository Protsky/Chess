#!/usr/bin/env python3
"""Genera le icone PNG dell'app (nessuna dipendenza esterna).

    python3 tools/make_icons.py

Disegna un pedone stilizzato su fondo scuro, con antialiasing per
supersampling, e salva le dimensioni richieste da iOS e dal manifest.
"""
import os
import struct
import zlib

BG = (0x12, 0x16, 0x1F)
FG = (0xE5, 0xB5, 0x67)
RING = (0x2A, 0x33, 0x45)

SS = 3  # fattore di supersampling
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


# Forme in coordinate normalizzate (0..1), origine in alto a sinistra.
SHAPES = [
    (RING, ring(0.5, 0.5, 0.470, 0.442)),
    (FG, circle(0.5, 0.30, 0.115)),
    (FG, polygon([(0.415, 0.415), (0.585, 0.415), (0.585, 0.462), (0.415, 0.462)])),
    (FG, polygon([(0.442, 0.462), (0.558, 0.462), (0.632, 0.700), (0.368, 0.700)])),
    (FG, polygon([(0.330, 0.700), (0.670, 0.700), (0.730, 0.790), (0.270, 0.790)])),
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

    # Downsampling a box filter -> antialiasing
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
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'icons')
    os.makedirs(out_dir, exist_ok=True)
    for size in (180, 192, 512):
        write_png(os.path.join(out_dir, f'icon-{size}.png'), size, render(size))


if __name__ == '__main__':
    main()
