const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Board = require('../geometry.js');

// Run the unmodified app entry point against a small DOM adapter. Assertions use
// rendered SVG and saved drawing files, rather than exposing app internals.
function workspace(initial, { captureFails = false } = {}) {
  const nodes = new Map(), storage = new Map(), timers = new Map();
  let timerId = 0;
  class Surface {
    constructor(tagName = 'div') {
      this.listeners = new Map(); this.dataset = {}; this.style = { setProperty() {} };
      this.classList = { add() {}, remove() {}, toggle() {} };
      this.innerHTML = ''; this.value = ''; this.tagName = tagName.toUpperCase(); this.children = [];
      this.clientWidth = 1200; this.clientHeight = 800; this.captures = new Set();
    }
    addEventListener(name, handler) {
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push(handler);
    }
    emit(name, props = {}) {
      const e = { target: this, preventDefault() {}, stopPropagation() {}, ...props };
      for (const handler of this.listeners.get(name) || []) handler(e);
      return e;
    }
    setAttribute(name, value) { this[name] = String(value); }
    querySelectorAll(selector) {
      const dataKey = selector.match(/^\[data-(\w+)\]$/)?.[1];
      const matches = [];
      for (const child of this.children) {
        if (dataKey ? dataKey in child.dataset : child.tagName === selector.toUpperCase()) matches.push(child);
        matches.push(...child.querySelectorAll(selector));
      }
      return matches;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    appendChild(node) { this.children.push(node); node.parentElement = this; return node; }
    insertAdjacentHTML(position, markup) {
      this.innerHTML += markup;
      const parent = this, start = this.innerHTML.length - markup.length;
      this.lastElementChild = {
        dataset: {element: markup.match(/data-element="([^"]+)"/)?.[1]},
        set outerHTML(value) { parent.innerHTML = parent.innerHTML.slice(0,start) + value; }
      };
    }
    getContext() { return { measureText: text => ({ width: text.length * 12 }) }; }
    getBoundingClientRect() { return { left: 10, top: 20 }; }
    focus() { doc.activeElement = this; }
    setPointerCapture(id) {
      if (captureFails) throw new Error('Pointer capture unavailable');
      this.captures.add(id);
    }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) {
      this.captures.delete(id);
      this.emit('lostpointercapture', { pointerId: id });
    }
    contains(node) { return node === this || !!node?.parentElement && this.contains(node.parentElement); }
  }
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Surface());
    return nodes.get(selector);
  };
  const doc = new Surface(), win = new Surface();
  doc.body = new Surface(); doc.body.tagName = 'BODY'; doc.activeElement = doc.body;
  doc.documentElement = new Surface();
  doc.createElement = tagName => new Surface(tagName);
  doc.querySelector = selector => selector === 'dialog[open]' ? null : get(selector);
  win.Board = Board;
  if (initial) storage.set('local-excalidraw-v1', JSON.stringify(initial));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../device-storage.js'), 'utf8') + '\n' + fs.readFileSync(process.env.DRAWING_APP_SOURCE || path.join(__dirname, '../app.js'), 'utf8'), {
    window: win, document: doc, structuredClone, console,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id)
  }, { filename: 'app.js' });
  const canvas = get('#canvas');
  function pointer(name, props = {}, surface = canvas) {
    return surface.emit(name, {
      pointerId: 1, pointerType: 'pen', button: name === 'pointermove' ? -1 : 0,
      buttons: name === 'pointerup' ? 0 : 1, pressure: 0,
      clientX: 310, clientY: 320, shiftKey: false, ...props
    });
  }
  function saved() {
    // Flush only the app's debounced save, leaving notification timers alone.
    for (const [id, timer] of [...timers]) if (timer.ms === 350) { timers.delete(id); timer.fn(); }
    return JSON.parse(storage.get('local-excalidraw-v1') || '{"elements":[]}');
  }
  return {
    canvas, win, pointer, saved, marker: get('#pen-marker'),
    svg: () => get('#scene').innerHTML,
    key: (key, props = {}) => doc.emit('keydown', { key, ...props }),
    stroke(props = {}) {
      pointer('pointerdown', props);
      pointer('pointermove', { ...props, clientX: 340, clientY: 345 });
      pointer('pointerup', { ...props, clientX: 350, clientY: 350 });
    }
  };
}

test('pen moves batch rendering without rebuilding the existing scene or losing samples',()=>{
  const w=workspace();const frames=[];
  w.win.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};
  w.pointer('pointerdown');const initial=w.svg();
  for(let i=1;i<=30;i++)w.pointer('pointermove',{clientX:310+i,clientY:320+i});
  assert.equal(frames.length,1);
  assert.equal(w.svg(),initial,'pointer events must not rebuild the scene');
  w.pointer('pointerup',{clientX:345,clientY:355});
  assert.equal(w.saved().elements[0].points.length,32);
  frames[0]();assert.match(w.svg(),/<path/);
});

test('smooth pen stores tablet pressure including coalesced samples and retains pressure on lift',()=>{
  const w=workspace();w.pointer('pointerdown',{pressure:.1});
  w.pointer('pointermove',{clientX:340,clientY:335,pressure:.9,getCoalescedEvents:()=>[{clientX:320,clientY:325,pressure:.2},{clientX:330,clientY:330,pressure:.8}]});
  w.pointer('pointerup',{clientX:345,clientY:340,pressure:0});
  assert.deepEqual(w.saved().elements[0].points.map(p=>p[2]),[.1,.2,.8,.9,.9]);
  assert.match(w.svg(),/data-pressure-ink="true"/);
  const reopened=workspace(w.saved());assert.match(reopened.svg(),/data-pressure-ink="true"/);
});

test('pressure at a stationary pen tip is retained',()=>{
  const w=workspace();w.pointer('pointerdown',{pressure:.1});w.pointer('pointermove',{pressure:.9});w.pointer('pointerup');
  assert.deepEqual(w.saved().elements[0].points.map(p=>p[2]),[.1,.9]);
});

test('pen contact starts visible ink, retains batched samples and the lift endpoint', () => {
  const w = workspace();
  w.pointer('pointerdown');
  assert.match(w.svg(), /<circle /, 'even a light, zero-pressure contact is visible');
  w.pointer('pointermove', {
    clientX: 330, clientY: 330,
    getCoalescedEvents: () => [{ clientX: 315, clientY: 325 }, { clientX: 322, clientY: 328 }]
  });
  assert.match(w.svg(), /<path /, 'ink is visible before the pen lifts');
  w.pointer('pointerup', { clientX: 335, clientY: 335 });
  const [stroke] = w.saved().elements;
  assert.equal(stroke.type, 'pencil');
  assert.deepEqual(stroke.points, [[0, 0], [5, 5], [12, 8], [20, 10], [25, 15]]);
  assert.equal(w.canvas.dataset.tool, 'pencil');
});

test('successive pen strokes remain separate, survive reload and undo independently', () => {
  const w = workspace();
  w.stroke(); w.stroke({ pointerId: 8, clientX: 400, clientY: 400 });
  const data = w.saved();
  assert.equal(data.elements.length, 2);
  assert.notEqual(data.elements[0].id, data.elements[1].id);
  w.key('z', { ctrlKey: true });
  assert.equal(w.saved().elements.length, 1);
  w.key('z', { ctrlKey: true, shiftKey: true });
  assert.deepEqual(w.saved().elements, data.elements);
  const reloaded = workspace(data);
  assert.equal((reloaded.svg().match(/data-element=/g) || []).length, 2);
});

test('hover and pen barrel clicks produce no ink, including after pen-up', () => {
  const w = workspace();
  w.pointer('pointermove', { buttons: 0 });
  w.pointer('pointerdown', { button: 2, buttons: 2 });
  w.pointer('pointermove', { buttons: 2 });
  w.pointer('pointerup', { button: 2 });
  assert.equal(w.svg(), '');
  w.stroke();
  const svg = w.svg();
  w.pointer('pointermove', { buttons: 0, clientX: 900, clientY: 700 });
  assert.equal(w.svg(), svg);
});

test('a palm or another pointer cannot move, end or cancel the active pen stroke', () => {
  const w = workspace();
  w.pointer('pointerdown');
  const before = w.svg();
  for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    w.pointer(name, { pointerId: 2, pointerType: 'touch', clientX: 900, clientY: 700 });
  }
  assert.equal(w.svg(), before);
  w.pointer('pointermove', { clientX: 330, clientY: 340 });
  w.pointer('pointerup', { clientX: 340, clientY: 350 });
  assert.deepEqual(w.saved().elements[0].points, [[0, 0], [20, 20], [30, 30]]);
});

for (const interruption of ['pointercancel', 'lostpointercapture', 'blur']) {
  test(`${interruption} preserves completed ink, allows undo and frees the next stroke`, () => {
    const w = workspace();
    w.pointer('pointerdown');
    w.pointer('pointermove', { clientX: 330, clientY: 335 });
    if (interruption === 'blur') w.win.emit('blur');
    else w.pointer(interruption, { clientX: 999, clientY: 999 });
    assert.deepEqual(w.saved().elements[0].points, [[0, 0], [20, 15]]);
    assert.equal(w.canvas.captures.size, 0);
    w.stroke({ pointerId: 3 });
    assert.equal(w.saved().elements.length, 2);
    w.key('z', { ctrlKey: true });
    assert.equal(w.saved().elements.length, 1);
    w.key('z', { ctrlKey: true });
    assert.equal(w.saved().elements.length, 0);
  });
}

test('a missed pen-up finishes at the last contact point without a hover tail', () => {
  const w = workspace();
  w.pointer('pointerdown');
  w.pointer('pointermove', { clientX: 330, clientY: 335 });
  w.pointer('pointermove', { buttons: 0, clientX: 900, clientY: 700 });
  assert.deepEqual(w.saved().elements[0].points, [[0, 0], [20, 15]]);
  assert.equal(w.canvas.captures.size, 0);
  w.stroke();
  assert.equal(w.saved().elements.length, 2);
});

test('lifting the tip while holding the barrel button stops inking', () => {
  const w = workspace();
  w.pointer('pointerdown', { buttons: 3 });
  w.pointer('pointermove', { buttons: 3, clientX: 330, clientY: 335 });
  w.pointer('pointermove', { buttons: 2, clientX: 900, clientY: 700 });
  assert.deepEqual(w.saved().elements[0].points, [[0, 0], [20, 15]]);
});

test('mouse-emulating tablets can keep writing with Draw without a tool lock', () => {
  const w = workspace();
  w.key('p');
  w.stroke({ pointerType: 'mouse' }); w.stroke({ pointerType: 'mouse' });
  assert.equal(w.saved().elements.length, 2);
  assert.equal(w.canvas.dataset.tool, 'pencil');
});

test('a pen tap makes a saved, exportable dot, and tiny strokes retain their endpoint', () => {
  const w = workspace();
  w.pointer('pointerdown'); w.pointer('pointerup');
  assert.match(Board.svgDocument(w.saved().elements, '#ffffff'), /<circle /);
  w.pointer('pointerdown', { pointerId: 2, clientX: 410 });
  w.pointer('pointerup', { pointerId: 2, clientX: 410.1, clientY: 320.1 });
  assert.equal(w.saved().elements[1].points.length, 2);
});

test('Line picks one matching line at a crossing, keeps the tool, and moves only that line', () => {
  const w = workspace({elements:[
    {id:'across', type:'line', x:200, y:300, w:200, h:0},
    {id:'down', type:'line', x:300, y:200, w:0, h:200},
    {id:'box', type:'rectangle', x:200, y:200, w:200, h:200}
  ]});
  w.key('l');
  const mouse = {pointerType:'mouse'};
  w.pointer('pointerdown', mouse);
  w.pointer('pointerup', {...mouse, clientX:312});
  w.pointer('pointerdown', mouse);
  w.pointer('pointerup', {...mouse, clientX:330});
  assert.equal(w.canvas.dataset.tool, 'line');
  assert.deepEqual(w.saved().elements.map(e=>[e.id,e.x]), [['across',200],['down',320],['box',200]]);
  w.pointer('pointerdown', {...mouse, clientX:250});
  w.pointer('pointerup', {...mouse, clientX:250});
  w.key('Delete');
  assert.deepEqual(w.saved().elements.map(e=>e.id), ['down','box']);
});

test('dragging from an existing endpoint draws a connected line and can be undone once', () => {
  const original = {id:'first', type:'line', x:300, y:300, w:100, h:0};
  const w = workspace({elements:[original],view:{x:0,y:0,zoom:2}});
  w.key('l');
  w.pointer('pointerdown',{clientX:610,clientY:620});
  w.pointer('pointerup',{clientX:610,clientY:629});
  const lines = w.saved().elements;
  assert.equal(lines.length,2);
  assert.deepEqual([lines[1].x,lines[1].y,lines[1].w,lines[1].h],[300,300,0,4.5]);
  w.key('z',{ctrlKey:true});
  assert.deepEqual(w.saved().elements.map(e=>e.id),['first']);
});

test('writing over existing ink adds ink and never selects or moves it', () => {
  const w = workspace();
  w.stroke();
  w.pointer('pointerdown'); w.pointer('pointerup');
  assert.equal(w.saved().elements.length,2,'a tap on a stroke makes a dot');
  w.key('ArrowRight');
  w.stroke();
  const ink = w.saved().elements;
  assert.equal(ink.length,3,'a stroke that starts on earlier ink is drawn');
  assert.deepEqual(ink.map(e=>e.x),[300,300,300],'earlier ink stays in place');
});

test('a pen leaving the board marks its last position until it returns', () => {
  const w = workspace({elements:[],view:{x:40,y:60,zoom:2}});
  w.pointer('pointerleave',{pointerType:'mouse'});
  assert.notEqual(w.marker.hidden,false,'a mouse leaves no marker');
  w.stroke();
  w.pointer('pointermove',{buttons:0,clientX:410,clientY:420});
  w.pointer('pointerleave',{buttons:0});
  assert.equal(w.marker.hidden,false);
  assert.deepEqual([w.marker.style.left,w.marker.style.top],['400px','400px']);
  w.pointer('pointermove',{buttons:0,clientX:500,clientY:500});
  assert.equal(w.marker.hidden,true);
});

test('writing honors canvas offsets, pan and zoom', () => {
  const w = workspace({ elements: [], view: { x: 100, y: 80, zoom: 2 } });
  w.stroke();
  const [stroke] = w.saved().elements;
  assert.equal(stroke.x, 100); assert.equal(stroke.y, 110);
  assert.deepEqual(stroke.points, [[0, 0], [15, 12.5], [20, 15]]);
});

test('window events finish a stroke when a tablet driver cannot capture the pointer', () => {
  const w = workspace(undefined, { captureFails: true });
  w.pointer('pointerdown');
  w.pointer('pointermove', { clientX: 600, clientY: 550 }, w.win);
  w.pointer('pointerup', { clientX: 620, clientY: 560 }, w.win);
  assert.deepEqual(w.saved().elements[0].points, [[0, 0], [290, 230], [310, 240]]);
});

test('mouse selection, explicit pen shapes and the hand tool retain their behavior', () => {
  const w = workspace();
  w.stroke({ pointerType: 'mouse' });
  assert.equal(w.saved().elements.length, 0, 'mouse selection does not draw');
  w.key('r'); w.stroke();
  assert.equal(w.saved().elements[0].type, 'rectangle');
  assert.equal(w.canvas.dataset.tool, 'rectangle');
  w.key('h'); w.stroke();
  assert.equal(w.saved().elements.length, 1, 'the hand tool only pans');
  w.key('v');
  const shape = w.saved().elements[0];
  // Return to the shape after panning, and drag it with the selection tool.
  const view = w.saved().view;
  const clientX = shape.x * view.zoom + view.x + 10;
  const clientY = shape.y * view.zoom + view.y + 20;
  w.pointer('pointerdown', { clientX, clientY });
  w.pointer('pointerup', { clientX: clientX + 20, clientY: clientY + 20 });
  assert.equal(w.saved().elements.length, 1);
  assert.equal(w.saved().elements[0].x, shape.x + 20);
});

test('lasso uses the final pointer position even before a queued frame runs',()=>{
  const w=workspace({elements:[
    {id:'inside',type:'rectangle',x:100,y:100,w:10,h:10},
    {id:'outside',type:'rectangle',x:200,y:200,w:10,h:10}
  ]});
  const frames=[];
  w.win.requestAnimationFrame=fn=>frames.push(fn);
  const point=(name,x,y)=>w.pointer(name,{clientX:x+10,clientY:y+20});
  w.key('s');
  point('pointerdown',80,80);point('pointermove',130,80);
  point('pointermove',130,130);point('pointermove',80,130);point('pointerup',80,80);
  assert.equal(frames.length,1);
  frames[0]();w.key('Delete');
  assert.deepEqual(w.saved().elements.map(el=>el.id),['outside']);
});
