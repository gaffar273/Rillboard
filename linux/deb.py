"""Build a Debian desktop package from the portable release, without root."""
import io
from pathlib import Path
import tarfile
import json

root = Path(__file__).resolve().parents[1]
version = json.loads((root / "package.json").read_text())["version"]
dist = root / "dist"


def archive(entries):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz") as bundle:
        for name, content, mode in entries:
            info = tarfile.TarInfo("./" + name)
            info.size, info.mode = len(content), mode
            bundle.addfile(info, io.BytesIO(content))
    return output.getvalue()


control = f"""Package: rillboard
Version: {version}
Architecture: all
Maintainer: Rillboard maintainers
Depends: python3, xdg-utils
Description: Offline drawing whiteboard for the Linux desktop
"""
desktop = """[Desktop Entry]
Type=Application
Name=Rillboard
Exec=/bin/sh /usr/share/rillboard/linux/launch.sh
Icon=/usr/share/rillboard/icon.svg
Categories=Graphics;Education;
Terminal=false
"""
entries = [("usr/share/applications/rillboard.desktop", desktop.encode(), 0o644)]
with tarfile.open(dist / "rillboard-linux.tar.gz") as portable:
    for member in portable:
        if member.isfile():
            entries.append(("usr/share/" + member.name, portable.extractfile(member).read(), 0o644))

with (dist / "rillboard.deb").open("wb") as package:
    package.write(b"!<arch>\n")
    for name, content in [("debian-binary", b"2.0\n"),
                          ("control.tar.gz", archive([("control", control.encode(), 0o644)])),
                          ("data.tar.gz", archive(entries))]:
        header = f"{name + '/':<16}{0:<12}{0:<6}{0:<6}{'100644':<8}{len(content):<10}`\n"
        package.write(header.encode() + content + b"\n" * (len(content) % 2))
