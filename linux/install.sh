#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
data=${XDG_DATA_HOME:-"$HOME/.local/share"}
target="$data/rillboard"
mkdir -p "$target" "$data/applications"
if [ "$(pwd -P)" != "$(cd "$target" && pwd -P)" ]; then
    cp -R . "$target/"
fi
cat > "$data/applications/rillboard.desktop" <<'ENTRY'
[Desktop Entry]
Type=Application
Name=Rillboard
Comment=Offline drawing whiteboard
Exec=sh linux/launch.sh
Terminal=false
Categories=Graphics;Education;
ENTRY
printf 'Path=%s\nIcon=%s/icon.svg\n' "$target" "$target" >> "$data/applications/rillboard.desktop"
printf 'Installed. Open Rillboard from your applications menu.\n'
