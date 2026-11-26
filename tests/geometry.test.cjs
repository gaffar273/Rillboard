const { test } = require('node:test');
const assert = require('node:assert/strict');
const B = require('../geometry.js');
const shape = (extra = {}) => B.sanitizeElement({ type:'rectangle', x:20, y:30, w:100, h:80, ...extra });

test('dragging in any direction produces correct shape bounds and hit areas', () => {
  const e = shape({ x:120, y:110, w:-100, h:-80 });
  assert.deepEqual(B.bounds(e), {x:20,y:30,w:100,h:80});
  assert.equal(B.hit(e,{x:50,y:50}),true);
  assert.equal(B.hit(e,{x:200,y:50}),false);
});

test('arrows and freehand strokes select near the line, not the bounding rectangle', () => {
  const line=shape({type:'arrow',x:0,y:0,w:100,h:100});
  assert.equal(B.hit(line,{x:50,y:51},3),true);
  assert.equal(B.hit(line,{x:20,y:80},3),false);
  const pencil=shape({type:'pencil',x:10,y:20,points:[[0,0],[20,20],[60,0]]});
  assert.deepEqual(B.bounds(pencil),{x:10,y:20,w:60,h:20});
  assert.equal(B.hit(pencil,{x:20,y:30},2),true);
  assert.equal(B.hit(pencil,{x:20,y:100},2),false);
});

test('ellipse and diamond ignore empty corners', () => {
  for (const type of ['ellipse','diamond']) {
    const e=shape({type,x:0,y:0,w:100,h:100});
    assert.equal(B.hit(e,{x:50,y:50},0),true);
    assert.equal(B.hit(e,{x:2,y:2},0),false);
  }
});

test('resizing multiple items preserves their relative positions and freehand points', () => {
  const a=shape({x:0,y:0,w:50,h:50});
  const b=shape({type:'pencil',x:100,y:100,points:[[0,0],[50,50]]});
  const from=B.union([a,b]),to={x:20,y:30,w:300,h:300};
  const resizedA=B.resize(a,from,to),resizedB=B.resize(b,from,to);
  assert.deepEqual(B.bounds(resizedA),{x:20,y:30,w:100,h:100});
  assert.deepEqual(B.bounds(resizedB),{x:220,y:230,w:100,h:100});
  assert.deepEqual(b.points,[[0,0],[50,50]],'original undo state remains unchanged');
});

test('editable files round-trip all supported shapes without losing strokes or text', () => {
  const elements=[shape(),shape({type:'text',text:'Hello <world>\nLine 2',fontSize:36}),shape({type:'pencil',points:[[0,0],[20,5],[100,30]]}),shape({type:'arrow',w:-20,h:60})];
  const roundTrip=B.parseScene(JSON.parse(JSON.stringify({elements,background:'#fffce8'})));
  assert.equal(roundTrip.background,'#fffce8');
  assert.equal(roundTrip.elements.length,4);
  assert.equal(roundTrip.elements[1].text,'Hello <world>\nLine 2');
  assert.deepEqual(roundTrip.elements[2].points,elements[2].points);
  assert.equal(roundTrip.elements[3].w,-20);
});

test('basic Excalidraw files import visible text, arrow points, and freehand strokes', () => {
  const data={appState:{viewBackgroundColor:'#f8f9fa'},elements:[{type:'rectangle',x:10,y:10,width:150,height:70,strokeColor:'#1971c2',backgroundColor:'#a5d8ff',strokeStyle:'dashed',isDeleted:false},{type:'arrow',x:10,y:20,points:[[0,0],[90,-50]]},{type:'freedraw',x:0,y:0,points:[[0,0],[10,30]]},{type:'text',text:'Idea',fontSize:28},{type:'rectangle',isDeleted:true}]};
  const parsed=B.parseScene(data);
  assert.equal(parsed.elements.length,4);
  assert.equal(parsed.elements[0].w,150);
  assert.equal(parsed.elements[0].stroke,'#1971c2');
  assert.equal(parsed.elements[0].dash,'dashed');
  assert.equal(parsed.elements[1].w,90);
  assert.equal(parsed.elements[1].h,-50);
  assert.equal(parsed.elements[2].type,'pencil');
  assert.equal(parsed.background,'#f8f9fa');
});

test('invalid drawing data is rejected without trusting injected attributes or URLs', () => {
  assert.throws(()=>B.parseScene({}),/not a drawing/);
  assert.throws(()=>B.parseScene({elements:[{type:'iframe',src:'https://example.com'}]}),/supported/);
  assert.throws(()=>B.parseScene({elements:Array(2001).fill({type:'rectangle'})}),/too many/);
  assert.equal(B.sanitizeElement({type:'image',src:'javascript:alert(1)'}),null);
  assert.equal(B.sanitizeElement({type:'image',src:'data:image/svg+xml;base64,AAAA'}),null);
  const e=shape({id:'" onload="alert(1)',stroke:'red" onload="x',fill:'url(https://example.com)'});
  assert.match(e.id,/^s[a-z0-9]+$/);
  assert.equal(e.stroke,'#1e1e1e');
  assert.equal(e.fill,'transparent');
  assert.deepEqual(B.parseScene({elements:[null]}).elements,[]);
});

test('SVG export escapes user text, includes all content bounds, and supports transparency', () => {
  const elements=[shape({x:-200,y:-80,w:100,h:80}),shape({type:'text',text:'<script>alert("x")</script> & me',x:100,y:100})];
  const svg=B.svgDocument(elements,'#ffffff',true);
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(!svg.includes('<script>'));
  assert.match(svg,/viewBox="-232 -112 464 324"/);
  assert.match(svg,/fill="#ffffff"/);
  assert.ok(!B.svgDocument(elements,'#ffffff',false).includes('fill="#ffffff"'));
});

test('dark canvas keeps default strokes visible without changing saved drawing colors', () => {
  const e=shape();
  assert.equal(B.visibleElement(e,'#121212').stroke,'#e8e7ef');
  assert.equal(B.visibleElement(e,'#ffffff').stroke,'#1e1e1e');
  assert.equal(e.stroke,'#1e1e1e');
  assert.match(B.svgDocument([e],'#121212'),/stroke="#e8e7ef"/);
});

test('empty exports have a finite usable viewBox and every tool produces valid numeric output', () => {
  assert.match(B.svgDocument([],'#ffffff'),/viewBox="-32 -32 864 564"/);
  for(const type of ['rectangle','diamond','ellipse','arrow','line','text','pencil']){
    const e=shape({type,points:[[0,0],[4,8]],x:Infinity,w:NaN,text:'test'});
    const svg=B.elementSvg(e);
    assert.ok(!/NaN|Infinity|undefined/.test(svg),type);
  }
});
