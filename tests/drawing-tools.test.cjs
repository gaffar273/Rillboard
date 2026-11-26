const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../geometry.js');
test('equations use mathematical precedence and reject executable input',()=>{
  assert.equal(B.equation('-x^2')(3),-9);
  assert.equal(B.equation('2^3^2')(0),512);
  assert.ok(Math.abs(B.equation('sin(pi/2)+sqrt(9)+ln(e)')(0)-5)<1e-10);
  assert.equal(B.equation('2x')(3),6);
  for(const value of ['alert(1)','x.constructor','sin(x','x;1'])assert.throws(()=>B.equation(value));
});
test('advanced functions, piecewise branches, and graph modes produce finite editable curves',()=>{
  assert.equal(B.equation('if(x<0,-x,sqrt(x))')(-3),3);
  assert.equal(B.equation('if(x<0,-x,sqrt(x))')(9),3);
  assert.equal(B.equation('log2(8)+min(2,3)+pow(2,3)')(0),13);
  assert.ok(Math.abs(B.equation('atan2(1,1)')(0)-Math.PI/4)<1e-10);
  assert.throws(()=>B.equation('sin(1,2)'));assert.throws(()=>B.equation('if(x,2)'));
  for(const options of [
    {expression:'sin(x)\ncos(x)'},
    {mode:'implicit',expression:'x^2+y^2=25'},
    {mode:'implicit',expression:'(x^2+y^2-1)^3-x^2*y^3=0',xmin:-2,xmax:2,ymin:-2,ymax:2,step:.5},
    {mode:'parametric',expression:'5*cos(t); 3*sin(t)'},
    {mode:'polar',expression:'5*cos(3*theta)'},
  ]){
    const result=B.graph(options),curves=result.filter(e=>e.type==='pencil');assert.ok(curves.length>0);
    assert.ok(curves.every(e=>e.points.every(p=>p.every(Number.isFinite))));
    assert.equal(B.parseScene({elements:result}).elements.length,result.length);
    assert.ok(curves.every(e=>B.sanitizeElement(e).plotCurve));
  }
  const circle=B.graph({mode:'implicit',expression:'x^2+y^2=25'}).filter(e=>e.type==='pencil');
  for(const e of circle)for(const [px,py] of e.points){const x=px/600*20-10,y=10-py/400*20;assert.ok(Math.abs(x*x+y*y-25)<.02);}
  assert.throws(()=>B.graph({expression:Array(9).fill('x').join('\n')}));
});
test('lasso follows a diamond outline, selects crossing strokes, and excludes distant objects',()=>{
  const diamond=B.sanitizeElement({type:'diamond',x:0,y:0,w:100,h:100});
  const loop=[{x:50,y:-10},{x:110,y:50},{x:50,y:110},{x:-10,y:50}];
  assert.ok(B.lassoContains(diamond,loop));
  assert.ok(!B.lassoContains({...diamond,x:250},loop));
  assert.ok(B.lassoContains(B.sanitizeElement({type:'line',x:-100,y:50,w:300,h:0}),loop));
});
test('drag-sized graph paper survives resize and file export',()=>{
  const paper=B.sanitizeElement({type:'graphpaper',x:300,y:200,w:-200,h:-100,gridSize:20,showAxes:true});
  assert.deepEqual(B.bounds(paper),{x:100,y:100,w:200,h:100});
  assert.match(B.elementSvg(paper),/<pattern/);
  const resized=B.resize(paper,B.bounds(paper),{x:100,y:100,w:400,h:200});
  assert.deepEqual(B.bounds(resized),{x:100,y:100,w:400,h:200});
  assert.equal(B.parseScene({elements:[resized]}).elements[0].gridSize,20);
});
test('graph curves follow coordinates and separate reciprocal asymptotes',()=>{
  const graph=B.graph({expression:'x^2'}),curves=graph.filter(e=>e.type==='pencil');
  assert.equal(curves.length,1);
  for(const [px,py] of curves[0].points){const x=px/600*20-10,y=10-py/400*20;assert.ok(Math.abs(y-x*x)<1e-10);}
  const inverse=B.graph({expression:'1/x'}).filter(e=>e.type==='pencil');
  assert.equal(inverse.length,2);
  assert.ok(inverse.every(e=>e.points.every(p=>p[0]<300)||e.points.every(p=>p[0]>300)));
  assert.equal(B.graph({}).filter(e=>e.type==='pencil').length,0);
  assert.throws(()=>B.graph({step:1e-15}));assert.throws(()=>B.graph({xmin:10,xmax:1}));
});
test('rotation preserves hit detection, lasso bounds, export and saving',()=>{
  const e=B.sanitizeElement({type:'rectangle',x:0,y:0,w:100,h:20});
  const r=B.rotate(e,{x:50,y:10},Math.PI/2),b=B.bounds(r);
  assert.ok(Math.abs(b.w-20)<1e-8);assert.ok(Math.abs(b.h-100)<1e-8);
  assert.ok(B.hit(r,{x:50,y:50},0));assert.ok(!B.hit(r,{x:90,y:10},0));
  assert.ok(B.lassoContains(r,[{x:30,y:-50},{x:70,y:-50},{x:70,y:70},{x:30,y:70}]));
  assert.equal(B.parseScene({elements:[r]}).elements[0].angle,r.angle);
  assert.match(B.elementSvg(r),/rotate\(90 /);
});
test('pencil pressure survives resize, file round-trip and SVG output',()=>{
  const e=B.sanitizeElement({type:'pencil',penStyle:'pencil',points:[[0,0,.1],[10,10,.9]],strokeWidth:4});
  const r=B.resize(e,{x:0,y:0,w:10,h:10},{x:0,y:0,w:20,h:20});
  assert.equal(r.points[1][2],.9);assert.equal(B.parseScene({elements:[r]}).elements[0].penStyle,'pencil');
  assert.match(B.elementSvg(e),/data-pressure-ink="true"/);
  assert.doesNotMatch(B.elementSvg(e),/opacity="\.75"/);
});
test('smooth pen pressure changes ink width and graph curves remain constant width',()=>{
  assert.ok(B.pressureRadius(4,.9)>B.pressureRadius(4,.1)*2);
  const pen=B.sanitizeElement({type:'pencil',penStyle:'pen',points:[[0,0,.1],[10,0,.9]],strokeWidth:4});
  const svg=B.elementSvg(pen);assert.match(svg,/data-pressure-ink/);
  assert.doesNotMatch(B.elementSvg({...pen,plotCurve:true}),/data-pressure-ink/);
  assert.doesNotMatch(B.elementSvg({...pen,points:[[0,0],[10,0]]}),/data-pressure-ink/);
});

test('palette polygons and unit cells keep their outline when selected, rotated and reopened', () => {
  for (const preset of Object.values(B.shapes).filter(p => p.outline)) {
    const element = B.sanitizeElement({type:preset.type, x:80, y:60, w:-50*preset.aspect, h:-50});
    const bounds = B.bounds(element);
    const [x,y] = preset.outline[0];
    const p = {x:bounds.x+x*bounds.w, y:bounds.y+y*bounds.h};
    assert.ok(B.hit(element,p,0),preset.name);
    assert.ok(B.lassoContains(element,[
      {x:p.x-1,y:p.y-1},{x:p.x+1,y:p.y-1},{x:p.x+1,y:p.y+1},{x:p.x-1,y:p.y+1}
    ]),preset.name);
    assert.ok(!B.hit(element,{x:bounds.x-20,y:bounds.y-20},0),preset.name);
    const rotated = B.rotate(element,p,Math.PI/3);
    assert.ok(B.hit(rotated,p,0),preset.name);
    const [reopened] = B.parseScene(JSON.parse(JSON.stringify({elements:[rotated]}))).elements;
    assert.equal(B.elementSvg(reopened), B.elementSvg(rotated));
    if (preset.group==='3D shapes') {
      assert.equal(preset.outline.length,6);
      assert.equal(preset.hidden.length,3);
      assert.equal(preset.edges.length,3);
    }
  }
});

test('new handwriting smooths small deviations while preserving dots, reversals and raw samples', () => {
  const points = [[0,0,.2],[3,.6,.4],[6,0,.5],[9,.6,.4],[12,0,.2]];
  const pen = B.sanitizeElement({type:'pencil',points,strokeWidth:3});
  const smooth = B.sanitizeElement({...pen,smoothInk:true});
  assert.notEqual(B.elementSvg(smooth),B.elementSvg(pen));
  assert.deepEqual(smooth.points,points);
  const [reopened] = B.parseScene({elements:[smooth]}).elements;
  assert.equal(B.elementSvg(smooth),B.elementSvg(reopened));
  for (const samples of [[[0,0]],[[0,0],[4,0],[0,0]],[[0,0],[3,0],[6,0]]]) {
    assert.equal(B.elementSvg({...pen,points:samples}), B.elementSvg({...smooth,points:samples}));
  }
});
