const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const skip = process.platform === 'win32';

// Runs the launcher with a stub browser and returns the argument it received.
function launch(folder, { snap }) {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rillboard-launch-')));
  try {
    const app = path.join(home, folder);
    const bin = path.join(home, 'bin');
    const snapBin = path.join(home, 'snap-bin');
    for (const dir of [path.join(app, 'linux'), bin, snapBin]) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(__dirname, '..', 'linux', 'launch.sh'), path.join(app, 'linux', 'launch.sh'));
    fs.writeFileSync(path.join(app, 'drawing.html'), 'page');
    fs.writeFileSync(path.join(bin, 'chromium'), '#!/bin/sh\nprintf %s "$1"\n', { mode: 0o755 });
    if (snap) fs.writeFileSync(path.join(snapBin, 'chromium'), '', { mode: 0o755 });
    const output = execFileSync('sh', [path.join(app, 'linux', 'launch.sh')], {
      encoding: 'utf8',
      env: { HOME: home, SNAP_BIN: snapBin, PATH: `${bin}:/usr/bin:/bin` },
    });
    const opened = (dir) => `--app=${pathToFileURL(path.join(home, dir, 'drawing.html'))}`;
    return { output, opened, copied: fs.existsSync(path.join(home, 'rillboard-app', 'drawing.html')) };
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test('snap Chromium opens a visible copy of a hidden install', { skip }, () => {
  const run = launch('.local/share/rillboard', { snap: true });
  assert.equal(run.output, run.opened('rillboard-app'));
});

test('snap Chromium opens a visible install in place', { skip }, () => {
  const run = launch('apps/rillboard', { snap: true });
  assert.equal(run.output, run.opened('apps/rillboard'));
  assert.equal(run.copied, false);
});

test('other Chromium builds open a hidden install in place', { skip }, () => {
  const run = launch('.local/share/rillboard', { snap: false });
  assert.equal(run.output, run.opened('.local/share/rillboard'));
  assert.equal(run.copied, false);
});
