const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist', 'rillboard-linux.tar.gz');
const files = ['drawing.html', 'icon.svg', 'styles.css', 'fonts', 'india-boundary.js',
  'perfect-freehand.js', 'shapes.js', 'geometry.js', 'device-storage.js', 'workspace-store.js',
  'board-pdf.js', 'app.js', 'plugins.js', 'teacher.css', 'teacher-core.js', 'teacher-store.js',
  ...(fs.existsSync(path.join(root, 'teacher-classroom.js')) ? ['teacher-classroom.js'] : []),
  'teacher.js', 'LICENSE', 'windows/THIRD-PARTY-NOTICES.txt', 'linux/install.sh',
  'linux/launch.sh', 'linux/README.md'];
const stage = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'rillboard-build-'));
try {
  for (const file of files) {
    const target = path.join(stage, 'rillboard', file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(root, file), target, { recursive: true });
    if (file.endsWith('.sh')) fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n'));
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  execFileSync('tar', ['-czf', output, '-C', stage, 'rillboard']);
  console.log(output);
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
