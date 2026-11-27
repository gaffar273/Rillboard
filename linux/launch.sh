#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
url=$(python3 -c 'from pathlib import Path; print(Path("drawing.html").resolve().as_uri())')
for browser in chromium chromium-browser google-chrome google-chrome-stable; do
    if command -v "$browser" >/dev/null 2>&1; then
        exec "$browser" "--app=$url"
    fi
done
exec xdg-open "$url"
