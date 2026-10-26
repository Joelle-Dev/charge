#!/usr/bin/env python3
"""Build the app icons, transparent avatar and iOS splash screens from 果冻's transparent portrait."""
import math
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'design', 'cat-avatar.png')
PUBLIC = os.path.join(ROOT, 'public', 'icons')
AVATAR = os.path.join(ROOT, 'src', 'assets', 'brand-icon.png')
CREAM = (250, 245, 236)


def decode_png(path):
    data = open(path, 'rb').read()
    pos = 8
    idat = b''
    width = height = bit_depth = color_type = 0
    while pos < len(data):
        length = struct.unpack('>I', data[pos:pos + 4])[0]
        tag = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if tag == b'IHDR':
            width, height, bit_depth, color_type = struct.unpack('>IIBB', body[:10])
        elif tag == b'IDAT':
            idat += body
    if bit_depth != 8 or color_type != 6:
        raise SystemExit('Expected an 8-bit RGBA PNG')
    raw = zlib.decompress(idat)
    stride = width * 4
    previous = bytearray(stride)
    rows = []
    index = 0
    for _ in range(height):
        filter_type = raw[index]
        index += 1
        line = bytearray(raw[index:index + stride])
        index += stride
        if filter_type == 1:
            for x in range(4, stride):
                line[x] = (line[x] + line[x - 4]) & 255
        elif filter_type == 2:
            for x in range(stride):
                line[x] = (line[x] + previous[x]) & 255
        elif filter_type == 3:
            for x in range(stride):
                left = line[x - 4] if x >= 4 else 0
                line[x] = (line[x] + ((left + previous[x]) >> 1)) & 255
        elif filter_type == 4:
            for x in range(stride):
                left = line[x - 4] if x >= 4 else 0
                up = previous[x]
                up_left = previous[x - 4] if x >= 4 else 0
                p = left + up - up_left
                pa, pb, pc = abs(p - left), abs(p - up), abs(p - up_left)
                predictor = left if (pa <= pb and pa <= pc) else (up if pb <= pc else up_left)
                line[x] = (line[x] + predictor) & 255
        rows.append(line)
        previous = line
    return width, height, rows


def write_png(path, width, height, rows, color_type=6):
    bpp = 4 if color_type == 6 else 3
    raw = b''.join(b'\x00' + bytes(row) for row in rows)

    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)

    header = struct.pack('>IIBBBBB', width, height, 8, color_type, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as fh:
        fh.write(png)


def resize_rgba(src_w, src_h, rows, out_w, out_h):
    out = bytearray(out_w * out_h * 4)
    for y in range(out_h):
        sy = (y + 0.5) * src_h / out_h - 0.5
        y0 = max(0, min(src_h - 1, int(math.floor(sy))))
        y1 = min(src_h - 1, y0 + 1)
        ty = sy - y0
        for x in range(out_w):
            sx = (x + 0.5) * src_w / out_w - 0.5
            x0 = max(0, min(src_w - 1, int(math.floor(sx))))
            x1 = min(src_w - 1, x0 + 1)
            tx = sx - x0
            samples = []
            for yy, wy in ((y0, 1 - ty), (y1, ty)):
                for xx, wx in ((x0, 1 - tx), (x1, tx)):
                    weight = wy * wx
                    line = rows[yy]
                    idx = xx * 4
                    alpha = line[idx + 3] / 255
                    samples.append((line[idx] * alpha, line[idx + 1] * alpha, line[idx + 2] * alpha, alpha, weight))
            alpha = sum(sample[3] * sample[4] for sample in samples)
            if alpha <= 0:
                continue
            premul_r = sum(sample[0] * sample[4] for sample in samples)
            premul_g = sum(sample[1] * sample[4] for sample in samples)
            premul_b = sum(sample[2] * sample[4] for sample in samples)
            oi = (y * out_w + x) * 4
            out[oi:oi + 4] = bytes((
                round(premul_r / alpha),
                round(premul_g / alpha),
                round(premul_b / alpha),
                round(alpha * 255)
            ))
    return out


def flatten(avatar, width, height, background=CREAM):
    rows = []
    for y in range(height):
        row = bytearray()
        for x in range(width):
            idx = (y * width + x) * 4
            alpha = avatar[idx + 3] / 255
            row += bytes((
                round(avatar[idx] * alpha + background[0] * (1 - alpha)),
                round(avatar[idx + 1] * alpha + background[1] * (1 - alpha)),
                round(avatar[idx + 2] * alpha + background[2] * (1 - alpha))
            ))
        rows.append(row)
    return rows


def main():
    src_w, src_h, rows = decode_png(SOURCE)
    os.makedirs(PUBLIC, exist_ok=True)
    os.makedirs(os.path.dirname(AVATAR), exist_ok=True)

    avatar = resize_rgba(src_w, src_h, rows, 256, 256)
    write_png(AVATAR, 256, 256, [avatar[y * 1024:(y + 1) * 1024] for y in range(256)], 6)

    for size, name in ((512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')):
        resized = resize_rgba(src_w, src_h, rows, size, size)
        write_png(os.path.join(PUBLIC, name), size, size, flatten(resized, size, size), 2)

    splashes = (
        (1170, 2532), (1179, 2556), (1290, 2796), (1206, 2622),
        (1320, 2868), (1125, 2436), (828, 1792), (750, 1334)
    )
    for width, height in splashes:
        icon_size = int(min(width, height) * 0.24)
        icon = resize_rgba(src_w, src_h, rows, icon_size, icon_size)
        left = (width - icon_size) // 2
        top = (height - icon_size) // 2
        splash = []
        for y in range(height):
            row = bytearray(bytes(CREAM) * width)
            if top <= y < top + icon_size:
                for x in range(icon_size):
                    idx = ((y - top) * icon_size + x) * 4
                    alpha = icon[idx + 3] / 255
                    if alpha <= 0:
                        continue
                    r = round(icon[idx] * alpha + CREAM[0] * (1 - alpha))
                    g = round(icon[idx + 1] * alpha + CREAM[1] * (1 - alpha))
                    b = round(icon[idx + 2] * alpha + CREAM[2] * (1 - alpha))
                    pos = (left + x) * 3
                    row[pos:pos + 3] = bytes((r, g, b))
            splash.append(row)
        write_png(os.path.join(PUBLIC, f'splash-{width}x{height}.png'), width, height, splash, 2)

    print('Built 果冻 icons, avatar and splash screens')


if __name__ == '__main__':
    main()
