#!/bin/bash
# Generate PWA icons and iOS splash images from design/icon-source.jpg.
# Requires macOS `sips`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/design/icon-source.jpg"
OUT="$ROOT/public/icons"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$OUT"
W=$(sips -g pixelWidth "$SRC" | awk '/pixelWidth/ { print $2 }')
H=$(sips -g pixelHeight "$SRC" | awk '/pixelHeight/ { print $2 }')
SIDE=$(( W < H ? W : H ))

# Square master, centre-cropped.
sips -c "$SIDE" "$SIDE" -z 1024 1024 -s format jpeg -s formatOptions 92 "$SRC" --out "$TMP/master.jpg" >/dev/null 2>&1

sips -z 512 512 -s format png "$TMP/master.jpg" --out "$OUT/icon-512.png" >/dev/null 2>&1
sips -z 192 192 -s format png "$TMP/master.jpg" --out "$OUT/icon-192.png" >/dev/null 2>&1
sips -z 180 180 -s format png "$TMP/master.jpg" --out "$OUT/apple-touch-icon.png" >/dev/null 2>&1
mkdir -p "$ROOT/src/assets"
sips -z 128 128 -s format png "$TMP/master.jpg" --out "$ROOT/src/assets/brand-icon.png" >/dev/null 2>&1
sips -z 1024 1024 -s format png "$TMP/master.jpg" --out "$TMP/master.png" >/dev/null 2>&1

# iOS launch screens: icon centred on a background matching the artwork.
for spec in \
  "1170 2532" "1179 2556" "1290 2796" "1206 2622" \
  "1320 2868" "1125 2436" "828 1792" "750 1334"; do
  set -- $spec
  WIDTH=$1
  HEIGHT=$2
  SMALL=$(( WIDTH < HEIGHT ? WIDTH : HEIGHT ))
  ICON=$(( SMALL * 19 / 100 ))
  sips -z "$ICON" "$ICON" -s format png "$TMP/master.png" --out "$TMP/splash-icon.png" >/dev/null 2>&1
  sips -p "$HEIGHT" "$WIDTH" --padColor FAF5EC -s format png "$TMP/splash-icon.png" --out "$OUT/splash-${WIDTH}x${HEIGHT}.png" >/dev/null 2>&1
done

rm -f "$OUT/icon-192.jpg" "$OUT/icon-512.jpg" "$OUT/icon-maskable-512.jpg" "$OUT/icon-maskable-512.png"
echo "Icons written to $OUT"
