#!/bin/bash
# Download Bun binary for Tauri sidecar bundling
# Usage: ./scripts/download-bun.sh <target-triple>
set -euo pipefail

TARGET="${1:?Usage: $0 <target-triple>}"
BUN_VERSION="latest"
DEST="src-tauri/binaries"
mkdir -p "$DEST"

case "$TARGET" in
  x86_64-unknown-linux-gnu)   BUN_PKG="bun-linux-x64" ;;
  aarch64-apple-darwin)       BUN_PKG="bun-darwin-aarch64" ;;
  x86_64-apple-darwin)        BUN_PKG="bun-darwin-x64" ;;
  x86_64-pc-windows-msvc)     BUN_PKG="bun-windows-x64" ;;
  *) echo "Unsupported target: $TARGET"; exit 1 ;;
esac

URL="https://github.com/oven-sh/bun/releases/$BUN_VERSION/download/$BUN_PKG.zip"
echo "Downloading $URL ..."
curl -fSL "$URL" -o /tmp/bun.zip
unzip -o /tmp/bun.zip -d /tmp/bun-extract

EXT=""
[[ "$TARGET" == *windows* ]] && EXT=".exe"

cp "/tmp/bun-extract/$BUN_PKG/bun$EXT" "$DEST/bun-$TARGET$EXT"
chmod +x "$DEST/bun-$TARGET$EXT"
rm -rf /tmp/bun.zip /tmp/bun-extract

echo "✅ Bun sidecar ready: $DEST/bun-$TARGET$EXT"
ls -lh "$DEST/bun-$TARGET$EXT"
