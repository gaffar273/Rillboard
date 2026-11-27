# Rillboard for Linux

Extract the archive and run `sh rillboard/linux/install.sh` as your normal
user. Open Rillboard from Applications, or run `sh rillboard/linux/launch.sh`
in the extracted folder for portable use.

Requires a graphical desktop, Python 3 and a modern browser. Chromium or
Google Chrome opens a dedicated app window; otherwise xdg-open uses the
default browser. No network connection is required.

Snap browsers cannot read hidden or system folders. When one is used, the
launcher copies the app to `~/rillboard-app` and opens it from there.

Use the same browser, profile and installation path to retain browser-local
boards. Export important boards before moving the app or clearing browser
data.

PDF export opens the browser's print window; choose **Save as PDF** there.

Live teaching needs the Windows app and is not included in this edition.
