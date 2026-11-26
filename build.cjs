const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const destination = path.join(__dirname, 'dist');
const { execFileSync } = require('node:child_process');
const files = ['index.html', 'drawing.html', 'styles.css', 'india-boundary.js','perfect-freehand.js','shapes.js','geometry.js', 'device-storage.js', 'workspace-store.js', 'board-pdf.js','app.js', 'plugins.js', 'teacher.css', 'teacher-core.js', 'teacher-store.js', 'teacher.js', 'icon.svg'];
const drawing = fs.readFileSync(path.join(__dirname, 'drawing.html'), 'utf8');
if (!drawing.includes('id="canvas"') || !drawing.includes('src="app.js"')) {
  throw new Error('The standalone drawing entry must load the offline canvas.');
}
// The executable embeds drawing.html; index.html only hands off the Windows download.
for (const file of ['india-boundary.js','perfect-freehand.js','shapes.js','geometry.js', 'device-storage.js', 'workspace-store.js', 'board-pdf.js','app.js', 'plugins.js', 'teacher-core.js', 'teacher-store.js', 'teacher.js']) new vm.Script(fs.readFileSync(path.join(__dirname, file), 'utf8'), { filename: file });
if (path.resolve(destination) !== path.resolve(__dirname, 'dist')) throw new Error('Invalid build directory');
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
for (const file of files) fs.copyFileSync(path.join(__dirname, file), path.join(destination, file));
fs.cpSync(path.join(__dirname, 'fonts'), path.join(destination, 'fonts'), { recursive: true });
fs.copyFileSync(path.join(__dirname, 'Open Drawing.cmd'), path.join(destination, 'Open Drawing.cmd'));
for (const file of ['Install Drawing.cmd', 'install.ps1']) fs.copyFileSync(path.join(__dirname, file), path.join(destination, file));
fs.copyFileSync(path.join(__dirname, 'README.md'), path.join(destination, 'README.md'));
for (const file of ['TEACHER.md', 'Connect Teacher.cmd']) fs.copyFileSync(path.join(__dirname, file), path.join(destination, file));
fs.cpSync(path.join(__dirname,'teacher-bridge'),path.join(destination,'teacher-bridge'),{recursive:true});
fs.copyFileSync(path.join(__dirname, 'LICENSE'), path.join(destination, 'LICENSE'));
if (process.platform !== 'win32') throw new Error('Build the Windows executable on Windows with .NET Framework 4.8.');
// Windows PowerShell must not import PowerShell 7 modules inherited from a caller.
const buildEnv = { ...process.env, PSModulePath: path.join(process.env.WINDIR, 'System32/WindowsPowerShell/v1.0/Modules') };
execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'windows', 'build.ps1')], { stdio: 'inherit', env: buildEnv });
execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'windows', 'package.ps1')], { stdio: 'inherit', env: buildEnv });
console.log('Build successful. Open Rillboard.exe, or extract Rillboard Windows.zip and run Install Drawing.cmd.');
