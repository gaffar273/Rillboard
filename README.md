# Rillboard

Rillboard is an offline whiteboard for Windows and Linux, with optional live teaching on Windows. Write with a pen, sketch diagrams, plot functions, and organize editable boards on your computer. Export drawings as PNG, SVG, or PDF.

## Install on Windows

1. Download `Rillboard-Windows.zip` from the [latest release](https://github.com/gaffar273/Rillboard/releases/latest) and extract it.
2. Run **Install Drawing.cmd** to create Desktop and Start menu shortcuts. You can also open **Rillboard.exe** directly.

Rillboard requires Windows 10 or 11 (64-bit), .NET Framework 4.8, and the Microsoft Edge WebView2 Runtime. Boards and history are stored under `%LOCALAPPDATA%\CraftSketchDesktop`. Installing an update keeps those files.

## Install on Linux

On Ubuntu, Debian or Linux Mint, install `downloads/rillboard.deb`. On other desktops, extract `downloads/rillboard-linux.tar.gz` and run `sh rillboard/linux/install.sh`. Rillboard needs Python 3 and a desktop browser; Chromium or Google Chrome opens it in its own window. Boards are stored in that browser's local storage. See [the Linux notes](linux/README.md).

## Live teaching

Live teaching is available in the Windows app only.

Open Rillboard’s menu, choose **Settings**, and select **Add plugin** under **Live teaching**. Select **Set up** to connect a local MCP client. Node.js 18 or later is required for the connector.

Ask your connected assistant to use the whiteboard. Each chat can keep a separate scrolling lesson. Use **Keep drawing** to annotate the board and **Pause live drawing** to pause incoming changes. See [the teaching guide](TEACHER.md) for setup and the tool interface.

## Build from source

On Windows, install Node.js 18 or later and run these commands from the repository root.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run verify:desktop
npm.cmd run verify:teacher
npm.cmd run verify:bridge
```

The build produces `dist\Rillboard.exe` and `dist\Rillboard Windows.zip`. The Windows app embeds the drawing workspace and fonts for offline use.

The Linux packages build on Linux or macOS with Node.js 18 or later, Python 3 and `tar`. `npm run build:linux` writes `dist/rillboard-linux.tar.gz` and `dist/rillboard.deb`; copy both into `downloads/` to publish them on the download page.

Rillboard is released under the [MIT License](LICENSE). The Windows package includes the third-party notices.
