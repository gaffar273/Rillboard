(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./perfect-freehand.js') : root.PerfectFreehand,
    typeof module === 'object' && module.exports ? require('./india-boundary.js') : root.IndiaBoundary,
    typeof module === 'object' && module.exports ? require('./shapes.js') : root.DrawingShapes);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Board = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ink, india, shapes) {
  'use strict';
  const TYPES = new Set(['graphpaper', 'rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'pencil', 'text', 'image',
    ...Object.values(shapes).filter(shape => shape.outline).map(shape => shape.type)]);
  const COLORS = /^(#[0-9a-f]{3,8}|transparent)$/i;
  const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Math.max(-1e7, Math.min(1e7, Number(v))) : fallback;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const id = () => 's' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Date.now().toString(36));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function localBounds(e) {
    if (e.type === 'pencil' && e.points?.length) {
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
      for(const point of e.points){
        left=Math.min(left,point[0]);right=Math.max(right,point[0]);
        top=Math.min(top,point[1]);bottom=Math.max(bottom,point[1]);
      }
      return {x:e.x+left,y:e.y+top,w:right-left,h:bottom-top};
    }
    return { x: Math.min(e.x, e.x + e.w), y: Math.min(e.y, e.y + e.h), w: Math.abs(e.w), h: Math.abs(e.h) };
  }
  function turn(p,c,a) { const x=p.x-c.x,y=p.y-c.y;return {x:c.x+x*Math.cos(a)-y*Math.sin(a),y:c.y+x*Math.sin(a)+y*Math.cos(a)}; }
  function bounds(e) {
    const b=localBounds(e);if(!e.angle)return b;
    const c={x:b.x+b.w/2,y:b.y+b.h/2},pts=[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]].map(([x,y])=>turn({x,y},c,e.angle));
    const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
  }
  function rotate(e,c,a) { const b=localBounds(e),old={x:b.x+b.w/2,y:b.y+b.h/2},next=turn(old,c,a);return {...e,x:e.x+next.x-old.x,y:e.y+next.y-old.y,angle:(e.angle||0)+a}; }
  function inside(p,poly) { let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes; }
  function shapePaths(shape, bounds) {
    const scale = path => path.map(([x,y]) => ({x: bounds.x+x*bounds.w, y: bounds.y+y*bounds.h}));
    return [scale([...shape.outline, shape.outline[0]]), ...shape.edges.map(scale), ...shape.hidden.map(scale)];
  }
  function lassoContains(e,poly) {
    if(poly.length<3)return false;
    const b=localBounds(e),c={x:b.x+b.w/2,y:b.y+b.h/2};let pts;
    if(e.type==='pencil')pts=e.points.map(p=>({x:e.x+p[0],y:e.y+p[1]}));
    else if(e.type==='line'||e.type==='arrow')pts=[{x:e.x,y:e.y},{x:e.x+e.w,y:e.y+e.h}];
    else if(e.type==='diamond')pts=[{x:c.x,y:b.y},{x:b.x+b.w,y:c.y},{x:c.x,y:b.y+b.h},{x:b.x,y:c.y},{x:c.x,y:b.y}];
    else if(e.type==='ellipse')pts=Array.from({length:65},(_,i)=>({x:c.x+b.w/2*Math.cos(i*Math.PI/32),y:c.y+b.h/2*Math.sin(i*Math.PI/32)}));
    else pts=[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h},{x:b.x,y:b.y}];
    const paths = shapes[e.type]?.outline ? shapePaths(shapes[e.type],b) : [pts];
    return paths.some(path => lassoCrossesPath(path.map(p=>turn(p,c,e.angle||0)), poly, e.type==='graphpaper'));
  }
  function lassoCrossesPath(pts,poly,requireAll) {
    const contains=p=>inside(p,poly)||poly.some((a,i)=>segmentDistance(p,a,poly[(i+1)%poly.length])<.001);
    if(requireAll)return pts.every(contains);
    if(pts.some(contains))return true;
    const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    for(let i=1;i<pts.length;i++)for(let j=0;j<poly.length;j++){
      const a=pts[i-1],b=pts[i],c=poly[j],d=poly[(j+1)%poly.length];
      if(segmentDistance(c,a,b)<.001||segmentDistance(d,a,b)<.001)return true;
      if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return true;
    }
    return false;
  }
  function union(elements) {
    if (!elements.length) return null;
    const all = elements.map(bounds);
    const x = Math.min(...all.map(b => b.x)), y = Math.min(...all.map(b => b.y));
    return { x, y, w: Math.max(...all.map(b => b.x + b.w)) - x, h: Math.max(...all.map(b => b.y + b.h)) - y };
  }
  function segmentDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }
  function hit(e, p, tolerance = 7) {
    const b = localBounds(e), t = tolerance + e.strokeWidth / 2;
    if(e.angle)p=turn(p,{x:b.x+b.w/2,y:b.y+b.h/2},-e.angle);
    if (p.x < b.x - t || p.x > b.x + b.w + t || p.y < b.y - t || p.y > b.y + b.h + t) return false;
    if (shapes[e.type]?.outline) {
      const [outline] = shapePaths(shapes[e.type],b);
      return inside(p,outline) || outline.slice(1).some((point,i) => segmentDistance(p,outline[i],point)<=t);
    }
    if(e.type==='graphpaper')return true;
    if (e.type === 'line' || e.type === 'arrow') return segmentDistance(p, { x: e.x, y: e.y }, { x: e.x + e.w, y: e.y + e.h }) <= t;
    if (e.type === 'pencil') return e.points.some((pt, i) => segmentDistance(p, { x: e.x + pt[0], y: e.y + pt[1] }, { x: e.x + (e.points[i - 1] || pt)[0], y: e.y + (e.points[i - 1] || pt)[1] }) <= t);
    if (e.type === 'ellipse') return Math.pow((p.x - b.x - b.w / 2) / (b.w / 2 + t), 2) + Math.pow((p.y - b.y - b.h / 2) / (b.h / 2 + t), 2) <= 1;
    if (e.type === 'diamond') return Math.abs((p.x - b.x - b.w / 2) / (b.w / 2 + t)) + Math.abs((p.y - b.y - b.h / 2) / (b.h / 2 + t)) <= 1;
    return true;
  }
  function resize(element, from, to) {
    const e = { ...element }, sx = to.w / (from.w || 1), sy = to.h / (from.h || 1);
    e.x = to.x + (element.x - from.x) * sx;
    e.y = to.y + (element.y - from.y) * sy;
    e.w = element.w * sx; e.h = element.h * sy;
    if (element.points) e.points = element.points.map(p => [p[0] * sx, p[1] * sy, ...p.slice(2)]);
    if (element.type === 'text') { e.fontSize = Math.max(8, Math.round(element.fontSize * Math.min(Math.abs(sx), Math.abs(sy)))); e.w = Math.max(1, e.w); e.h = Math.max(1, e.h); }
    return e;
  }
  // Clip a stroke segment against the two round caps and rectangular body
  // swept by the brush. All three pieces form one convex interval.
  function brushInterval(p,q,a,b,r){
    const dx=q[0]-p[0],dy=q[1]-p[1],length2=dx*dx+dy*dy;
    const hits=[];
    function add(lo,hi){
      lo=Math.max(0,lo);hi=Math.min(1,hi);
      if(hi>lo)hits.push([lo,hi]);
    }
    for(const tip of [a,b]){
      const x=p[0]-tip.x,y=p[1]-tip.y;
      if(!length2){if(x*x+y*y<=r*r)add(0,1);continue;}
      const dot=x*dx+y*dy,disc=dot*dot-length2*(x*x+y*y-r*r);
      if(disc>=0)add((-dot-Math.sqrt(disc))/length2,(-dot+Math.sqrt(disc))/length2);
    }
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    if(length){
      const ux=(b.x-a.x)/length,uy=(b.y-a.y)/length,x=p[0]-a.x,y=p[1]-a.y;
      let lo=0,hi=1;
      for(const [pos,delta,min,max] of [[x*ux+y*uy,dx*ux+dy*uy,0,length],[y*ux-x*uy,dy*ux-dx*uy,-r,r]]){
        if(!delta){if(pos<min||pos>max)hi=-1;continue;}
        const t0=(min-pos)/delta,t1=(max-pos)/delta;
        lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
      }
      add(lo,hi);
    }
    return hits.length?[Math.min(...hits.map(h=>h[0])),Math.max(...hits.map(h=>h[1]))]:null;
  }
  function eraseStroke(e,a,b,radius,box=bounds(e)){
    if(e.type!=='line'&&e.type!=='pencil')return [e];
    const r=radius+e.strokeWidth/2;
    if(Math.max(a.x,b.x)+r<box.x||Math.min(a.x,b.x)-r>box.x+box.w||
       Math.max(a.y,b.y)+r<box.y||Math.min(a.y,b.y)-r>box.y+box.h)return [e];
    const local=localBounds(e),center={x:local.x+local.w/2,y:local.y+local.h/2};
    const points=(e.points||[[0,0],[e.w,e.h]]).map(([x,y,pressure])=>{
      const pt=turn({x:e.x+x,y:e.y+y},center,e.angle||0);
      return Number.isFinite(pressure)?[pt.x,pt.y,pressure]:[pt.x,pt.y];
    });
    if(points.length===1)return segmentDistance({x:points[0][0],y:points[0][1]},a,b)<=r?[]:[e];
    const pieces=[];let run=[points[0]],changed=false;
    for(let i=1;i<points.length;i++){
      const p=points[i-1],q=points[i],cut=brushInterval(p,q,a,b,r);
      if(!run.length)run.push(p);
      if(!cut){run.push(q);continue;}
      changed=true;
      const interpolate=t=>{
        const result=[p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])];
        if(Number.isFinite(p[2])||Number.isFinite(q[2]))result.push((1-t)*(p[2]??q[2])+t*(q[2]??p[2]));
        return result;
      };
      if(cut[0]>0)run.push(interpolate(cut[0]));
      if(run.length>1)pieces.push(run);
      run=cut[1]<1?[interpolate(cut[1]),q]:[];
    }
    if(!changed)return [e];
    if(run.length>1)pieces.push(run);
    return pieces.map((part,i)=>{
      const [x,y]=part[0],end=part.at(-1);
      const fragment={...e,id:i?id():e.id,x,y,angle:0,w:end[0]-x,h:end[1]-y};
      if(e.type==='pencil')fragment.points=part.map(([px,py,...pressure])=>[px-x,py-y,...pressure]);
      return fragment;
    });
  }
  const fonts = Object.freeze({hand:"'Segoe Print', 'Comic Sans MS', cursive", sans:"'Segoe UI', Arial, sans-serif", serif:'Georgia, serif', mono:'Consolas, monospace', book:"'Times New Roman', serif"});
  function textFamily(e){return Object.hasOwn(fonts,e.fontFace)?fonts[e.fontFace]:fonts.hand;}
  function textFont(e){return (e.italic?'italic ':'')+(e.bold?'bold ':'')+e.fontSize+'px '+textFamily(e);}
  function sanitizeElement(raw) {
    if (!raw || typeof raw !== 'object' || raw.isDeleted) return null;
    const type = raw.type === 'freedraw' ? 'pencil' : raw.type;
    if (!TYPES.has(type)) return null;
    const e = { id: typeof raw.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(raw.id) ? raw.id : id(), type, x: num(raw.x), y: num(raw.y), w: num(raw.w ?? raw.width, 100), h: num(raw.h ?? raw.height, 100),
      angle: num(raw.angle), penStyle: ['pen','pencil','marker','highlighter'].includes(raw.penStyle)?raw.penStyle:'pen',
      stroke: COLORS.test(raw.stroke ?? raw.strokeColor) ? (raw.stroke ?? raw.strokeColor) : '#1e1e1e',
      fill: COLORS.test(raw.fill ?? raw.backgroundColor) ? (raw.fill ?? raw.backgroundColor) : 'transparent',
      fillStyle: raw.fillStyle === 'solid' ? 'solid' : 'hachure', strokeWidth: clamp(num(raw.strokeWidth, 1.5), .5, 20),
      dash: ['solid', 'dashed', 'dotted'].includes(raw.dash ?? raw.strokeStyle) ? (raw.dash ?? raw.strokeStyle) : 'solid',
      rough: clamp(num(raw.rough ?? raw.roughness, 1), 0, 2), opacity: clamp(num(raw.opacity, 100), 0, 100), fontSize: clamp(num(raw.fontSize, 24), 8, 200), text: String(raw.text ?? '').slice(0, 20000) };
    if(type==='text'){
      if(Object.hasOwn(fonts,raw.fontFace))e.fontFace=raw.fontFace;
      for(const key of ['bold','italic','underline'])if(raw[key]===true)e[key]=true;
    }
    if(typeof raw.graphId==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(raw.graphId))e.graphId=raw.graphId;
    if(type==='graphpaper'){e.gridSize=clamp(num(raw.gridSize,20),5,100);e.showAxes=raw.showAxes!==false;}
    if (type === 'pencil') {
      if (raw.smoothInk === true) e.smoothInk = true;
      e.plotCurve=raw.plotCurve===true;
      e.points = (Array.isArray(raw.points) ? raw.points : []).slice(0, 12000).filter(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])).map(p => [num(p[0]), num(p[1]), ...(Number.isFinite(p[2])?[clamp(p[2], .05, 1)]:[])]);
      if (!e.points.length) return null;
    }
    if ((type === 'arrow' || type === 'line') && Array.isArray(raw.points) && raw.points.length >= 2) {
      const first = raw.points[0], last = raw.points[raw.points.length - 1];
      e.x += num(first?.[0]); e.y += num(first?.[1]); e.w = num(last?.[0]) - num(first?.[0]); e.h = num(last?.[1]) - num(first?.[1]);
    }
    if (type === 'image') {
      if (typeof raw.src !== 'string' || raw.src.length > 16000000 || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(raw.src)) return null;
      e.src = raw.src;
    }
    return e;
  }
  function parseScene(data) {
    if (!data || !Array.isArray(data.elements)) throw new Error('This is not a drawing file. Please choose a .excalidraw or .json drawing.');
    if (data.elements.length > 2000) throw new Error('This drawing has too many elements. Please use a drawing with fewer than 2,000 elements.');
    const elements = data.elements.map(sanitizeElement).filter(Boolean), seen = new Set();
    elements.forEach(e=>{if(seen.has(e.id))e.id=id();seen.add(e.id);});
    if (data.elements.some(e => e && !e.isDeleted) && !elements.length) throw new Error('This file does not contain supported drawing elements.');
    const sourceBg = data.background ?? data.appState?.viewBackgroundColor;
    return { elements, background: COLORS.test(sourceBg) && sourceBg !== 'transparent' ? sourceBg : '#ffffff' };
  }
  // Parse arithmetic into closures; expressions cannot access JavaScript objects.
  function equation(source, variables=['x']) {
    source=source.trim().replace(/^y\s*=\s*/i,'').toLowerCase().replace(/π/g,'pi').replace(/θ/g,'theta').replace(/−/g,'-');
    if(source.length>500)throw Error('Keep each expression under 500 characters.');
    const tokens=source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z]+|<=|>=|==|!=|[+*/%^(),<>-]/g)||[];
    if(tokens.join('')!==source.replace(/\s/g,''))throw Error('Unsupported symbol in expression.');
    let i=0;
    const fn={indiax:t=>india.coordinate(t,0),indiay:t=>india.coordinate(t,1),sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,atan2:Math.atan2,sinh:Math.sinh,cosh:Math.cosh,tanh:Math.tanh,asinh:Math.asinh,acosh:Math.acosh,atanh:Math.atanh,sqrt:Math.sqrt,cbrt:Math.cbrt,abs:Math.abs,ln:Math.log,log:Math.log10,log2:Math.log2,exp:Math.exp,floor:Math.floor,ceil:Math.ceil,round:Math.round,sign:Math.sign,min:Math.min,max:Math.max,pow:Math.pow,hypot:Math.hypot,sec:x=>1/Math.cos(x),csc:x=>1/Math.sin(x),cot:x=>1/Math.tan(x)};
    // Function names with digits are joined explicitly, without permitting property access.
    for(let j=0;j<tokens.length-1;j++)if(['atan','log'].includes(tokens[j])&&tokens[j+1]==='2')tokens.splice(j,2,tokens[j]+'2');
    function atom(){
      const t=tokens[i++];
      if(t==='('){const f=compare();if(tokens[i++]!==')')throw Error('Missing closing parenthesis.');return f;}
      if(variables.includes(t)){const index=variables.indexOf(t);return (...v)=>v[index];}
      if(t==='pi')return ()=>Math.PI;if(t==='e')return ()=>Math.E;
      if(fn[t]||t==='if'){
        if(tokens[i++]!=='(')throw Error('Functions need parentheses.');
        const args=[compare()];while(tokens[i]===','){i++;args.push(compare());}
        if(tokens[i++]!==')')throw Error('Missing closing parenthesis.');
        const count=t==='if'?3:['atan2','pow'].includes(t)?2:1;
        if(['min','max','hypot'].includes(t)?args.length<2:args.length!==count)throw Error('Wrong number of arguments for '+t+'.');
        if(t==='if')return (...v)=>args[0](...v)?args[1](...v):args[2](...v);
        return (...v)=>fn[t](...args.map(f=>f(...v)));
      }
      if(t&&Number.isFinite(Number(t)))return ()=>Number(t);
      throw Error('Unknown value "'+(t||'')+'". Available variables: '+variables.join(', ')+'.');
    }
    function power(){let f=atom();if(tokens[i]==='^'){i++;const a=f,b=unary();f=(...v)=>a(...v)**b(...v);}return f;}
    function unary(){if(tokens[i]==='+'){i++;return unary();}if(tokens[i]==='-'){i++;const f=unary();return (...v)=>-f(...v);}return power();}
    function startsAtom(t){return t==='('||variables.includes(t)||t==='pi'||t==='e'||!!fn[t]||t==='if';}
    function mul(){let f=unary();while(['*','/','%'].includes(tokens[i])||startsAtom(tokens[i])){const op=startsAtom(tokens[i])?'*':tokens[i++],a=f,b=unary();f=op==='*'?(...v)=>a(...v)*b(...v):op==='/'?(...v)=>a(...v)/b(...v):(...v)=>a(...v)%b(...v);}return f;}
    function add(){let f=mul();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],a=f,b=mul();f=op==='+'?(...v)=>a(...v)+b(...v):(...v)=>a(...v)-b(...v);}return f;}
    function compare(){let f=add();if(['<','>','<=','>=','==','!='].includes(tokens[i])){const op=tokens[i++],a=f,b=add();f=(...v)=>{const x=a(...v),y=b(...v);return Number(op==='<'?x<y:op==='>'?x>y:op==='<='?x<=y:op==='>='?x>=y:op==='=='?x===y:x!==y);};}return f;}
    const f=compare();if(i!==tokens.length)throw Error('Unexpected input near '+tokens[i]+'.');return f;
  }
  function graph({expression='',mode='cartesian',xmin=-10,xmax=10,ymin=-10,ymax=10,step=1,tmin=0,tmax=Math.PI*2,x=0,y=0,width=600,height=400,quality=2400,equalScale=false}) {
    if(![xmin,xmax,ymin,ymax,step,x,y,width,height,tmin,tmax].every(Number.isFinite)||xmax<=xmin||ymax<=ymin||step<=0||width<=0||height<=0)throw Error('Enter increasing ranges and positive grid spacing.');
    if([xmin,xmax,ymin,ymax,tmin,tmax].some(v=>Math.abs(v)>1e6)||step<1e-6)throw Error('Use ranges within ±1,000,000 and spacing at least 0.000001.');
    if((xmax-xmin)/step+(ymax-ymin)/step>160)throw Error('Increase spacing: at most 160 grid lines.');
    if(!['cartesian','implicit','parametric','polar'].includes(mode))throw Error('Unknown graph type.');
    if(['parametric','polar'].includes(mode)&&tmax<=tmin)throw Error('The parameter maximum must exceed its minimum.');
    if(equalScale){const unit=Math.min(width/(xmax-xmin),height/(ymax-ymin));width=unit*(xmax-xmin);height=unit*(ymax-ymin);}
    const px=v=>x+(v-xmin)/(xmax-xmin)*width,py=v=>y+height-(v-ymin)/(ymax-ymin)*height,items=[];
    const add=(type,xx,yy,w,h,extra={})=>items.push({id:id(),type,x:xx,y:yy,w,h,stroke:'#1e1e1e',fill:'transparent',fillStyle:'solid',strokeWidth:1,dash:'solid',rough:0,opacity:100,fontSize:14,...extra});
    const label=(xx,yy,text,color='#1e1e1e')=>add('text',xx,yy,Math.max(20,text.length*9),20,{text,stroke:color});
    const format=v=>String(Number(v.toPrecision(5)));
    const nx=Math.floor((xmax-xmin)/step),ny=Math.floor((ymax-ymin)/step),skipX=Math.max(1,Math.ceil(nx/12)),skipY=Math.max(1,Math.ceil(ny/10));
    let k=0;for(let v=Math.ceil(xmin/step)*step;v<=xmax+step*1e-8;v+=step){add('line',px(v),y,0,height,{stroke:'#d9dce5',strokeWidth:.7});if(k++%skipX===0)label(px(v)-8,y+height+5,format(v));}
    k=0;for(let v=Math.ceil(ymin/step)*step;v<=ymax+step*1e-8;v+=step){add('line',x,py(v),width,0,{stroke:'#d9dce5',strokeWidth:.7});if(k++%skipY===0)label(x-55,py(v)-10,format(v));}
    add('rectangle',x,y,width,height,{stroke:'#adb5bd'});
    if(ymin<=0&&ymax>=0)add('arrow',x,py(0),width,0,{strokeWidth:1.5});
    if(xmin<=0&&xmax>=0)add('arrow',px(0),y+height,0,-height,{strokeWidth:1.5});
    label(x+width+12,py(clamp(0,ymin,ymax))-10,'x');label(px(clamp(0,xmin,xmax))+8,y-28,'y');
    const rows=expression.split(/\n/).map(s=>s.trim()).filter(Boolean);
    if(rows.length>8)throw Error('Plot up to eight curves at a time.');
    const palette=['#1971c2','#e03131','#2f9e44','#9c36b5','#e67700','#0b7285','#c2255c','#495057'];
    const count=clamp(Math.round(quality),600,6000);
    rows.forEach((row,index)=>{
      try {
        const color=palette[index];let valid=0;
        const curve=points=>{if(points.length>1){if(items.length>=1900)throw Error('Too many curve segments. Narrow the range or simplify the equation.');add('pencil',x,y,width,height,{points,stroke:color,strokeWidth:2.5,penStyle:'pen',plotCurve:true});valid++;}};
        // Sample the canonical map at its own vertices to keep small islands.
        const wholeMap = mode==='parametric' && row.toLowerCase().replace(/\s/g,'')==='indiax(t);indiay(t)'
          && tmin<=0 && tmax>=1 && xmin<=-9 && xmax>=9 && ymin<=-9 && ymax>=9;
        if(wholeMap){
          for(const ring of india.rings){
            curve(ring.map(([a,b])=>[px(a)-x,py(b)-y]));
            items[items.length-1].strokeWidth=1;
          }
        } else if(mode==='implicit'){
          const parts=row.split(/(?<![<>!=])=(?!=)/);if(parts.length!==2)throw Error('Use an equation, for example x^2+y^2=25.');
          const left=equation(parts[0],['x','y']),right=equation(parts[1],['x','y']),f=(a,b)=>left(a,b)-right(a,b);
          const n=quality>3000?240:160,dx=(xmax-xmin)/n,dy=(ymax-ymin)/n,values=[];
          for(let j=0;j<=n;j++){const line=[];for(let i=0;i<=n;i++)line.push(f(xmin+i*dx,ymin+j*dy));values.push(line);}
          const nodes=new Map(),edges=[];
          const node=p=>{const key=p.map(v=>Math.round(v*1e6)).join(',');if(!nodes.has(key))nodes.set(key,{p,edges:[]});return nodes.get(key);};
          const connect=(a,b)=>{const u=node(a),v=node(b);if(u===v)return;const edge={u,v,used:false};u.edges.push(edge);v.edges.push(edge);edges.push(edge);};
          for(let j=0;j<n;j++)for(let i=0;i<n;i++){
            const ps=[[xmin+i*dx,ymin+j*dy],[xmin+(i+1)*dx,ymin+j*dy],[xmin+(i+1)*dx,ymin+(j+1)*dy],[xmin+i*dx,ymin+(j+1)*dy]],vs=[values[j][i],values[j][i+1],values[j+1][i+1],values[j+1][i]];
            if(!vs.every(Number.isFinite))continue;
            const hits=[];
            for(let a=0;a<4;a++){const b=(a+1)%4;if((vs[a]>0)===(vs[b]>0))continue;const t=vs[a]/(vs[a]-vs[b]),p=[ps[a][0]+t*(ps[b][0]-ps[a][0]),ps[a][1]+t*(ps[b][1]-ps[a][1])],res=f(...p);if(Number.isFinite(res)&&Math.abs(res)<=Math.max(Math.abs(vs[a]),Math.abs(vs[b]))+.000000001)hits.push([px(p[0])-x,py(p[1])-y]);}
            if(hits.length===2)connect(hits[0],hits[1]);
            if(hits.length===4){const center=f(xmin+(i+.5)*dx,ymin+(j+.5)*dy);if((center>0)===(vs[0]>0)){connect(hits[0],hits[1]);connect(hits[2],hits[3]);}else{connect(hits[0],hits[3]);connect(hits[1],hits[2]);}}
          }
          const walk=start=>{let current=start,points=[start.p],edge;while((edge=current.edges.find(e=>!e.used))){edge.used=true;current=edge.u===current?edge.v:edge.u;points.push(current.p);}curve(points);};
          for(const node of nodes.values())if(node.edges.length===1&&!node.edges[0].used)walk(node);
          for(const edge of edges)if(!edge.used)walk(edge.u);
        } else {
          let evaluate,lo=xmin,hi=xmax;
          if(mode==='cartesian'){const f=equation(row);evaluate=t=>[t,f(t)];}
          if(mode==='parametric'){const parts=row.split(';');if(parts.length!==2)throw Error('Enter x(t); y(t), for example 5*cos(t); 3*sin(t).');const fx=equation(parts[0],['t']),fy=equation(parts[1],['t']);evaluate=t=>[fx(t),fy(t)];lo=tmin;hi=tmax;}
          if(mode==='polar'){const f=equation(row.replace(/^r\s*=\s*/i,''),['theta','t']);evaluate=t=>{const r=f(t,t);return [r*Math.cos(t),r*Math.sin(t)];};lo=tmin;hi=tmax;}
          let points=[],previous=null;
          const flush=()=>{curve(points);points=[];};
          const inRange=p=>p.every(Number.isFinite)&&p[0]>=xmin&&p[0]<=xmax&&p[1]>=ymin&&p[1]<=ymax;
          for(let i=0;i<=count;i++){
            const t=lo+(hi-lo)*i/count,p=evaluate(t),mid=previous?evaluate(t-(hi-lo)/(2*count)):p;
            if(!inRange(p)||!inRange(mid)||previous&&(Math.hypot((p[0]-previous[0])/(xmax-xmin),(p[1]-previous[1])/(ymax-ymin))>.3||Math.hypot((mid[0]-(p[0]+previous[0])/2)/(xmax-xmin),(mid[1]-(p[1]+previous[1])/2)/(ymax-ymin))>.002)){flush();previous=null;continue;}
            points.push([px(p[0])-x,py(p[1])-y]);previous=p;
          }flush();
        }
        if(!valid)throw Error('No visible curve. Adjust the range or expression.');
        label(x,y-35-(rows.length-1-index)*24,(mode==='cartesian'?'y = ':mode==='polar'?'r = ':'')+row.replace(/^[yr]\s*=\s*/i,''),color);
      }catch(error){throw Error('Curve '+(index+1)+': '+error.message);}
    });
    const graphId=id();for(const item of items)item.graphId=graphId;
    return items;
  }
  function roundedRect(b) {
    const r = Math.min(8, b.w / 8, b.h / 8);
    return `M${b.x+r} ${b.y}H${b.x+b.w-r}Q${b.x+b.w} ${b.y} ${b.x+b.w} ${b.y+r}V${b.y+b.h-r}Q${b.x+b.w} ${b.y+b.h} ${b.x+b.w-r} ${b.y+b.h}H${b.x+r}Q${b.x} ${b.y+b.h} ${b.x} ${b.y+b.h-r}V${b.y+r}Q${b.x} ${b.y} ${b.x+r} ${b.y}Z`;
  }
  function roughLine(x1, y1, x2, y2, seed) {
    const n = Math.sin(seed * 1.7 + x1 + y2) * .9;
    return `M${x1} ${y1}Q${(x1+x2)/2+n} ${(y1+y2)/2+n*1.7} ${x2} ${y2}`;
  }
  function pressureRadius(width, pressure) {
    return width * (.65 + 1.25 * clamp(pressure, 0, 1)) / 2;
  }

  // Rounded centerlines keep ink connected even when the tip doubles back.
  // Join neighboring samples of similar pressure into one SVG path.
  function pressureInk(e, stroke) {
    const points = e.points;
    const pencil = e.penStyle === 'pencil';
    let pressure = points[0][2] ?? .5;
    const nibWidth = () => pressureRadius(e.strokeWidth, pressure) * (pencil ? 1.65 : 2);
    let x = e.x + points[0][0], y = e.y + points[0][1];
    if (points.length === 1) return `<circle data-pressure-ink="true" cx="${x}" cy="${y}" r="${nibWidth()/2}" fill="${stroke}" stroke="none"/>`;
    let previousWidth, path = '', paths = [];
    function flush() {
      if (path) paths.push(`<path d="${path}" stroke-width="${previousWidth}"/>`);
    }
    function appendCurve(cx,cy,endX,endY,width) {
      const rounded = Math.max(.25, Math.round(width*8)/8);
      if (rounded !== previousWidth) {
        flush();
        path = `M${x} ${y}`;
        previousWidth = rounded;
      }
      path += `Q${cx} ${cy} ${endX} ${endY}`;
      x=endX; y=endY;
    }
    for (let i = 0; i < points.length; i++) {
      const point = points[i], next = points[i+1] || point;
      const startWidth=nibWidth();
      pressure += .55 * ((point[2] ?? pressure) - pressure);
      const endWidth=nibWidth(), startX=x, startY=y;
      let cx=e.x+point[0], cy=e.y+point[1];
      const endX=e.x+(point[0]+next[0])/2, endY=e.y+(point[1]+next[1])/2;
      // Limit corner cutting to half a nib. A fast, sparsely sampled V or
      // retraced stem should still reach the tip of the letter.
      const gapX=(startX+endX-2*cx)/4, gapY=(startY+endY-2*cy)/4;
      const gap=Math.hypot(gapX,gapY), limit=Math.max(.3,endWidth*.35);
      const turningBack=(cx-startX)*(endX-cx)+(cy-startY)*(endY-cy)<=0;
      if(i>0 && i<points.length-1 && turningBack && gap>limit){
        const correction=2*(1-limit/gap);
        cx-=gapX*correction; cy-=gapY*correction;
      }
      // Subdivide only where there is room for a visible width transition.
      const steps=Math.max(1,Math.min(8,Math.ceil(Math.abs(endWidth-startWidth)*6),
        Math.ceil((Math.hypot(cx-startX,cy-startY)+Math.hypot(endX-cx,endY-cy))/2)));
      for(let j=1;j<=steps;j++){
        const t=j/steps, u=1-t, prev=(j-1)/steps;
        const controlX=x+((1-prev)*(cx-startX)+prev*(endX-cx))/steps;
        const controlY=y+((1-prev)*(cy-startY)+prev*(endY-cy))/steps;
        appendCurve(controlX,controlY,u*u*startX+2*u*t*cx+t*t*endX,
          u*u*startY+2*u*t*cy+t*t*endY,startWidth+(endWidth-startWidth)*t);
      }
    }
    flush();
    return `<g data-pressure-ink="true" fill="none" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round">${paths.join('')}</g>`;
  }
  // Build one continuous silhouette so pressure changes cannot leave seams.
  function handwritingSvg(e, stroke) {
    const pencil = e.penStyle === 'pencil';
    const size = Math.max(pencil ? 1.65 : 1.85, e.strokeWidth * (pencil ? 1.05 : 1.16));
    const measured = e.points.some(point => Number.isFinite(point[2]));
    const thinning = pencil ? .48 : .42;
    const first = e.points[0];
    const attributes = `${measured || pencil ? 'data-pressure-ink="true" ' : ''}fill="${stroke}" stroke="none"`;
    if (e.points.length === 1) {
      const radius = size * (.5 + thinning * ((first[2] ?? .5) - .5));
      return `<circle cx="${e.x+first[0]}" cy="${e.y+first[1]}" r="${radius}" ${attributes}/>`;
    }
    // Sparse tablet reports can jump over an entire letter stem. Give the
    // outline builder intermediate tangents before it rounds a reversal.
    // Smooth small lateral deviations while keeping endpoints, pressure and sharp turns.
    const points = e.smoothInk ? e.points.map((p,i,raw) => {
      if (!i || i === raw.length-1) return p;
      const a=raw[i-1], b=raw[i+1], ux=p[0]-a[0], uy=p[1]-a[1], vx=b[0]-p[0], vy=b[1]-p[1];
      if (ux*vx+uy*vy <= 0) return p;
      const left=Math.hypot(ux,uy), right=Math.hypot(vx,vy), t=left/(left+right);
      const dx=(b[0]-a[0])*t-ux, dy=(b[1]-a[1])*t-uy;
      const weight=Math.min(.5, size*.18/(Math.hypot(dx,dy)||1));
      return [p[0]+weight*dx, p[1]+weight*dy, ...p.slice(2)];
    }) : e.points;
    const samples = [first];
    for (let i = 1; i < points.length; i++) {
      const a = points[i-1], b = points[i];
      const dx = b[0]-a[0], dy = b[1]-a[1];
      const steps = Math.min(32, Math.ceil(Math.hypot(dx,dy) / Math.max(2,size)));
      for (let j = 1; j < steps; j++) {
        const t = j / steps;
        samples.push([a[0]+dx*t, a[1]+dy*t, (a[2]??.5)*(1-t)+(b[2]??.5)*t]);
      }
      samples.push(b);
    }
    const outline = ink.getStroke(samples, {
      size, thinning, simulatePressure: !measured, streamline: .45, smoothing: .55, last: true
    });
    const coord = n => Math.round(n * 100) / 100;
    const midpoint = (a, b) => `${coord((a[0]+b[0])/2)} ${coord((a[1]+b[1])/2)}`;
    let path = 'M' + midpoint(outline.at(-1), outline[0]);
    for (let i = 0; i < outline.length; i++) {
      const point = outline[i];
      path += `Q${coord(point[0])} ${coord(point[1])} ${midpoint(point, outline[(i+1)%outline.length])}`;
    }
    return `<path transform="translate(${e.x} ${e.y})" d="${path}Z" ${attributes}/>`;
  }
  function elementSvg(e) {
    const b = localBounds(e), stroke = escape(e.stroke), isFill = e.fill && e.fill !== 'transparent';
    const fill = !isFill ? 'none' : e.fillStyle === 'solid' ? escape(e.fill) : `url(#h${e.id})`;
    let defs = isFill && e.fillStyle !== 'solid' ? `<defs><pattern id="h${e.id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><path d="M0 0V7" stroke="${escape(e.fill)}" stroke-width="2"/></pattern></defs>` : '';
    let content = '', outline = '';
    if(e.type==='graphpaper'){
      const size=e.gridSize||20,major=size*5,cx=b.x+b.w/2,cy=b.y+b.h/2;
      defs+=`<defs><pattern id="grid${e.id}" x="${cx}" y="${cy}" width="${major}" height="${major}" patternUnits="userSpaceOnUse"><path d="${Array.from({length:5},(_,i)=>`M${i*size} 0V${major}M0 ${i*size}H${major}`).join(' ')}" fill="none" stroke="${stroke}" stroke-opacity=".25" stroke-width=".6"/><path d="M0 ${major}V0H${major}" fill="none" stroke="${stroke}" stroke-opacity=".55" stroke-width="1"/></pattern></defs>`;
      content=`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="url(#grid${e.id})" stroke="${stroke}" stroke-width=".8"/>`;
      if(e.showAxes!==false)content+=`<path d="M${b.x} ${cy}H${b.x+b.w}M${cx} ${b.y}V${b.y+b.h}" stroke="${stroke}" stroke-width="1.2" fill="none"/>`;
    }
    if (shapes[e.type]?.outline) {
      const shape = shapes[e.type];
      const [border, ...details] = shapePaths(shape,b);
      const path = points => points.map((p,i) => (i?'L':'M') + p.x + ' ' + p.y).join('');
      content = `<path d="${path(border)}Z" fill="${fill}"/>`;
      details.forEach((edge,i) => {
        const hidden = i >= shape.edges.length ? ' stroke-dasharray="4 4" opacity=".55"' : '';
        content += `<path d="${path(edge)}" fill="none"${hidden}/>`;
      });
    }
    if (e.type === 'rectangle') content = `<path d="${roundedRect(b)}" fill="${fill}"/>`;
    if (e.type === 'diamond') content = `<path d="M${b.x+b.w/2} ${b.y}L${b.x+b.w} ${b.y+b.h/2}L${b.x+b.w/2} ${b.y+b.h}L${b.x} ${b.y+b.h/2}Z" fill="${fill}"/>`;
    if (e.type === 'ellipse') content = `<ellipse cx="${b.x+b.w/2}" cy="${b.y+b.h/2}" rx="${b.w/2}" ry="${b.h/2}" fill="${fill}"/>`;
    if (e.rough && ['rectangle', 'diamond', 'ellipse'].includes(e.type)) {
      if (e.type === 'rectangle') outline = `<path d="${roughLine(b.x+2,b.y+1,b.x+b.w-1,b.y-1,1)} ${roughLine(b.x+b.w-1,b.y,b.x+b.w+1,b.y+b.h-2,2)} ${roughLine(b.x+b.w,b.y+b.h-1,b.x+1,b.y+b.h+1,3)} ${roughLine(b.x+1,b.y+b.h,b.x-1,b.y+2,4)}" fill="none" stroke-width="${e.strokeWidth*.65}" opacity=".6"/>`;
      else outline = content.replace(/fill="[^"]*"/g,'fill="none"').replace('/>', ` transform="translate(.9,-.65)" stroke-width="${e.strokeWidth*.65}" opacity=".5"/>`);
    }
    if (e.type === 'line' || e.type === 'arrow') {
      const x2 = e.x + e.w, y2 = e.y + e.h;
      content = `<path d="${e.rough ? roughLine(e.x,e.y,x2,y2,2) : `M${e.x} ${e.y}L${x2} ${y2}`}" fill="none"/>`;
      if (e.rough) outline = `<path d="${roughLine(e.x+.5,e.y+1,x2-.5,y2-1,7)}" fill="none" opacity=".4" stroke-width="${e.strokeWidth*.7}"/>`;
      if (e.type === 'arrow') {
        const angle = Math.atan2(e.h,e.w), size = Math.min(20,Math.max(8,Math.hypot(e.w,e.h)*.2));
        content += `<path d="M${x2-size*Math.cos(angle-.45)} ${y2-size*Math.sin(angle-.45)}L${x2} ${y2}L${x2-size*Math.cos(angle+.45)} ${y2-size*Math.sin(angle+.45)}" fill="none" stroke-dasharray="none"/>`;
      }
    }
    if (e.type === 'pencil') {
      const p = e.points || [[0,0]];
      const width=e.strokeWidth;
      if (!e.plotCurve && (!e.dash || e.dash==='solid') && ['pen','pencil'].includes(e.penStyle||'pen')) {
        content=handwritingSvg(e,stroke);
      } else if (!e.plotCurve && (e.penStyle==='pencil' || (['pen','marker'].includes(e.penStyle||'pen') && p.some(v=>Number.isFinite(v[2]))))) {
        content=pressureInk(e,stroke);
      } else {
        let d=`M${e.x+p[0][0]} ${e.y+p[0][1]}`;
        for(let i=1;i<p.length-1;i++)d+=e.plotCurve?`L${e.x+p[i][0]} ${e.y+p[i][1]}`:`Q${e.x+p[i][0]} ${e.y+p[i][1]} ${e.x+(p[i][0]+p[i+1][0])/2} ${e.y+(p[i][1]+p[i+1][1])/2}`;
        const last=p[p.length-1];d+=`L${e.x+last[0]} ${e.y+last[1]}`;
        content=p.length===1?`<circle cx="${e.x+p[0][0]}" cy="${e.y+p[0][1]}" r="${width/2}" fill="${stroke}" stroke="none"/>`:`<path d="${d}" fill="none"/>`;
      }
    }
    if (e.type === 'text') content = `<text x="${e.x}" y="${e.y}" font-family="${textFamily(e)}" font-weight="${e.bold?'bold':'normal'}" font-style="${e.italic?'italic':'normal'}" text-decoration="${e.underline?'underline':'none'}" font-size="${e.fontSize}" fill="${stroke}" stroke="none" xml:space="preserve">${String(e.text).split('\n').map((line,i)=>`<tspan x="${e.x}" dy="${i?e.fontSize*1.4:e.fontSize*1.12}">${escape(line)}</tspan>`).join('')}</text>`;
    if (e.type === 'image') content = `<image href="${escape(e.src)}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" preserveAspectRatio="none"/>`;
    const dash = e.dash === 'dashed' ? '10 7' : e.dash === 'dotted' ? '1 5' : 'none';
    return `<g transform="rotate(${(e.angle||0)*180/Math.PI} ${b.x+b.w/2} ${b.y+b.h/2})" data-element="${e.id}" stroke="${stroke}" stroke-width="${e.strokeWidth}" stroke-dasharray="${dash}" opacity="${e.opacity/100}" stroke-linecap="round" stroke-linejoin="round">${defs}${content}${outline}</g>`;
  }
  function visibleElement(e, background) {
    const hex = /^#([a-f0-9]{6})$/i.exec(background);
    if (!hex) return e;
    const n = parseInt(hex[1], 16), luminance = ((n >> 16) * .2126 + ((n >> 8) & 255) * .7152 + (n & 255) * .0722);
    if (luminance < 80 && ['#1e1e1e', '#000000', '#000', '#212529'].includes(e.stroke.toLowerCase())) return {...e, stroke:'#e8e7ef'};
    return e;
  }
  function svgDocument(elements, background, includeBackground = true) {
    const b = union(elements) || { x:0,y:0,w:800,h:500 }, pad = 32;
    const w = Math.max(64,b.w+pad*2), h = Math.max(64,b.h+pad*2);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="${b.x-pad} ${b.y-pad} ${w} ${h}"><title>Drawing</title>${includeBackground?`<rect x="${b.x-pad}" y="${b.y-pad}" width="${w}" height="${h}" fill="${escape(background)}"/>`:''}${elements.map(e=>elementSvg(visibleElement(e, background))).join('')}</svg>`;
  }
  return { eraseStroke, textFont, shapes, pressureRadius, equation, graph, TYPES, num, id, escape, clamp, bounds, localBounds, rotate, lassoContains, union, segmentDistance, hit, resize, sanitizeElement, parseScene, visibleElement, elementSvg, svgDocument };
});
