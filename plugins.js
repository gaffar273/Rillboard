(() => {
  'use strict';
  const key = 'rillboard-plugin-teaching';
  const storage = window.DrawingStorage;
  const host = window.chrome?.webview;
  const button = document.querySelector('#plugin-toggle');
  const state = document.querySelector('#plugin-state');
  const error = document.querySelector('#plugin-error');
  const guide = document.querySelector('#connection-dialog');
  const command = document.querySelector('#bridge-command');
  let removeTeaching, stylesheet;
  const scripts = new Map();

  function loadScript(file) {
    if (scripts.has(file)) return scripts.get(file);
    const script = document.createElement('script');
    script.src = file;
    const loaded = new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => {
        scripts.delete(file);
        script.remove();
        reject(new Error('Could not load the teaching plugin. Try adding it again.'));
      };
    });
    scripts.set(file, loaded);
    document.head.append(script);
    return loaded;
  }

  function configureBridge(enabled) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('The connector did not respond. Reopen Rillboard and try again.')), 12000);
      function finish(failure) {
        clearTimeout(timer);
        host.removeEventListener('message', receive);
        if (failure) reject(failure);
        else resolve();
      }
      function receive({data}) {
        if (data?.type === 'teaching-plugin-result') finish(data.error && new Error(data.error));
      }
      host.addEventListener('message', receive);
      host.postMessage(JSON.stringify({type:'teaching-plugin', enabled}));
    });
  }

  async function changePlugin(enable, showGuide) {
    button.disabled = true;
    error.textContent = '';
    try {
      if (enable) {
        for (const file of ['teacher-core.js','teacher-store.js','teacher.js']) await loadScript(file);
        stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = 'teacher.css';
        document.head.append(stylesheet);
        removeTeaching = window.installGPTTeaching();
        await configureBridge(true);
        storage.setItem(key, 'on');
        if (showGuide) openGuide();
      } else {
        await configureBridge(false);
        removeTeaching?.();
        removeTeaching = null;
        stylesheet?.remove();
        storage.setItem(key, 'off');
      }
    } catch (failure) {
      if (enable) {
        removeTeaching?.();
        removeTeaching = null;
        stylesheet?.remove();
        try { await configureBridge(false); } catch {}
      }
      error.textContent = failure.message;
    } finally {
      state.textContent = removeTeaching ? 'Added to Rillboard' : 'Available to add';
      button.textContent = removeTeaching ? 'Remove plugin' : 'Add plugin';
      button.disabled = false;
    }
  }

  const client = document.querySelector('#bridge-client');
  const writing = document.querySelector('#writing-mode');
  writing.value = storage.getItem('teaching-writing') || 'quick';
  writing.onchange = () => storage.setItem('teaching-writing', writing.value);
  function updateGuide() {
    const path = host.hostObjects.sync.drawingStorage.ConnectorPath();
    const arg = "'" + path.replaceAll("'", "''") + "'";
    const config = JSON.stringify({mcpServers:{'elixdraw-teacher':{command:'node',args:[path]}}}, null, 2);
    const guides = {
      codex: ['Run this in PowerShell with the Codex CLI installed.', 'codex mcp add elixdraw-teacher -- node ' + arg],
      gemini: ['Run this in PowerShell with Gemini CLI installed. Open Gemini CLI in a trusted folder and check /mcp.', 'gemini mcp add --scope user elixdraw-teacher node ' + arg],
      claude: ['In Claude Desktop, open Settings → Developer → Edit Config. Merge this server entry into your configuration, save and restart Claude.', config],
      other: ['In your client’s local MCP settings, add a stdio server using this command and argument.', config]
    };
    const [instructions, setup] = guides[client.value];
    document.querySelector('#client-instructions').textContent = instructions;
    command.textContent = setup;
    document.querySelector('#copy-command').textContent = 'Copy setup';
  }
  client.onchange = () => { storage.setItem('teaching-client', client.value); updateGuide(); };
  function openGuide() {
    client.value = storage.getItem('teaching-client') || 'codex';
    updateGuide();
    guide.showModal();
  }
  button.onclick = () => changePlugin(!removeTeaching, true);
  document.querySelector('#guide-open').onclick = openGuide;
  document.querySelector('#guide-close').onclick = () => guide.close();
  document.querySelector('#copy-command').onclick = async event => {
    const copy = event.currentTarget;
    try {
      await navigator.clipboard.writeText(command.textContent);
      copy.textContent = 'Copied';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(command);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      copy.textContent = 'Press Ctrl+C to copy';
    }
  };
  changePlugin(storage.getItem(key) === 'on', false);
})();
