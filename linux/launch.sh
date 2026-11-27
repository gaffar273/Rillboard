#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
app=$(pwd -P)

# Snap browsers can only read visible files inside the home folder, so give
# them a copy there when the app is in a hidden or system folder.
use_visible_copy() {
    home=$(cd "$HOME" && pwd -P)
    case $app in
        "$home"/.* | "$home"/*/.*) ;;
        "$home"/*) return 0 ;;
    esac
    mkdir -p "$home/rillboard-app"
    cp -R "$app/." "$home/rillboard-app/"
    app=$home/rillboard-app
}

page_url() {
    python3 -c 'import sys; from pathlib import Path; print((Path(sys.argv[1]) / "drawing.html").as_uri())' "$app"
}

snap_bin=${SNAP_BIN:-/snap/bin}
for browser in chromium chromium-browser google-chrome google-chrome-stable; do
    if command -v "$browser" >/dev/null 2>&1; then
        case $browser in
            chromium*) if [ -x "$snap_bin/chromium" ]; then use_visible_copy; fi ;;
        esac
        exec "$browser" "--app=$(page_url)"
    fi
done
# Snap desktop entries are named <snap>_<app>.desktop.
case $(xdg-settings get default-web-browser 2>/dev/null || true) in
    firefox_*.desktop | chromium_*.desktop | brave_*.desktop | opera_*.desktop) use_visible_copy ;;
esac
exec xdg-open "$(page_url)"
