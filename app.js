(() => {
  'use strict';
  const B = window.Board, $ = selector => document.querySelector(selector), $$ = selector => [...document.querySelectorAll(selector)];
  const icons = {
    settings:'M3 7h9m4 0h5M3 17h3m4 0h11M12 4v6M7 14v6',menu:'M5 12h.1M12 12h.1M19 12h.1',cursor:'m5 3 14 10-7 1-3 7-4-18Z',hand:'M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 5-3 7-7 7-3 0-5-2-6-4l-3-5a1.5 1.5 0 0 1 2-2l2 2Z',rectangle:'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z',diamond:'m12 3 9 9-9 9-9-9 9-9Z',ellipse:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',arrow:'M4 12h16m-6-6 6 6-6 6',line:'M4 20 20 4',pencil:'m4 16 12-12a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3L8 20l-5 1 1-5Zm10-10 4 4M4 16l4 4',text:'M4 5h16M12 5v15m-4 0h8',image:'M4 4h16v16H4V4Zm0 12 5-5 5 5 3-3 3 3M16 8h.01',eraser:'m4 14 9-10a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 9H9l-5-5a2 2 0 0 1 0-2Zm3-3 9 8m-3 2h9',unlock:'M8 10V7a4 4 0 0 1 7-3M6 10h12v11H6V10Zm6 4v3',lock:'M8 10V7a4 4 0 0 1 8 0v3M6 10h12v11H6V10Zm6 4v3',library:'M4 4h4v16H4V4Zm7 0h4v16h-4V4Zm6 1 3-1 4 15-3 1-4-15Z',export:'M12 15V3m-4 4 4-4 4 4M5 11v9h14v-9',folder:'M3 7V5h6l2 2h10v13H3V7Zm0 3h18',help:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01',sparkles:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Zm7-1v4m-2-2h4',shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',minus:'M5 12h14',plus:'M5 12h14M12 5v14',undo:'M8 5 3 10l5 5M3 10h10a7 7 0 0 1 7 7v2',redo:'m16 5 5 5-5 5m5-5H11a7 7 0 0 0-7 7v2',fit:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8V8Z',close:'m6 6 12 12M6 18 18 6',save:'M4 3h13l4 4v14H3V3h1Zm3 0v7h10V3M7 21v-7h10v7',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',sun:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',moon:'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',back:'M9 3h12v12h-5M3 9h12v12H3V9Z',front:'M3 9h6V3h12v12h-6v6H3V9Zm6 0h6v6',copy:'M9 3h12v12h-5M3 9h12v12H3V9Z'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65"><path d="${icons[name] || icons.rectangle}"/></svg>`;
  function hydrate(scope = document) { scope.querySelectorAll('[data-icon]').forEach(el => { if (!el.querySelector('svg')) el.insertAdjacentHTML('afterbegin',icon(el.dataset.icon)); }); }
  hydrate();
  const canvas = $('#canvas'), scene = $('#scene'), selection = $('#selection'), editor = $('#text-editor');
  const STORAGE = 'local-excalidraw-v1';
  let inkWidthChosen=false;
  const defaults = { penStyle:'pen', stroke:'#1e1e1e',fill:'transparent',fillStyle:'hachure',strokeWidth:1.5,dash:'solid',rough:1,opacity:100,fontSize:24 };
  const textDefaults={fontFace:'hand',bold:false,italic:false,underline:false};
  let autoInkOnBlank=true,homeDismissed=false;
  let elements = [], selected = new Set(), tool = 'select', locked = true, background = '#ffffff', theme = 'light';
  let view = {x:0,y:0,zoom:1}, past = [], future = [], gesture = null, editing = null, space = false, saveTimer, toastTimer, clipboard = [];
  let storageAvailable = true, documentName = 'Untitled', workspace = null, workspaceError = '';
  try {
    const stored = window.DrawingStorage.getItem(STORAGE);
    if (stored) {
      const data = JSON.parse(stored), parsed = B.parseScene(data);
      elements = parsed.elements; background = parsed.background;
      if (data.theme === 'dark') theme = 'dark';
      if (data.view) view = {x:B.num(data.view.x),y:B.num(data.view.y),zoom:B.clamp(B.num(data.view.zoom,1),.1,5)};
      if (typeof data.name === 'string') documentName = data.name.slice(0,100);
    }
  } catch { storageAvailable = false; }
  const workspaceScene = () => ({elements,background,view,name:documentName});
  if (window.WorkspaceStore) {
    try {
      workspace = new window.WorkspaceStore(window.DrawingStorage);
      const data = workspace.current() ? workspace.readScene() : workspace.create(workspaceScene(),documentName);
      const parsed = B.parseScene(data);
      elements=parsed.elements;background=parsed.background;documentName=data.name || 'Untitled';
      if(data.view)view={x:B.num(data.view.x),y:B.num(data.view.y),zoom:B.clamp(B.num(data.view.zoom,1),.1,5)};
    } catch { workspace=null;workspaceError='Boards could not be loaded. Your canvas still works; save a drawing file to keep your work.'; }
  }
  const snapshot = () => JSON.stringify({elements,background});
  function commit(before, changedShape = null) {
    const entry=changedShape?{addedId:changedShape.id}:before;
    if(changedShape || before !== snapshot()) { past.push(entry); if (past.length > 100) past.shift(); future = []; }
    render(changedShape); scheduleSave();
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    $('#save-state').classList.add('visible');
    $('#save-state span:last-child').textContent = 'Saving…';
    saveTimer = setTimeout(saveLocal,350);
  }
  function saveLocal() {
    clearTimeout(saveTimer);
    if(gesture){saveTimer=setTimeout(saveLocal,350);return true;}
    try {
      if(workspace)workspace.save(workspaceScene());
      window.DrawingStorage.setItem(STORAGE,JSON.stringify({elements,background,theme,view,name:documentName}));
      storageAvailable = true;
      $('#save-state span:last-child').textContent = 'Saved locally';
      $('#save-state .status-dot').style.background = '';
      $('#board-title').textContent=documentName;
      return true;
    } catch {
      storageAvailable = false;
      $('#save-state span:last-child').textContent = 'Save a file to keep your work';
      $('#save-state .status-dot').style.background = '#d69038';
      toast('Could not save on this device. Use Save to file to keep your drawing.');
      return false;
    }
  }
  function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(()=>$('#toast').hidden=true,4000); }
  function updateTheme() {
    document.body.classList.toggle('dark',theme==='dark');
    document.documentElement.style.setProperty('--page',background);
    $$('[data-theme]').forEach(el=>el.classList.toggle('active',el.dataset.theme===theme));
  }
  function paintDraft(shape) {
    const markup = B.elementSvg(B.visibleElement(shape,background));
    const previous = scene.lastElementChild;
    if (previous?.dataset.element === shape.id) previous.outerHTML = markup;
    else scene.insertAdjacentHTML('beforeend',markup);
  }
  function transformLayers() {
    scene.setAttribute('transform',`translate(${view.x} ${view.y}) scale(${view.zoom})`);
    selection.setAttribute('transform',`translate(${view.x} ${view.y}) scale(${view.zoom})`);
  }
  function renderViewport(zoomChanged=false) {
    transformLayers();
    if(zoomChanged){renderSelection();$('#zoom-reset').textContent=Math.round(view.zoom*100)+'%';}
    if(editing)positionEditor();
    window.Teacher?.viewportChanged?.(false);
  }
  let viewportFrame=0,zoomPending=false;
  function queueViewport(zoomChanged=false){
    zoomPending ||= zoomChanged;
    if(viewportFrame)return;
    const paint=()=>{
      viewportFrame=0;
      renderViewport(zoomPending);
      zoomPending=false;
    };
    if(window.requestAnimationFrame)viewportFrame=window.requestAnimationFrame(paint);
    else paint();
  }
  function render(changedShape = null) {
    transformLayers();
    if (changedShape) paintDraft(changedShape);
    else scene.innerHTML = elements.filter(e=>e.id!==editing?.id).map(e=>B.elementSvg(B.visibleElement(e,background))).join('');
    refreshControls();
    updateProperties();
    window.Teacher?.viewportChanged?.();
  }
  function refreshControls() {
    renderSelection();
    const empty = !elements.length && !editing;
    if(!empty)homeDismissed=false;
    $('#welcome').hidden=!empty||homeDismissed;
    $('#undo-button').disabled = !past.length;
    $('#redo-button').disabled = !future.length;
    $('#zoom-reset').textContent = Math.round(view.zoom*100)+'%';
    updateTheme();
    if (editing) positionEditor();
  }
  function renderSelection() {
    const b = selected.size ? B.union(elements.filter(e=>selected.has(e.id))) : null;
    let svg = '';
    if (b && !editing) {
      const pad = 5/view.zoom, r = 3.5/view.zoom;
      svg = `<rect x="${b.x-pad}" y="${b.y-pad}" width="${b.w+2*pad}" height="${b.h+2*pad}" fill="none" stroke="#6965db" stroke-width="${1/view.zoom}"/>`;
      for (const [handle,x,y] of [['nw',b.x-pad,b.y-pad],['ne',b.x+b.w+pad,b.y-pad],['se',b.x+b.w+pad,b.y+b.h+pad],['sw',b.x-pad,b.y+b.h+pad]]) svg += `<rect data-handle="${handle}" x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" rx="${1/view.zoom}" fill="${theme==='dark'?'#232329':'white'}" stroke="#6965db" stroke-width="${1/view.zoom}" style="cursor:${handle==='nw'||handle==='se'?'nwse':'nesw'}-resize"/>`;
    }
    if(b&&!editing)svg+=`<path d="M${b.x+b.w/2} ${b.y-5/view.zoom}v${-22/view.zoom}" stroke="#6965db"/><circle data-handle="rotate" cx="${b.x+b.w/2}" cy="${b.y-30/view.zoom}" r="${6/view.zoom}" fill="white" stroke="#6965db" style="cursor:grab"/>`;
    if (gesture?.kind==='marquee'||gesture?.kind==='areaErase') {
      const a=gesture.start,p=gesture.current;
      svg+=`<rect x="${Math.min(a.x,p.x)}" y="${Math.min(a.y,p.y)}" width="${Math.abs(a.x-p.x)}" height="${Math.abs(a.y-p.y)}" fill="#18756918" stroke="#6965db" stroke-width="${1/view.zoom}"/>`;
    }
    if(gesture?.kind==='lasso')svg+=`<path d="${gesture.points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ')}Z" fill="#18756918" stroke="#6965db" stroke-width="${1/view.zoom}"/>`;
    selection.innerHTML = svg;
  }
  const propertyGroups=$$('#properties [data-property]');
  const gridDefaults={stroke:'#527aab',opacity:100};
  const penPresets={pen:[2.5,100],pencil:[2,100],marker:[6,100],highlighter:[16,28]};
  function styleControls(type){
    if(type==='pencil')return ['pen','stroke','width','opacity'];
    if(type==='text')return ['stroke','text','opacity'];
    if(type==='image')return ['opacity'];
    if(type==='graphpaper')return ['stroke','opacity'];
    if(type==='line'||type==='arrow')return ['stroke','width','dash','rough','opacity'];
    if(B.shapes[type])return ['stroke','fill','width','dash','opacity',...(['rectangle','ellipse','diamond'].includes(type)?['rough']:[])];
    return [];
  }
  function showChoice(button, pressed, activeClass='active'){
    button.classList.toggle(activeClass,pressed===true);
    button.setAttribute('aria-pressed',String(pressed));
  }
  function showOptions(selector, attribute, current){
    for(const button of $$(selector+' button')){
      showChoice(button,button.dataset[attribute]===String(current));
    }
  }
  function showColor(key, color){
    const row=$('#'+key+'-colors');
    const value=color?.toLowerCase();
    let colorName;
    for(const button of row.querySelectorAll('[data-color]')){
      const matches=button.dataset.color===value;
      showChoice(button,matches,'selected');
      if(matches)colorName=button.title;
    }
    const custom=row.querySelector('input');
    // Native color inputs take six RGB digits, including when an imported swatch uses shorthand or alpha.
    const hex=value?.slice(1)||'';
    const rgb=hex.length===3||hex.length===4?Array.from(hex.slice(0,3),digit=>digit+digit).join(''):hex.slice(0,6);
    custom.value=/^[0-9a-f]{6}$/.test(rgb)?'#'+rgb:(key==='fill'?'#ffffff':'#1e1e1e');
    custom.parentElement.classList.toggle('selected',!!value&&!colorName);
    $('#'+key+'-value').textContent=colorName||(color?color.toUpperCase():'Mixed');
  }
  function showOpacity(value){
    const text=value===undefined?'Mixed':value+'%';
    $('#opacity-value').textContent=text;
    $('#opacity').setAttribute('aria-valuetext',text);
  }
  function updateStylePreview(type, style, textStyle, subjects) {
    const preview = $('#style-preview');
    const supported = B.shapes[type] || ['pencil','text','graphpaper'].includes(type);
    preview.hidden = tool === 'eraser' || subjects.length > 1 || !supported;
    if (preview.hidden || !$('#style-toggle[aria-expanded="true"]')) return;

    // The preview ID contains a period, which drawing element IDs cannot contain.
    const sample = {...style, id:'style.sample', type, angle:0};
    const preset = subjects.length ? B.shapes[type] : B.shapes[tool];
    const aspect = subjects.length && style.w && style.h ? B.clamp(Math.abs(style.w/style.h), .25, 4)
      : preset?.aspect || (['rectangle','ellipse'].includes(type) ? 1.7 : 1);
    sample.h = Math.min(32, 118 / aspect);
    sample.w = sample.h * aspect;
    sample.x = (216 - sample.w) / 2;
    sample.y = (50 - sample.h) / 2;
    if (type === 'pencil') {
      Object.assign(sample, {x:36,y:28,smoothInk:true,plotCurve:false,points:[
        [0,8,.15], [17,4,.45], [36,-5,.8], [51,-13,.9], [59,-14,.7], [61,-7,.45],
        [58,2,.25], [62,6,.35], [77,-1,.55], [92,-7,.75], [102,-6,.65],
        [102,0,.4], [109,3,.3], [123,0,.4], [144,-3,.15]
      ]});
    } else if (type === 'line' || type === 'arrow') {
      Object.assign(sample, {x:40,y:33,w:136,h:-16});
    } else if (type === 'text') {
      const fontSize = Math.min(style.fontSize * .8, 38);
      Object.assign(sample, {fontFace:textStyle.fontFace, bold:textStyle.bold, italic:textStyle.italic,
        underline:textStyle.underline, text:'Aa', fontSize, x:108, y:25 - fontSize * .77});
    } else if (type === 'graphpaper') {
      Object.assign(sample, {x:49,w:118,gridSize:8});
    }
    const drawing = B.elementSvg(B.visibleElement(sample, background));
    preview.innerHTML = '<svg viewBox="0 0 216 50" aria-hidden="true" text-anchor="middle">' + drawing + '</svg>';
  }
  function updateProperties() {
    const chosen=selected.size?elements.filter(el=>selected.has(el.id)):[];
    const subjects=editing?[editing.shape]:chosen;
    const types=subjects.length?[...new Set(subjects.map(el=>el.type))]:[B.shapes[tool]?.type||tool];
    const capabilities=types.map(styleControls);
    const erasing=tool==='eraser';
    const subject = subjects.length ? subjects[0].type : tool;
    const subjectNames = {pencil:'Freehand', text:'Text', graphpaper:'Graph paper', image:'Image', eraser:'Eraser'};
    const context = subjects.length > 1 ? subjects.length + ' selected' : B.shapes[subject]?.name || subjectNames[subject] || '';
    const badge = $('#style-subject');
    if (badge.textContent !== context) {
      badge.textContent = context;
      $('.style-body').scrollTop = 0;
    }
    for(const group of propertyGroups){
      const key=group.dataset.property;
      group.hidden=erasing||(key==='layers'? !chosen.length : !capabilities.every(keys=>keys.includes(key)));
    }
    $('#eraser-options').hidden=!erasing;
    $('#properties').hidden=false;
    $('#style-empty').hidden=erasing||chosen.length>0||capabilities[0].length>0;
    const style=subjects.length?{...subjects[0]}:tool==='graphpaper'?{...defaults,...gridDefaults}:defaults;
    if(subjects.length>1)for(const key of [...Object.keys(defaults),...Object.keys(textDefaults)]){
      if(subjects.some(el=>el[key]!==style[key]))style[key]=undefined;
    }
    const textStyle=subjects[0]?.type==='text'?style:textDefaults;
    $('#font-face').value=subjects.length>1&&subjects.some(el=>(el.fontFace||'hand')!==(subjects[0].fontFace||'hand'))?'':textStyle.fontFace||'hand';
    for(const button of $$('[data-format]')){
      const key=button.dataset.format;
      const mixed=subjects.some(el=>!!el[key]!==!!subjects[0][key]);
      showChoice(button,mixed?'mixed':!!textStyle[key]);
    }
    showOptions('#pen-style','pen',subjects.length>1?style.penStyle:style.penStyle||'pen');
    showColor('stroke',style.stroke);
    showColor('fill',style.fill);
    const presetWidth=types.length===1 && types[0]==='pencil' ? penPresets[style.penStyle]?.[0] : undefined;
    const presetButton=$('#pen-preset-width');
    presetButton.hidden=!presetWidth || presetWidth===2.5;
    if(!presetButton.hidden){
      presetButton.dataset.width=String(presetWidth);
      presetButton.textContent=presetWidth+' px';
      presetButton.title='Tool default · '+presetWidth+' px';
    }
    showOptions('#width-options','width',style.strokeWidth);
    showOptions('#dash-options','dash',style.dash);
    showOptions('#fill-options','fill',style.fillStyle);
    showOptions('#rough-options','rough',style.rough);
    showOptions('#font-options','font',style.fontSize);
    $('#stroke-heading').textContent=types.every(type=>type==='text')?'Text color':'Stroke color';
    $('#width-value').textContent=style.strokeWidth===undefined?'Mixed':style.strokeWidth+' px';
    $('#dash-value').textContent=$('#dash-options .active')?.title||'Mixed';
    $('#font-size-value').textContent=style.fontSize===undefined?'Mixed':style.fontSize+' px';
    $('#opacity').value=style.opacity??100;
    showOpacity(style.opacity);
    updateStylePreview(types[0], style, textStyle, subjects);
  }
  function formatText(key,value){
    textDefaults[key]=value;
    if(editing){editing.shape[key]=value;positionEditor();updateProperties();return;}
    const before=snapshot();
    for(const el of elements)if(selected.has(el.id)&&el.type==='text'){el[key]=value;measureText(el);}
    commit(before);updateProperties();
  }
  $('#font-face').onchange=e=>{
    formatText('fontFace',e.target.value);
    if(editing)editor.focus();
  };
  for(const button of document.querySelectorAll('[data-format]')){
    button.onmousedown=e=>e.preventDefault();
    button.onclick=()=>formatText(button.dataset.format,button.getAttribute('aria-pressed')!=='true');
  }
  function setStyle(key,value) {
    if(key==='strokeWidth')inkWidthChosen=true;
    if(editing){editing.shape[key]=value;positionEditor();updateProperties();return;}
    const before = snapshot();
    if(tool==='graphpaper'&&key in gridDefaults)gridDefaults[key]=value;
    else defaults[key]=value;
    elements.forEach(e=>{if(selected.has(e.id)) { e[key]=value; if(key==='fontSize'&&e.type==='text')measureText(e); }});
    commit(before); updateProperties();
  }
  function swatch(color,name,fn) {
    const button=document.createElement('button'); button.className='color-swatch';button.dataset.color=color;button.title=name;button.setAttribute('aria-label',name);
    button.style.background=color==='transparent'?'linear-gradient(45deg, transparent 45%, #b9b7c2 46%, #b9b7c2 52%, transparent 53%), var(--panel)':color;
    button.onclick=()=>fn(color);return button;
  }
  function setupColors(selector,colors,key) {
    const root=$(selector);
    colors.forEach(([color,name])=>root.appendChild(swatch(color,name,v=>setStyle(key,v))));
    const divider=document.createElement('span');divider.className='color-divider';root.appendChild(divider);
    const picker=document.createElement('label');
    picker.className='custom-color-control';
    picker.title='Custom '+key+' color';
    picker.innerHTML=icon('plus');
    const custom=document.createElement('input');
    custom.type='color';
    custom.className='custom-color';
    custom.setAttribute('aria-label',picker.title);
    custom.addEventListener('change',()=>setStyle(key,custom.value));
    picker.appendChild(custom);
    root.appendChild(picker);
  }
  setupColors('#stroke-colors',[['#1e1e1e','Black'],['#e03131','Red'],['#2f9e44','Green'],['#1971c2','Blue'],['#f08c00','Orange']],'stroke');
  setupColors('#fill-colors',[['transparent','Transparent'],['#ffc9c9','Light red'],['#b2f2bb','Light green'],['#a5d8ff','Light blue'],['#ffec99','Light yellow']],'fill');
  [['#ffffff','White'],['#f8f9fa','Gray'],['#f5faff','Blue'],['#fffce8','Yellow'],['#f9f5ff','Purple']].forEach(([color,name])=>$('#background-options').appendChild(swatch(color,name,()=>{const before=snapshot();background=color;commit(before);} )));
  const shortcuts = {g:'graphpaper',s:'lasso',v:'select','1':'select',h:'hand',r:'rectangle','2':'rectangle',d:'diamond','3':'diamond',o:'ellipse','4':'ellipse',a:'arrow','5':'arrow',l:'line','6':'line',p:'pencil','7':'pencil',t:'text','8':'text','9':'image',e:'eraser','0':'eraser'};
  function setTool(value,explicit=false) {
    if(editing) finishText();
    if(value==='image') { $('#image-input').click(); return; }
    if(value==='select'&&explicit)autoInkOnBlank=false;
    if(value==='pencil'&&!inkWidthChosen&&defaults.penStyle==='pen')defaults.strokeWidth=2.5;
    tool=value;selected.clear();canvas.dataset.tool=tool;
    $$('button[data-tool]').forEach(el=>{const active=el.dataset.tool===tool;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
    const preset = B.shapes[tool];
    $('#shapes-button').classList.toggle('active', !!preset && (preset.outline || preset.type !== tool));
    canvas.classList.toggle('shape-tool', !!preset);
    $('#tool-hint').textContent=({graphpaper:'Drag to size blank graph paper. Then choose a pen to sketch on it. G adds another grid.',lasso:'Draw a loop around or across objects to select them. Shift adds to the selection. Drag corners to resize; drag the top circle to rotate.',select:'Drag a box to select multiple objects. Shift-click adds or removes objects. P writes; S selects with a lasso.',hand:'Drag to move the canvas',rectangle:'Click and drag to draw. Hold Shift for a square.',diamond:'Click and drag to draw. Hold Shift for equal sides.',ellipse:'Click and drag to draw. Hold Shift for a circle.',arrow:'Click and drag to draw an arrow. Hold Shift to snap.',line:'Click a line to select it. Drag to draw. Hold Shift to snap.',pencil:'Write with your pen or drag to draw. Lift to end a stroke. V selects.',text:'Click anywhere to add text.',eraser:'Click or drag over an element to erase it.'})[tool] || (preset ? `Drag to draw · ${preset.name}` : '');
    if(tool==='eraser'&&explicit)setStylePanelOpen(true);
    eraserSettings();closeMenus();refreshControls();updateProperties();
  }
  function screenPoint(e){const rect=canvas.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top};}
  function worldPoint(e){const p=screenPoint(e);return{x:(p.x-view.x)/view.zoom,y:(p.y-view.y)/view.zoom};}
  function hitAt(p,type){return elements.findLast(e=>(!type||e.type===type)&&B.hit(e,p,7/view.zoom));}
  function make(type,x,y,w=0,h=0,props={}){return {id:B.id(),type,x,y,w,h,...defaults,...props};}
  function startGesture(e,details) {
    gesture={...details,pointerId:e.pointerId,pointerType:e.pointerType};
    // Continue through window events if pointer capture is unavailable.
    try{canvas.setPointerCapture(e.pointerId);}catch{}
  }
  function queueDraft(shape, stroke) {
    if (!window.requestAnimationFrame) { paintDraft(shape); return; }
    if (stroke.frame) return;
    stroke.frame = window.requestAnimationFrame(() => {
      stroke.frame = 0;
      if (gesture === stroke) paintDraft(shape);
    });
  }
  function eraserSettings(){
    canvas.style.cursor='';
    if(tool!=='eraser')return;
    const mode=$('#eraser-mode input:checked').value,brush=mode==='brush';
    const hint={object:'Click or drag over whole objects to erase them.',brush:'Erase part of an ink stroke or line.',area:'Drag a box around the objects you want to erase.'}[mode];
    if($('#eraser-description').textContent!==hint)$('#eraser-description').textContent=hint;
    $('#tool-hint').textContent=hint;
    $('#eraser-size').hidden=!brush;
    if(!brush)return;
    const size=Number($('#eraser-size input:checked').value);
    const n=size+4,c=n/2;
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+n+'" height="'+n+'"><circle cx="'+c+'" cy="'+c+'" r="'+size/2+'" fill="none" stroke="white" stroke-width="3"/><circle cx="'+c+'" cy="'+c+'" r="'+size/2+'" fill="none" stroke="#36463f"/></svg>';
    canvas.style.cursor='url("data:image/svg+xml,'+encodeURIComponent(svg)+'") '+c+' '+c+', crosshair';
  }
  $('#eraser-mode').onchange=eraserSettings;$('#eraser-size').onchange=eraserSettings;
  function eraseAt(p,g){
    if(g.previous&&p.x===g.previous.x&&p.y===g.previous.y)return;
    const changes=[];
    if(g.brush){
      const result=[],from=g.previous||p;
      for(const el of elements){
        if(el.type!=='pencil'&&el.type!=='line'){result.push(el);continue;}
        let box=g.boxes.get(el);
        if(!box){box=B.bounds(el);g.boxes.set(el,box);}
        const parts=B.eraseStroke(el,from,p,g.radius,box);
        if(parts.length!==1||parts[0]!==el)changes.push({el,parts});
        for(const part of parts)result.push(part);
      }
      g.previous=p;if(!changes.length)return;
      if(result.length>2000){toast('This cut exceeds the board element limit. Use the Object eraser to make room.');return;}
      elements=result;
    }else{
      g.previous=p;const hit=hitAt(p);if(!hit)return;
      elements=elements.filter(el=>el!==hit);
      changes.push({el:hit,parts:[]});
    }
    for(const {el,parts} of changes){
      const node=scene.querySelector('[data-element="'+el.id+'"]');
      if(node)node.outerHTML=parts.map(part=>B.elementSvg(B.visibleElement(part,background))).join('');
    }
    if(!elements.length)refreshControls();
  }
  function pointerDown(e) {
    if(gesture || (e.button!==0&&e.button!==1&&!(e.pointerType==='pen'&&(e.buttons&1))))return;
    e.preventDefault();
    if(editing)finishText();
    closeMenus();const p=worldPoint(e),screen=screenPoint(e);
    canvas.focus({preventScroll:true});
    if(space||tool==='hand'||e.button===1||window.Teacher?.active){startGesture(e,{kind:'pan',screen,view:{...view}});canvas.dataset.dragging='true';return;}
    if(autoInkOnBlank&&!selected.size&&e.pointerType==='pen'&&tool==='select'&&!e.shiftKey&&!e.target.dataset.handle&&!hitAt(p))setTool('pencil');
    if(tool==='lasso'&&!e.target.dataset.handle){
      const candidates=elements.map(el=>({el,box:B.bounds(el)}));
      startGesture(e,{kind:'lasso',points:[p],left:p.x,right:p.x,top:p.y,bottom:p.y,
        candidates,prior:new Set(selected),existing:e.shiftKey?new Set(selected):new Set()});
      return;
    }
    const drawingType=B.shapes[tool]?.type || (['pencil','text','graphpaper'].includes(tool)?tool:null);
    const drawingHit=drawingType&&hitAt(p,drawingType);
    if(tool==='select'||tool==='lasso'||(drawingType&&selected.size&&(e.target.dataset.handle||selected.has(drawingHit?.id)))) {
      const handle=e.target.dataset.handle;
      if(handle&&selected.size){
        const originals=elements.filter(el=>selected.has(el.id)).map(el=>structuredClone(el));
        const indices=new Map(elements.map((el,index)=>[el.id,index]));
        const nodes=new Map(Array.from(scene.children,node=>[node.dataset.element,node]));
        startGesture(e,{kind:handle==='rotate'?'rotate':'resize',start:p,handle,bounds:B.union(originals),originals,indices,nodes,before:snapshot()});
        return;
      }
      const hit=drawingHit||hitAt(p),groupBounds=selected.size>1?B.union(elements.filter(el=>selected.has(el.id))):null;
      const inGroup=groupBounds&&p.x>=groupBounds.x&&p.x<=groupBounds.x+groupBounds.w&&p.y>=groupBounds.y&&p.y<=groupBounds.y+groupBounds.h;
      if(hit||(!e.shiftKey&&inGroup)){
        if(hit){
          const members=!drawingType&&hit.graphId?elements.filter(el=>el.graphId===hit.graphId):[hit];
          if(e.shiftKey&&selected.has(hit.id)){members.forEach(el=>selected.delete(el.id));refreshControls();updateProperties();return;}
          if(!e.shiftKey&&!selected.has(hit.id))selected.clear();
          members.forEach(el=>selected.add(el.id));
        }
        renderSelection();
        const moving=elements.filter(el=>selected.has(el.id)).map(el=>({el,x:el.x,y:el.y}));
        const nodes=Array.from(scene.querySelectorAll('[data-element]')).filter(node=>selected.has(node.dataset.element)).map(node=>({node,transform:node.getAttribute('transform')||''}));
        startGesture(e,{kind:'move',start:p,moving,nodes,dx:0,dy:0});
        updateProperties();return;
      }else{
        const prior=new Set(selected);
        if(!e.shiftKey)selected.clear();
        startGesture(e,{kind:'marquee',start:p,current:p,prior,existing:new Set(selected)});
      }
      refreshControls();updateProperties();return;
    }
    if(tool==='text'&&drawingHit){selected=new Set([drawingHit.id]);refreshControls();updateProperties();return;}
    if(!drawingHit)selected.clear();
    if(tool==='text'){beginText(p);return;}
    if(tool==='eraser'){
      const before=snapshot();
      const mode=$('#eraser-mode input:checked').value;
      if(mode==='area'){
        startGesture(e,{kind:'areaErase',start:p,current:p,before});return;
      }
      const brush=mode==='brush';
      startGesture(e,{kind:'erase',before,brush,previous:null,boxes:new WeakMap(),radius:Number($('#eraser-size input:checked').value)/(2*view.zoom)});
      refreshControls();eraseAt(p,gesture);return;
    }
    if(!drawingHit&&elements.length>=2000){toast('This canvas is full. Save a copy, then start a fresh canvas.');return;}
    const preset = B.shapes[tool];
    const shape=make(preset?.type || tool,p.x,p.y);if(tool==='graphpaper')Object.assign(shape,{...gridDefaults,strokeWidth:1,rough:0,gridSize:20,showAxes:true});if(tool==='pencil'){
      shape.smoothInk = true;
      shape.points=[[0,0,...(e.pointerType==='pen'&&e.pressure>0?[e.pressure]:[])]];
    }
    const draw={kind:'draw',start:p,id:shape.id,shape,aspect:preset?.aspect};
    if(drawingHit){
      // Keep the draft outside the scene until the pointer travels far enough to draw.
      startGesture(e,{...draw,kind:'pickOrDraw',hitId:drawingHit.id,shape,screen});
      return;
    }
    elements.push(shape);startGesture(e,draw);
    render(shape);
  }
  function paintLasso(g){
    if(gesture!==g)return;
    selected=new Set(g.existing);
    for(const {el,box} of g.candidates){
      if(box.x>g.right+.001||box.y>g.bottom+.001||box.x+box.w<g.left-.001||box.y+box.h<g.top-.001)continue;
      if(B.lassoContains(el,g.points))selected.add(el.id);
    }
    renderSelection();
  }
  function pointerMove(e,ending=false) {
    if(!gesture||gesture.pointerId!==e.pointerId)return;
    // End a missed pen-up before using its hover coordinates as ink.
    if(!ending&&gesture.pointerType==='pen'&&(e.buttons&1)===0){pointerUp(e,false);return;}
    e.preventDefault();
    const g=gesture, rect=canvas.getBoundingClientRect();
    const screen={x:e.clientX-rect.left,y:e.clientY-rect.top};
    const p={x:(screen.x-view.x)/view.zoom,y:(screen.y-view.y)/view.zoom};
    if(g.kind==='pan'){view.x=g.view.x+screen.x-g.screen.x;view.y=g.view.y+screen.y-g.screen.y;queueViewport();return;}
    if(g.kind==='draw'||g.kind==='pickOrDraw') {
      const shape=g.shape||elements.find(x=>x.id===g.id);let dx=p.x-g.start.x,dy=p.y-g.start.y;
      if(!shape)return;
      const samples=shape.type==='pencil'?[...(e.getCoalescedEvents?.()||[]),e]:[e];
      if(g.kind==='pickOrDraw'&&samples.some(sample=>Math.hypot(sample.clientX-rect.left-g.screen.x,sample.clientY-rect.top-g.screen.y)>4)){
        if(elements.length>=2000){g.kind='blockedDraw';toast('This canvas is full. Save a copy, then start a fresh canvas.');return;}
        selected.clear();renderSelection();updateProperties();
        elements.push(shape);g.kind='draw';
      }
      if(shape.type==='pencil'){
        // Keep the intermediate tablet samples the browser batches between frames.
        for(const sample of samples){
          const x=(sample.clientX-rect.left-view.x)/view.zoom-g.start.x;
          const y=(sample.clientY-rect.top-view.y)/view.zoom-g.start.y;
          const last=shape.points.at(-1);
          const pressure=g.pointerType==='pen'&&sample.pressure>0?B.clamp(sample.pressure,0,1):last[2];
          if(shape.points.length<12000&&(Math.hypot(x-last[0],y-last[1])>(ending?0:.25/view.zoom)||Number.isFinite(pressure)&&(!Number.isFinite(last[2])||Math.abs(pressure-last[2])>.02)))shape.points.push([x,y,...(Number.isFinite(pressure)?[pressure]:[])]);
        }
        if(!ending&&g.kind==='draw')queueDraft(shape,g);return;
      }
      else {
        if(g.kind==='pickOrDraw')return;
        if (g.aspect) {
          const width = Math.max(Math.abs(dx), Math.abs(dy)*g.aspect);
          dx = Math.sign(dx || 1)*width;
          dy = Math.sign(dy || 1)*width/g.aspect;
        } else if(e.shiftKey){if(['line','arrow'].includes(shape.type)){const distance=Math.hypot(dx,dy),angle=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4;dx=Math.cos(angle)*distance;dy=Math.sin(angle)*distance;}else{const side=Math.max(Math.abs(dx),Math.abs(dy));dx=side*Math.sign(dx||1);dy=side*Math.sign(dy||1);}}
        shape.w=dx;shape.h=dy;
        if(!ending)queueDraft(shape,g);
        return;
      }
    }
    if(g.kind==='lasso'){
      const last=g.points.at(-1);
      if(last.x!==p.x||last.y!==p.y){
        g.points.push(p);g.left=Math.min(g.left,p.x);g.right=Math.max(g.right,p.x);
        g.top=Math.min(g.top,p.y);g.bottom=Math.max(g.bottom,p.y);
      }
      if(!ending){
        if(!window.requestAnimationFrame)paintLasso(g);
        else if(!g.frame)g.frame=window.requestAnimationFrame(()=>{g.frame=0;paintLasso(g);});
      }
      return;}
    if(g.kind==='rotate'){const b=g.bounds,c={x:b.x+b.w/2,y:b.y+b.h/2};let angle=Math.atan2(p.y-c.y,p.x-c.x)-Math.atan2(g.start.y-c.y,g.start.x-c.x);if(e.shiftKey)angle=Math.round(angle/(Math.PI/12))*Math.PI/12;g.originals.forEach(el=>{elements[g.indices.get(el.id)]=B.rotate(el,c,angle);});}
    if(g.kind==='move'){
      g.dx=p.x-g.start.x;g.dy=p.y-g.start.y;
      if(!ending&&!g.frame){
        const paint=()=>{
          g.frame=0;if(gesture!==g)return;
          const offset=`translate(${g.dx} ${g.dy})`;
          for(const {node,transform} of g.nodes)node.setAttribute('transform',offset+' '+transform);
          selection.setAttribute('transform',`translate(${view.x} ${view.y}) scale(${view.zoom}) ${offset}`);
        };
        if(window.requestAnimationFrame)g.frame=window.requestAnimationFrame(paint);else paint();
      }
      return;
    }
    if(g.kind==='resize'){
      const b=g.bounds,dx=p.x-g.start.x,dy=p.y-g.start.y;let left=b.x,right=b.x+b.w,top=b.y,bottom=b.y+b.h;
      if(g.handle.includes('w'))left+=dx;else right+=dx;
      if(g.handle.includes('n'))top+=dy;else bottom+=dy;
      let nw=Math.max(8,right-left),nh=Math.max(8,bottom-top);
      if(e.shiftKey || (g.originals.length===1 && B.shapes[g.originals[0].type]?.aspect)){const ratio=(b.w||1)/(b.h||1);if(nw/nh>ratio)nh=nw/ratio;else nw=nh*ratio;}
      if(g.handle.includes('w'))left=right-nw;if(g.handle.includes('n'))top=bottom-nh;
      g.originals.forEach(original=>{const index=g.indices.get(original.id);elements[index]=B.resize(original,b,{x:left,y:top,w:nw,h:nh});});
    }
    if(g.kind==='areaErase'){g.current=p;renderSelection();return;}
    if(g.kind==='erase'){eraseAt(p,g);return;}
    if(g.kind==='marquee'){
      g.current=p;const x=Math.min(g.start.x,p.x),y=Math.min(g.start.y,p.y),w=Math.abs(p.x-g.start.x),h=Math.abs(p.y-g.start.y);
      selected=new Set(g.existing);elements.forEach(el=>{const b=B.bounds(el);if(b.x>=x&&b.y>=y&&b.x+b.w<=x+w&&b.y+b.h<=y+h)selected.add(el.id);});
      renderSelection();return;
    }
    if(g.kind==='rotate'||g.kind==='resize'){
      if(ending||g.frame)return;
      const paint=()=>{
        g.frame=0;
        if(gesture!==g)return;
        for(const original of g.originals){
          const el=elements[g.indices.get(original.id)],node=g.nodes.get(el.id);
          if(!node)continue;
          node.insertAdjacentHTML('beforebegin',B.elementSvg(B.visibleElement(el,background)));
          g.nodes.set(el.id,node.previousElementSibling);node.remove();
        }
        renderSelection();
      };
      if(window.requestAnimationFrame)g.frame=window.requestAnimationFrame(paint);else paint();
      return;
    }
    render();
  }
  function pointerUp(e,includePoint=true) {
    if(!gesture||gesture.pointerId!==e.pointerId)return;
    if(includePoint)pointerMove(e,true);
    const g=gesture;
    if(g.kind==='lasso')paintLasso(g);
    gesture=null;canvas.dataset.dragging='false';
    if(g.kind==='lasso'){const keep=new Set(selected);setTool('select',true);selected=keep;}
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    if(g.kind==='pickOrDraw'){
      selected=new Set([g.hitId]);refreshControls();
    }else if(g.kind==='draw'){
      const shape=elements.find(x=>x.id===g.id);
      if(!shape)return;
      if(shape.type!=='pencil'&&Math.hypot(shape.w,shape.h)<3/view.zoom){elements=elements.filter(x=>x.id!==g.id);render();return;}
      if(!locked&&shape.type!=='pencil'){setTool('select');selected=new Set([g.id]);}commit(g.before,shape);
    }else if(g.kind==='areaErase'){
      const left=Math.min(g.start.x,g.current.x),right=Math.max(g.start.x,g.current.x);
      const top=Math.min(g.start.y,g.current.y),bottom=Math.max(g.start.y,g.current.y);
      if(right>left&&bottom>top)elements=elements.filter(el=>{
        const b=B.bounds(el);
        return b.x<left||b.y<top||b.x+b.w>right||b.y+b.h>bottom;
      });
      commit(g.before);
    }else if(g.kind==='move'&&!g.dx&&!g.dy){
      for(const {node,transform} of g.nodes)node.setAttribute('transform',transform);
      transformLayers();refreshControls();
    }else if(g.kind==='move'){const before=snapshot();for(const item of g.moving){item.el.x=item.x+g.dx;item.el.y=item.y+g.dy;}commit(before);}
    else if(['resize','rotate','erase'].includes(g.kind))commit(g.before);
    else if(g.kind==='pan'){renderViewport();scheduleSave();}
    else if(g.kind==='marquee'||g.kind==='lasso'){refreshControls();}
    else{render();scheduleSave();}
    updateProperties();
  }
  function pointerCancel(e) {
    if(!gesture||gesture.pointerId!==e.pointerId)return;
    // Preserve ink already written if Windows interrupts input or capture is lost.
    if(gesture.kind==='draw'&&elements.find(x=>x.id===gesture.id)?.type==='pencil'){pointerUp(e,false);return;}
    const g=gesture;gesture=null;canvas.dataset.dragging='false';
    if(g.prior)selected=g.prior;
    if(g.kind==='draw')elements=elements.filter(el=>el.id!==g.id);
    if(g.before){const restored=JSON.parse(g.before);elements=restored.elements;background=restored.background;}
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    render();updateProperties();
  }
  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);
  canvas.addEventListener('pointercancel',pointerCancel);canvas.addEventListener('lostpointercapture',pointerCancel);
  window.addEventListener('pointermove',e=>{if(!canvas.contains(e.target))pointerMove(e);});
  window.addEventListener('pointerup',pointerUp);window.addEventListener('pointercancel',pointerCancel);
  canvas.addEventListener('dblclick',e=>{if(document.body.classList.contains('teacher-active'))return;if(tool==='select'||tool==='text'){const p=worldPoint(e),hit=hitAt(p,tool==='text'?'text':null);if(hit?.type==='text')beginText(p,hit);else if(!hit&&tool==='select')beginText(p);}});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  function zoomTo(next,point={x:canvas.clientWidth/2,y:canvas.clientHeight/2}) {
    next=B.clamp(next,.1,5);view.x=point.x-(point.x-view.x)*next/view.zoom;view.y=point.y-(point.y-view.y)*next/view.zoom;view.zoom=next;queueViewport(true);scheduleSave();
  }
  // Consume browser zoom gestures before a menu or dialog can receive them.
  window.addEventListener('wheel',e=>{
    if(!(e.ctrlKey||e.metaKey))return;
    e.preventDefault();e.stopPropagation();
    const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);
    zoomTo(view.zoom*Math.exp(-delta*.002),screenPoint(e));
  },{capture:true,passive:false});
  window.addEventListener('keydown',e=>{
    if(!(e.ctrlKey||e.metaKey)||!['+','=','-','0'].includes(e.key))return;
    e.preventDefault();e.stopPropagation();zoomTo(e.key==='0'?1:view.zoom*(e.key==='-'?1/1.2:1.2));
  },true);
  canvas.addEventListener('wheel',e=>{e.preventDefault();if(e.ctrlKey||e.metaKey)zoomTo(view.zoom*Math.exp(-e.deltaY*.002),screenPoint(e));else{const unit=e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1;view.x-=e.deltaX*unit;view.y-=e.deltaY*unit;queueViewport();scheduleSave();}},{passive:false});
  function fit() {
    const b=B.union(elements);if(!b){view={x:0,y:0,zoom:1};renderViewport(true);return;}
    const side=canvas.clientWidth>850?250:30,margin=80;
    const zoom=B.clamp(Math.min((canvas.clientWidth-side-margin)/(b.w||1),(canvas.clientHeight-210)/(b.h||1)),.1,1.5);
    view={zoom,x:side+(canvas.clientWidth-side)/2-(b.x+b.w/2)*zoom,y:canvas.clientHeight/2+12-(b.y+b.h/2)*zoom};renderViewport(true);scheduleSave();
  }
  const textContext=document.createElement('canvas').getContext('2d');
  function measureText(shape) {
    const ctx=textContext;ctx.font=B.textFont(shape);
    shape.w=Math.max(10,...shape.text.split('\n').map(line=>ctx.measureText(line).width))+4;
    shape.h=Math.max(1,shape.text.split('\n').length)*shape.fontSize*1.4;
  }
  function positionEditor() {
    if(!editing)return;const shape=editing.shape;
    editor.style.left=(shape.x*view.zoom+view.x)+'px';editor.style.top=(shape.y*view.zoom+view.y)+'px';editor.style.font=B.textFont(shape);
    editor.style.textDecoration=shape.underline?'underline':'none';
    editor.style.lineHeight='1.4';editor.style.color=B.visibleElement(shape,background).stroke;editor.style.opacity=shape.opacity/100;editor.style.transform=`scale(${view.zoom})`;
    const ctx=textContext;ctx.font=editor.style.font;
    editor.style.width=Math.max(70,...editor.value.split('\n').map(line=>ctx.measureText(line).width+15))+'px';
    editor.style.height=(Math.max(1,editor.value.split('\n').length)*shape.fontSize*1.4+8)+'px';
  }
  function beginText(p,existing) {
    if(!existing&&elements.length>=2000){toast('This canvas is full. Save a copy before starting a fresh canvas.');return;}
    const shape=existing?structuredClone(existing):make('text',p.x,p.y,0,0,{...textDefaults,text:''});
    editing={id:shape.id,shape,before:snapshot(),existing:!!existing};selected.clear();editor.value=shape.text;editor.hidden=false;render();updateProperties();editor.focus();
  }
  function finishText(cancel=false) {
    if(!editing)return;const edit=editing;editing=null;editor.hidden=true;
    if(!cancel){
      const text=editor.value.slice(0,20000);elements=elements.filter(x=>x.id!==edit.id);
      if(text.trim()){edit.shape.text=text;measureText(edit.shape);elements.push(edit.shape);selected=new Set([edit.id]);}
      if(!locked&&tool==='text') {setTool('select');if(text.trim())selected=new Set([edit.id]);}
      commit(edit.before);updateProperties();
    }else render();
  }
  editor.addEventListener('input',positionEditor);editor.addEventListener('blur',e=>{if(!$('#properties').contains(e.relatedTarget)&&e.relatedTarget!==$('#style-toggle'))finishText();});editor.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['b','i','u'].includes(e.key.toLowerCase())){e.preventDefault();const key={b:'bold',i:'italic',u:'underline'}[e.key.toLowerCase()];formatText(key,!editing.shape[key]);return;}if(e.key==='Escape'){e.stopPropagation();finishText(true);}if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();finishText();}});
  function undo(redo=false) {
    if(editing)finishText();const source=redo?future:past,dest=redo?past:future;if(!source.length)return;
    dest.push(snapshot());
    const entry=source.pop();
    if(entry.addedId)elements=elements.filter(el=>el.id!==entry.addedId);
    else{const state=JSON.parse(entry);elements=state.elements;background=state.background;}
    selected.clear();render();scheduleSave();
  }
  function deleteSelected(){const before=snapshot();elements=elements.filter(e=>!selected.has(e.id));selected.clear();commit(before);updateProperties();}
  function duplicate(items=elements.filter(e=>selected.has(e.id)),offset=20){if(!items.length)return;if(elements.length+items.length>2000){toast('This canvas is full. Please save a copy and start a fresh canvas.');return;}const before=snapshot();const copies=items.map(e=>({...structuredClone(e),id:B.id(),x:e.x+offset,y:e.y+offset}));const graphCopies=new Map();for(const copy of copies){if(copy.graphId){if(!graphCopies.has(copy.graphId))graphCopies.set(copy.graphId,B.id());copy.graphId=graphCopies.get(copy.graphId);}}elements.push(...copies);selected=new Set(copies.map(e=>e.id));commit(before);updateProperties();}
  function layer(front){if(!selected.size)return;const before=snapshot();if(front){for(let i=elements.length-2;i>=0;i--)if(selected.has(elements[i].id)&&!selected.has(elements[i+1].id))[elements[i],elements[i+1]]=[elements[i+1],elements[i]];}else{for(let i=1;i<elements.length;i++)if(selected.has(elements[i].id)&&!selected.has(elements[i-1].id))[elements[i-1],elements[i]]=[elements[i],elements[i-1]];}commit(before);}
  const desktop = window.chrome?.webview, pendingSaves = new Map();
  desktop?.addEventListener('message', ({data}) => {
    if(data?.type === 'open-result'){importDrawing(data.text,data.name);return;}
    if(data?.type !== 'save-result' || !pendingSaves.has(data.id))return;
    const {resolve,reject,timer}=pendingSaves.get(data.id);pendingSaves.delete(data.id);clearTimeout(timer);
    if(data.error)reject(new Error(data.error));else resolve(data.saved?data.name:null);
  });
  function requestSave(message){
    return new Promise((resolve,reject)=>{
      const id=B.id(),timer=setTimeout(()=>{pendingSaves.delete(id);reject(new Error('Saving timed out. Please try again.'));},300000);
      pendingSaves.set(id,{resolve,reject,timer});desktop.postMessage(JSON.stringify({...message,id}));
    });
  }
  async function download(blob,name) {
    if(desktop){
      const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
      for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
      return requestSave({type:'save',name,base64:btoa(binary)});
    }
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);return name;
  }
  function safeName(){return ($('#file-name').value.trim()||documentName||'Untitled').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,100);}
  async function saveFile(){if(editing)finishText();try{const name=safeName();const saved=await download(new Blob([JSON.stringify({type:'excalidraw',version:2,source:'Rillboard',elements,background,appState:{viewBackgroundColor:background}},null,2)],{type:'application/json'}),name+'.excalidraw');if(!saved)return;documentName=saved.replace(/\.excalidraw$/i,'');$('#file-name').value=documentName;scheduleSave();toast('Drawing saved. Open this file to continue editing later.');}catch(error){toast('Could not save your drawing: '+error.message);}}
  function importDrawing(text,name){
    try{const parsed=B.parseScene(JSON.parse(text));if(editing)finishText();$$('dialog[open]').forEach(d=>d.close());if($('#presentation-stage').hidden===false)exitPresent();const before=snapshot();elements=parsed.elements;background=parsed.background;selected.clear();documentName=name.replace(/\.(excalidraw|json)$/i,'');$('#file-name').value=documentName;commit(before);fit();toast('Drawing opened. Your previous canvas is available with Undo.');}catch(error){toast(error instanceof SyntaxError?'This file is not valid JSON. Choose an .excalidraw drawing.':error.message);}
  }
  $('#file-input').addEventListener('change',async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    try{if(file.size>25*1024*1024)throw new Error('Please choose a drawing file smaller than 25 MB.');importDrawing(await file.text(),file.name);}catch(error){toast(error.message);}
  });
  async function insertImage(file) {
    if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)){toast('Choose a PNG, JPEG, WebP, or GIF image.');return;}
    if(file.size>8*1024*1024){toast('Choose an image smaller than 8 MB.');return;}
    if(elements.length>=2000){toast('This canvas is full. Save a copy and start a fresh canvas.');return;}
    try{const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const image=new Image();image.src=src;await image.decode();const scale=Math.min(1,600/image.width,500/image.height);const w=image.width*scale,h=image.height*scale,p={x:(canvas.clientWidth/2-view.x)/view.zoom,y:(canvas.clientHeight/2-view.y)/view.zoom},shape=make('image',p.x-w/2,p.y-h/2,w,h,{src});const before=snapshot();elements.push(shape);setTool('select');selected=new Set([shape.id]);commit(before);updateProperties();}catch{toast('This image could not be opened. Try a different image file.');}
  }
  $('#image-input').addEventListener('change',e=>{const file=e.target.files[0];e.target.value='';if(file)insertImage(file);});
  canvas.addEventListener('dragover',e=>e.preventDefault());canvas.addEventListener('drop',e=>{e.preventDefault();const file=e.dataTransfer.files[0];if(file)insertImage(file);});
  document.addEventListener('paste',e=>{if($('#presentation-stage').hidden===false||$('dialog[open]')||/INPUT|TEXTAREA/.test(document.activeElement.tagName))return;const image=[...e.clipboardData.items].find(item=>item.type.startsWith('image/'));if(image){e.preventDefault();insertImage(image.getAsFile());}else if(clipboard.length){e.preventDefault();duplicate(clipboard,30);}});
  function closeMenus(){ $('#main-menu').hidden=true;$('#menu-button').setAttribute('aria-expanded','false'); }
  function openDialog(id){closeMenus();if(editing)finishText();const dialog=$(id);if(!dialog.open)dialog.showModal();}
  function exportPreview(){$('#export-preview').innerHTML=B.svgDocument(elements,background,$('#export-background').checked);}
  function openExport(){if(editing)finishText();if(!elements.length){toast('Draw something first, then export your canvas.');return;}$('#file-name').value=documentName;exportPreview();openDialog('#export-dialog');}
  async function exportSvg(){try{const name=safeName();if(await download(new Blob([B.svgDocument(elements,background,$('#export-background').checked)],{type:'image/svg+xml'}),name+'.svg'))toast('SVG saved. It stays sharp at any size.');}catch(error){toast('Could not save SVG: '+error.message);}}
  async function exportPng(){
    try{
      const svg=B.svgDocument(elements,background,$('#export-background').checked),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
      try{const img=new Image();img.src=url;await img.decode();const output=document.createElement('canvas'),scale=Math.min(2,4096/img.width,4096/img.height);output.width=Math.max(1,Math.ceil(img.width*scale));output.height=Math.max(1,Math.ceil(img.height*scale));output.getContext('2d').drawImage(img,0,0,output.width,output.height);const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG export failed');if(await download(blob,safeName()+'.png'))toast('PNG saved to your computer.');}finally{URL.revokeObjectURL(url);}
    }catch{toast('PNG could not be exported. Try saving as SVG instead.');}
  }
  $('#export-background').addEventListener('change',exportPreview);
  const library=[
    {name:'Kanban board',build:(x,y)=>['To do','In progress','Done'].flatMap((title,i)=>[make('rectangle',x+i*240,y,220,340,{fill:['#e5dbff','#a5d8ff','#d3f9d8'][i],fillStyle:'solid',stroke:'#868e96'}),make('text',x+18+i*240,y+15,0,0,{text:title,fontSize:24}),...['First task','Next step'].flatMap((label,j)=>[make('rectangle',x+16+i*240,y+75+j*115,188,95,{fill:'#ffffff',fillStyle:'solid'}),make('text',x+30+i*240,y+96+j*115,0,0,{text:label,fontSize:20})])])},
    {name:'Weekly planner',build:(x,y)=>[make('text',x,y-60,0,0,{text:'My week · Make room for what matters',fontSize:28}),...['Monday','Tuesday','Wednesday','Thursday','Friday'].flatMap((title,i)=>[make('rectangle',x+i*170,y,155,310,{fill:i%2?'#e5dbff':'#fff3bf',fillStyle:'solid',stroke:'#868e96'}),make('text',x+10+i*170,y+16,0,0,{text:title,fontSize:20}),make('text',x+12+i*170,y+85,0,0,{text:'Top priority\n\nNotes & ideas',fontSize:16})])]},
    {name:'Project canvas',build:(x,y)=>[make('text',x,y-65,0,0,{text:'Project canvas',fontSize:32,stroke:'#187569'}),...['Goal','People','Milestones','Next steps'].flatMap((title,i)=>[make('rectangle',x+(i%2)*330,y+Math.floor(i/2)*210,310,190,{fill:['#e5dbff','#a5d8ff','#ffec99','#d3f9d8'][i],fillStyle:'solid'}),make('text',x+20+(i%2)*330,y+20+Math.floor(i/2)*210,0,0,{text:title,fontSize:26}),make('text',x+20+(i%2)*330,y+85+Math.floor(i/2)*210,0,0,{text:'Add your ideas here',fontSize:18})])]},
    {name:'Flowchart',build:(x,y)=>[make('rectangle',x,y,130,62,{fill:'#d0bfff',fillStyle:'solid'}),make('arrow',x+140,y+31,66,0),make('diamond',x+220,y-10,100,82,{fill:'#ffec99',fillStyle:'solid'})]},
    {name:'Sticky note',build:(x,y)=>[make('rectangle',x,y,150,140,{fill:'#ffec99',fillStyle:'solid',stroke:'#e0b350'}),make('text',x+20,y+35,110,60,{text:'A bright\nnew idea',fontSize:20,stroke:'#735d2c'})]},
    {name:'To-do list',build:(x,y)=>[make('rectangle',x,y,180,145,{stroke:'#868e96'}),...['First idea','Next step','Make it happen'].flatMap((t,i)=>[make('rectangle',x+17,y+23+i*36,15,15,{stroke:'#187569'}),make('text',x+43,y+16+i*36,126,28,{text:t,fontSize:16})])]},
    {name:'Mind map',build:(x,y)=>[make('ellipse',x+70,y+40,120,65,{fill:'#a5d8ff',fillStyle:'solid'}),make('line',x+70,y+70,-50,-50,{stroke:'#187569'}),make('line',x+190,y+70,50,-50,{stroke:'#187569'}),make('line',x+130,y+105,0,45,{stroke:'#187569'}),make('text',x+92,y+58,80,32,{text:'Big idea',fontSize:20})]},
    {name:'Browser window',build:(x,y)=>[make('rectangle',x,y,230,155,{stroke:'#868e96'}),make('line',x,y+30,230,0,{stroke:'#868e96'}),...[15,29,43].map(n=>make('ellipse',x+n,y+11,7,7,{stroke:'#868e96'})),make('rectangle',x+17,y+47,196,85,{stroke:'#b197fc',fill:'#e5dbff'})]},
    {name:'Idea card',build:(x,y)=>[make('rectangle',x,y,190,120,{fill:'#d3f9d8',fillStyle:'solid',stroke:'#51a36a'}),make('text',x+23,y+25,145,65,{text:'What if we\ntried this?',fontSize:22,stroke:'#2b6b3d'})]}
  ];
  function createLibrary(){library.forEach(item=>{const shapes=item.build(0,0);shapes.forEach(s=>{if(s.type==='text')measureText(s);});const button=document.createElement('button');button.className='library-item';button.innerHTML=B.svgDocument(shapes,'#ffffff',false)+`<span>${B.escape(item.name)}</span>`;button.addEventListener('click',()=>{if(elements.length+shapes.length>2000){toast('This canvas is full. Save a copy first.');return;}const before=snapshot(),x=(canvas.clientWidth/2-view.x)/view.zoom-120,y=(canvas.clientHeight/2-view.y)/view.zoom-50,items=item.build(x,y);items.forEach(s=>{if(s.type==='text')measureText(s);});elements.push(...items);setTool('select');selected=new Set(items.map(s=>s.id));commit(before);updateProperties();if(canvas.clientWidth<850){$('#library-panel').hidden=true;$('#library-button').setAttribute('aria-expanded','false');}});$('#library-items').appendChild(button);});}
  function workspaceAction(fn) {
    if(!workspace){toast(workspaceError || 'Device storage is unavailable. Use Save to file to keep your drawing.');return;}
    try {if(editing)finishText();fn();}catch(error){toast('Could not update boards. Save your drawing to a file. '+error.message);}
  }
  function applyBoard(data) {
    window.Teacher?.beforeBoardChange();
    const parsed=B.parseScene(data);elements=parsed.elements;background=parsed.background;documentName=data.name||'Untitled';
    view=data.view?{x:B.num(data.view.x),y:B.num(data.view.y),zoom:B.clamp(B.num(data.view.zoom,1),.1,5)}:{x:0,y:0,zoom:1};
    homeDismissed=false;past=[];future=[];selected.clear();$('#file-name').value=documentName;$('#board-title').textContent=documentName;
    $$('dialog[open]').forEach(d=>d.close());setTool('select');render();saveLocal();
    window.Teacher?.boardChanged();
  }
  function persistBoard() { if(gesture)pointerCancel({pointerId:gesture.pointerId});if(!saveLocal())throw new Error('Device storage is full or unavailable.'); }
  function renderBoards() {
    const active=workspace.current();$('#board-name').value=active.name;$('#board-folder').value=active.folder;
    const folders=[...new Set(workspace.list().map(b=>b.folder).filter(Boolean))].sort(),filter=$('#folder-filter'),old=filter.value;
    filter.innerHTML='<option value="">All folders</option>'+folders.map(f=>`<option value="${B.escape(f)}">${B.escape(f)}</option>`).join('');filter.value=old;
    $('#folder-names').innerHTML=folders.map(f=>`<option value="${B.escape(f)}"></option>`).join('');
    const boards=workspace.list($('#board-search').value,filter.value);
    $('#boards-list').innerHTML=boards.length?boards.map(b=>`<article class="board-card"><button class="board-open" data-board-open="${B.escape(b.id)}"><span class="board-art">${icon('folder')}</span><strong>${B.escape(b.name)}</strong><span>${B.escape(b.folder||'Unfiled')}${b.id===active.id?' · Current board':''}</span><small>${new Date(b.updatedAt).toLocaleString()}</small></button><button class="button board-copy" data-board-copy="${B.escape(b.id)}" aria-label="Duplicate ${B.escape(b.name)}">Duplicate</button></article>`).join(''):'<p class="empty-workspace">No boards match. Try another search or create a board.</p>';
  }
  function openBoards(){workspaceAction(()=>{persistBoard();renderBoards();openDialog('#boards-dialog');});}
  function newBoard(item) {workspaceAction(()=>{persistBoard();workspace.checkpoint(workspaceScene());const items=item?item.build(0,0):[];items.forEach(s=>{if(s.type==='text')measureText(s);});const data=workspace.create({elements:items,background:'#ffffff',view:{x:0,y:0,zoom:1}},item?.name||'Untitled',workspace.current().folder);applyBoard(data);if(items.length)fit();toast('New board created. Your other boards are saved.');});}
  function openTemplates(){workspaceAction(()=>{persistBoard();$('#template-items').innerHTML=library.map((item,i)=>{const shapes=item.build(0,0);shapes.forEach(s=>{if(s.type==='text')measureText(s);});return `<button class="template-card" data-template="${i}">${B.svgDocument(shapes,'#ffffff',true)}<strong>${B.escape(item.name)}</strong><span>Free · Create a new board</span></button>`;}).join('');$$('dialog[open]').forEach(d=>d.close());openDialog('#templates-dialog');});}
  function renderHistory() {const versions=workspace.historySummaries();$('#history-list').innerHTML=versions.length?versions.map((v,i)=>`<article class="history-row"><div><strong>${new Date(v.at).toLocaleString()}</strong><span>${v.count} elements · ${B.escape(v.name||'Untitled')}</span></div><button class="button" data-restore-version="${i}">Restore</button></article>`).join(''):'<p class="empty-workspace">No saved versions yet. Save one now, then keep drawing.</p>';}
  function openHistory(){workspaceAction(()=>{persistBoard();renderHistory();$$('dialog[open]').forEach(d=>d.close());openDialog('#history-dialog');});}
  function present(){closeMenus();if(editing)finishText();if(!elements.length){toast('Add something to your board before presenting.');return;}$('#presentation-art').innerHTML=B.svgDocument(elements,background,true);$('#presentation-stage').style.background=background;$('#presentation-title').textContent=documentName;$('#presentation-stage').hidden=false;$('#presentation-stage').focus();}
  function exitPresent(){$('#presentation-stage').hidden=true;canvas.focus();}
  $('#board-details').addEventListener('submit',e=>{e.preventDefault();workspaceAction(()=>{persistBoard();documentName=workspace.organize($('#board-name').value,$('#board-folder').value);$('#file-name').value=documentName;persistBoard();renderBoards();toast('Board details saved.');});});
  $('#board-search').addEventListener('input',()=>workspaceAction(renderBoards));$('#folder-filter').addEventListener('change',()=>workspaceAction(renderBoards));
  document.addEventListener('click',e=>{
    const open=e.target.closest('[data-board-open]'),copy=e.target.closest('[data-board-copy]'),template=e.target.closest('[data-template]'),restore=e.target.closest('[data-restore-version]');
    if(open)workspaceAction(()=>{persistBoard();workspace.checkpoint(workspaceScene());applyBoard(workspace.open(open.dataset.boardOpen));});
    if(copy)workspaceAction(()=>{persistBoard();applyBoard(workspace.duplicate(copy.dataset.boardCopy));toast('Board duplicated.');});
    if(template)newBoard(library[+template.dataset.template]);
    if(restore)workspaceAction(()=>{const data=workspace.restore(+restore.dataset.restoreVersion,workspaceScene());applyBoard(data);toast('Version restored. Your previous drawing is kept in history.');});
  });
  function openShapes() {
    const groups = new Map();
    for (const preset of Object.values(B.shapes)) {
      const aspect = preset.aspect || ({rectangle:1.5, ellipse:1.5, line:1.5, arrow:1.5}[preset.type] || 1);
      const w = Math.min(38, 30*aspect), h = w/aspect;
      const preview = make(preset.type, (48-w)/2, (38-h)/2, w,h, {
        id:'preview-'+preset.tool, stroke:'currentColor', fill:'transparent', rough:0, strokeWidth:1.6, opacity:100, dash:'solid'
      });
      if (!groups.has(preset.group)) groups.set(preset.group,[]);
      const active = preset.tool === tool;
      groups.get(preset.group).push(`<button type="button" class="shape-choice" data-tool="${preset.tool}" aria-pressed="${active}">
        <svg viewBox="0 0 48 38" aria-hidden="true">${B.elementSvg(preview)}</svg><span>${preset.name}</span></button>`);
    }
    $('#shape-options').innerHTML = [...groups].map(([name,buttons]) =>
      `<section><h3>${name}</h3><div class="shape-grid">${buttons.join('')}</div></section>`).join('');
    openDialog('#shapes-dialog');
  }
  const actions={shapes:openShapes,graph:()=>{openDialog('#graph-dialog');updateGraphMode();previewGraph();},'graph-paper':()=>{$('#graph-dialog').close();setTool('graphpaper');},open:()=>{closeMenus();if(desktop)desktop.postMessage(JSON.stringify({type:'open'}));else $('#file-input').click();},save:saveFile,export:openExport,help:()=>openDialog('#help-dialog'),new:()=>openDialog('#reset-dialog'),'confirm-new':()=>{const before=snapshot();elements=[];selected.clear();view={x:0,y:0,zoom:1};documentName='Untitled';$('#file-name').value=documentName;$('#reset-dialog').close();setTool('select');commit(before);},'close-dialog':()=>$$('dialog[open]').forEach(d=>d.close()),'export-svg':exportSvg,'export-png':exportPng,delete:deleteSelected,duplicate:()=>duplicate(),back:()=>layer(false),front:()=>layer(true),'close-library':()=>{$('#library-panel').hidden=true;$('#library-button').setAttribute('aria-expanded','false');}};
  Object.assign(actions,{boards:openBoards,templates:openTemplates,history:openHistory,'new-board':()=>newBoard(),present,'exit-present':exitPresent,'save-version':()=>workspaceAction(()=>{workspace.checkpoint(workspaceScene());renderHistory();toast('Version saved on this device.');})});
  Object.assign(actions,{undo:()=>undo(),redo:()=>undo(true),'select-all':()=>{setTool('select');selected=new Set(elements.map(el=>el.id));render();updateProperties();},'zoom-in':()=>zoomTo(view.zoom*1.2),'zoom-out':()=>zoomTo(view.zoom/1.2),'zoom-reset':()=>zoomTo(1),fit,settings:()=>openDialog('#settings-dialog'),quit:()=>{if(desktop){desktop.postMessage(JSON.stringify({type:'quit'}));return;}saveLocal();window.close();setTimeout(()=>toast('Your boards are saved. Close this window to exit.'),300);}});
  function setStylePanelOpen(open) {
    document.body.classList.toggle('properties-open',open);
    $('#style-toggle').setAttribute('aria-expanded',String(open));
    if(open)updateProperties();
  }
  $('#style-toggle').onclick=e=>{
    const open=!document.body.classList.contains('properties-open');
    setStylePanelOpen(open);
    if(open && e.detail===0)$('#style-close').focus();
  };
  function closeStylePanel(){setStylePanelOpen(false);$('#style-toggle').focus();}
  $('#style-close').onclick=closeStylePanel;
  $('#properties').addEventListener('keydown',e=>{
    if(e.key==='Escape' && !e.defaultPrevented){
      e.stopPropagation();
      closeStylePanel();
    }
  });
  for(const button of $$('[data-style-tool]')){
    button.onclick=()=>{setTool(button.dataset.styleTool,true);canvas.focus();};
  }
  $('#home-draw').onclick=()=>{homeDismissed=true;setTool('pencil',true);canvas.focus();};
  desktop?.addEventListener('message',({data})=>{
    if(data?.type!=='command')return;
    if($('#presentation-stage').hidden===false)exitPresent();
    if(editing)finishText();
    $$('dialog[open]').forEach(d=>d.close());closeMenus();
    actions[data.command]?.();
  });
  document.addEventListener('click',e=>{const action=e.target.closest('[data-action]');if(action){if(action.closest("#main-menu"))closeMenus();actions[action.dataset.action]?.();return;}const toolButton=e.target.closest('button[data-tool]');if(toolButton){if(toolButton.closest('#shapes-dialog'))$('#shapes-dialog').close();setTool(toolButton.dataset.tool,true);return;}const style=e.target.closest('[data-width],[data-dash],[data-fill],[data-rough],[data-font]');if(style){if(style.dataset.width)setStyle('strokeWidth',+style.dataset.width);if(style.dataset.dash)setStyle('dash',style.dataset.dash);if(style.dataset.fill)setStyle('fillStyle',style.dataset.fill);if(style.dataset.rough)setStyle('rough',+style.dataset.rough);if(style.dataset.font)setStyle('fontSize',+style.dataset.font);return;}const themeButton=e.target.closest('[data-theme]');if(themeButton){const next=themeButton.dataset.theme;if(next!==theme){const before=snapshot();const old=theme;theme=next;if((old==='light'&&background==='#ffffff')||(old==='dark'&&background==='#121212'))background=next==='dark'?'#121212':'#ffffff';commit(before);}return;}if(!e.target.closest('#main-menu,#menu-button'))closeMenus();});
  $('#menu-button').onclick=()=>{const open=$('#main-menu').hidden;$('#main-menu').hidden=!open;$('#menu-button').setAttribute('aria-expanded',String(open));};
  $('#library-button').onclick=()=>{const open=$('#library-panel').hidden;$('#library-panel').hidden=!open;$('#library-button').setAttribute('aria-expanded',String(open));closeMenus();};
  $('#export-button').onclick=openExport;$('#undo-button').onclick=()=>undo();$('#redo-button').onclick=()=>undo(true);$('#zoom-in').onclick=()=>zoomTo(view.zoom*1.2);$('#zoom-out').onclick=()=>zoomTo(view.zoom/1.2);$('#zoom-reset').onclick=()=>zoomTo(1);$('#fit-button').onclick=fit;
  $('#tool-lock').onclick=()=>{locked=!locked;$('#tool-lock').classList.toggle('active',locked);$('#tool-lock').setAttribute('aria-pressed',String(locked));$('#tool-lock').innerHTML=icon(locked?'lock':'unlock');};
  const graphExamples={
    cartesian:[['Waves','sin(x)\ncos(x)'],['Polynomial','x^3-3x'],['Piecewise','if(x<0,-x,sqrt(x))']],
    implicit:[['Circle','x^2+y^2=25'],['Hyperbola','x^2-y^2=9'],['Heart','(x^2+y^2-1)^3-x^2*y^3=0',{xmin:-2,xmax:2,ymin:-2,ymax:2,step:.5}]],
    parametric:[['Ellipse','5*cos(t); 3*sin(t)'],['Lissajous','5*sin(3*t); 5*sin(2*t)'],['Spiral','t*cos(t); t*sin(t)'],['India','indiax(t); indiay(t)',{tmax:1,step:2}]],
    polar:[['Rose','5*cos(3*theta)'],['Cardioid','3*(1+cos(theta))'],['Spiral','theta']]
  };
  function updateGraphMode(){
    const mode=$('#graph-mode').value||'cartesian';
    $('#graph-parameter').hidden=!['parametric','polar'].includes(mode);
    $('#graph-syntax').textContent={cartesian:'Use x, one function per line. Example: if(x<0, -x, sqrt(x)).',implicit:'Use x and y with an equals sign. Example: x^2+y^2=25.',parametric:'Use t, with x(t) and y(t) separated by a semicolon. Example: 5*cos(t); 3*sin(t).',polar:'Enter radius using theta (or t). Example: 5*cos(3*theta). Angles are in radians.'}[mode];
    $('#graph-examples').innerHTML=graphExamples[mode].map(([label],i)=>`<button type="button" class="button" data-graph-example="${i}">${label}</button>`).join('');
  }
  function graphOptions(){return {expression:$('#graph-expression').value,mode:$('#graph-mode').value||'cartesian',xmin:+$('#graph-xmin').value,xmax:+$('#graph-xmax').value,ymin:+$('#graph-ymin').value,ymax:+$('#graph-ymax').value,step:+$('#graph-step').value,tmin:+$('#graph-tmin').value,tmax:+$('#graph-tmax').value,quality:+$('#graph-quality').value||2400,equalScale:$('#graph-equal-scale').checked};}
  function previewGraph(){try{const items=B.graph(graphOptions());$('#graph-preview').innerHTML=B.svgDocument(items,'#ffffff',true);$('#graph-error').textContent='';return items;}catch(error){$('#graph-preview').innerHTML='';$('#graph-error').textContent=error.message;return null;}}
  $('#graph-mode').addEventListener('change',()=>{updateGraphMode();$('#graph-preview').innerHTML='';$('#graph-error').textContent='';});
  $('#graph-examples').addEventListener('click',e=>{const button=e.target.closest('[data-graph-example]');if(!button)return;const mode=$('#graph-mode').value||'cartesian';const [,expression,settings]=graphExamples[mode][+button.dataset.graphExample];$('#graph-expression').value=expression;
    // Start from the standard window so one example's range never clips the next.
    const ranges={xmin:-10,xmax:10,ymin:-10,ymax:10,step:1,tmin:0,tmax:2*Math.PI,...settings};
    for(const [name,value] of Object.entries(ranges))$('#graph-'+name).value=value;
    $('#graph-equal-scale').checked=true;
    previewGraph();});
  $('#graph-preview-button').addEventListener('click',previewGraph);
  $('#graph-form').addEventListener('input',()=>{$('#graph-preview').innerHTML='<p>Settings changed. Click Preview curves.</p>';$('#graph-error').textContent='';});
  $('#graph-form').addEventListener('submit',e=>{
    e.preventDefault();
    try{
      const items=B.graph({...graphOptions(),x:(canvas.clientWidth/2-view.x)/view.zoom-300,y:(canvas.clientHeight/2-view.y)/view.zoom-200});
      if(elements.length+items.length>2000)throw Error('This board is full. Create a new board for the graph.');
      const before=snapshot();elements.push(...items);setTool('select');selected=new Set(items.map(el=>el.id));commit(before);updateProperties();$('#graph-dialog').close();$('#graph-error').textContent='';
    }catch(error){$('#graph-error').textContent=error.message;}
  });
  $('#pen-style').addEventListener('click',e=>{
    const button=e.target.closest('[data-pen]');if(!button)return;
    const before=snapshot(),style=button.dataset.pen,preset=penPresets[style];
    if(!preset)return;Object.assign(defaults,{penStyle:style,strokeWidth:preset[0],opacity:preset[1],rough:0,dash:'solid'});
    elements.forEach(el=>{if(selected.has(el.id)&&el.type==='pencil')Object.assign(el,{penStyle:style,strokeWidth:preset[0],opacity:preset[1]});});
    if(!selected.size||!elements.some(el=>selected.has(el.id)&&el.type==='pencil'))setTool('pencil');commit(before);updateProperties();
  });
  $('#opacity').addEventListener('input',e=>showOpacity(e.target.value));$('#opacity').addEventListener('change',e=>setStyle('opacity',+e.target.value));
  document.addEventListener('keydown',e=>{
    if($('#presentation-stage').hidden===false){if(e.key==='Escape'){e.preventDefault();exitPresent();}return;}
    if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
    if(e.code==='Space'&&document.activeElement.closest('#properties button, #style-toggle'))return;
    if($('dialog[open]'))return;
    const key=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
    if(mod){
      if(key==='n'){e.preventDefault();newBoard();return;}
      if(key==='z'){e.preventDefault();undo(e.shiftKey);return;}if(key==='y'){e.preventDefault();undo(true);return;}if(key==='s'){e.preventDefault();saveFile();return;}if(key==='o'){e.preventDefault();actions.open();return;}if(key==='e'&&e.shiftKey){e.preventDefault();openExport();return;}
      if(key==='a'){e.preventDefault();setTool('select');selected=new Set(elements.map(el=>el.id));render();updateProperties();return;}if(key==='d'){e.preventDefault();duplicate();return;}
      if(key==='c'&&selected.size){e.preventDefault();clipboard=structuredClone(elements.filter(el=>selected.has(el.id)));toast('Selection copied. Press Ctrl V to paste.');return;}
      if(key==='x'&&selected.size){e.preventDefault();clipboard=structuredClone(elements.filter(el=>selected.has(el.id)));deleteSelected();return;}
      if(key==='v'&&clipboard.length){e.preventDefault();duplicate(clipboard,30);return;}
      if(key==='+'||key==='='){e.preventDefault();zoomTo(view.zoom*1.2);}if(key==='-'){e.preventDefault();zoomTo(view.zoom/1.2);}return;
    }
    if(e.key==='Escape'){if(gesture){pointerCancel({pointerId:gesture.pointerId});return;}selected.clear();closeMenus();setTool('select');return;}
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected();return;}
    if(e.code==='Space'){e.preventDefault();space=true;canvas.style.cursor='grab';return;}
    if(e.key==='?'||e.key==='F1'){e.preventDefault();openDialog('#help-dialog');return;}
    if(e.shiftKey&&e.code==='Digit1'){fit();return;}if(e.shiftKey&&e.code==='Digit2'){zoomTo(1);return;}
    if(key==='q'){$('#tool-lock').click();return;}
    if(shortcuts[key]){setTool(shortcuts[key],true);return;}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selected.size){e.preventDefault();const before=snapshot(),step=e.shiftKey?10:1;elements.forEach(el=>{if(selected.has(el.id)){if(e.key==='ArrowLeft')el.x-=step;if(e.key==='ArrowRight')el.x+=step;if(e.key==='ArrowUp')el.y-=step;if(e.key==='ArrowDown')el.y+=step;}});commit(before);}
  });
  document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;canvas.style.cursor='';}});window.addEventListener('blur',()=>{space=false;canvas.style.cursor='';if(gesture)pointerCancel({pointerId:gesture.pointerId});});
  window.addEventListener('resize',()=>renderViewport(true));window.addEventListener('beforeunload',()=>{if(editing)finishText();saveLocal();});
  $$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  // Narrow structured bridge for teaching; no arbitrary script execution from tools.
  function frameTeachingView(bounds,options){
    if(bounds){const area=window.Teacher?.canvasArea()||{left:24,right:24,top:110,bottom:80};
        const width=Math.max(200,canvas.clientWidth-area.left-area.right),height=Math.max(160,canvas.clientHeight-area.top-area.bottom);
        const zoom=options.scroll?Math.min(1,width/Math.max(1,bounds.w),Math.max(.75,height/Math.max(1,bounds.h))):Math.min(1.4,width/Math.max(1,bounds.w),height/Math.max(1,bounds.h));
        const visible=bounds.x*view.zoom+view.x>=area.left-1&&(bounds.x+bounds.w)*view.zoom+view.x<=canvas.clientWidth-area.right+1&&bounds.y*view.zoom+view.y>=area.top&&(bounds.y+bounds.h)*view.zoom+view.y<=canvas.clientHeight-area.bottom;
        if(!options.scroll||options.force||!visible||Math.abs(view.zoom-zoom)>.01)view={x:area.left-Math.min(bounds.x,Math.max(0,bounds.x+bounds.w-width/zoom))*zoom,y:area.top-bounds.y*zoom,zoom};}
  }
  window.TeachingBoard = {
    measureText,
    identity:()=>workspace?.current()?.conversationId,
    viewport:()=>({...view}),
    contentBottom:()=>window.TeacherCore.bottom(elements),
    read:()=>structuredClone({id:workspace?.current()?.id||null,conversationId:workspace?.current()?.conversationId||null,name:documentName,elements,background,view,boards:workspace?.list().map(b=>({id:b.id,name:b.name,folder:b.folder,conversationId:b.conversationId||null}))||[]}),
    conversation:id=>workspace?.conversation(id),
    bindConversation(id){if(!workspace)throw new Error('Local board storage is unavailable.');workspace.bindConversation(id);},
    open(id){if(!workspace)throw new Error('Local board storage is unavailable.');if(id!==workspace.current().id){if(editing)finishText();persistBoard();window.Teacher?.beforeBoardChange();applyBoard(workspace.open(id));}},
    create(name) {
      if(!workspace)throw new Error('Local board storage is unavailable. Save your drawing first.');
      if(editing)finishText();persistBoard();
      window.Teacher?.beforeBoardChange();applyBoard(workspace.create({elements:[],background:'#ffffff',view:{x:0,y:0,zoom:1}},name,'Lessons'));
    },
    show(items,bounds,options={}) {
      if(gesture)pointerCancel({pointerId:gesture.pointerId});
      if(editing)finishText();
      const before=snapshot();elements=structuredClone(items);selected.clear();
      elements.filter(e=>e.type==='text').forEach(measureText);
      frameTeachingView(bounds,options);
      commit(before);
    },
    reframe(bounds){frameTeachingView(bounds,{scroll:true,force:true});renderViewport(true);scheduleSave();},
    scrollTo(y){view.y=(window.Teacher?.canvasArea().top||110)-y*view.zoom;renderViewport();scheduleSave();},
    scrollBy(dy){view.y-=dy;renderViewport();scheduleSave();},
    flush:()=>saveLocal(),
    svg:()=>B.svgDocument(elements,background,true)
  };
  window.BoardPDF?.attach({scene:()=>({elements,background}),filename:safeName,save:desktop&&requestSave});
  createLibrary();canvas.dataset.tool=tool;$('#file-name').value=documentName;render();updateProperties();
  $('#board-title').textContent=documentName;
  if(workspaceError)setTimeout(()=>toast(workspaceError),700);
  if(elements.length){$('#save-state').classList.add('visible');}if(!storageAvailable)setTimeout(()=>toast('Local storage is unavailable. Save your drawing to a file to keep it.'),500);
})();
