(() => {
  'use strict';
  // Native writes complete on disk before callers report a successful save.
  // Migrate each old value on first read, retaining the browser copy for recovery.
  const native = window.chrome?.webview?.hostObjects?.sync?.drawingStorage;
  if (!native) { window.DrawingStorage = localStorage; return; }
  window.DrawingStorage = {
    separateHistory: true,
    getItem(key) {
      const saved = native.Read(key);
      if (saved !== null && saved !== undefined) return saved;
      const legacy = localStorage.getItem(key);
      if (legacy !== null) native.Write(key, legacy);
      return legacy;
    },
    setItem(key, value) { native.Write(key, String(value)); }
  };
})();
