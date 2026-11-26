const test=require('node:test'),assert=require('node:assert/strict');
const B=require('../geometry.js'),pdf=require('../board-pdf.js');

test('a swept brush splits sparse ink and interpolates its pressure',()=>{
  const ink=B.sanitizeElement({id:'ink',type:'pencil',points:[[0,0,.1],[100,0,.9]],strokeWidth:2});
  const [left,right]=B.eraseStroke(ink,{x:50,y:-20},{x:50,y:20},4);
  assert.equal(left.id,ink.id);assert.notEqual(right.id,ink.id);
  assert.equal(left.points.at(-1)[0],45);assert.ok(Math.abs(right.x-55)<1e-9);
  assert.ok(Math.abs(right.points[0][2]-.54)<1e-9);
  assert.equal(B.eraseStroke(ink,{x:1010,y:0},{x:1012,y:3},4)[0],ink);
});
test('rotated lines keep their visible endpoints and dots can be fully erased',()=>{
  const line=B.sanitizeElement({type:'line',x:0,y:0,w:100,h:0,angle:Math.PI/2,strokeWidth:2});
  const [top,bottom]=B.eraseStroke(line,{x:50,y:0},{x:50,y:0},4);
  assert.equal(top.y,-50);assert.equal(top.h,45);assert.ok(Math.abs(bottom.y-5)<1e-8);
  const dot=B.sanitizeElement({type:'pencil',points:[[0,0,.3]]});
  assert.deepEqual(B.eraseStroke(dot,{x:-10,y:0},{x:10,y:0},2),[]);
});
test('formatted text survives scene import and shares its typeface across rendering paths',()=>{
  const [t]=B.parseScene({elements:[{type:'text',text:'Type',fontFace:'mono',bold:true,italic:true,underline:true}]}).elements;
  assert.match(B.textFont(t),/italic bold .*Consolas/);
  assert.match(B.elementSvg(t),/font-weight="bold" font-style="italic" text-decoration="underline"/);
  assert.match(B.textFont(B.sanitizeElement({type:'text',fontFace:'unknown'})),/Segoe Print/);
});
test('paper proportions, margins, negative origins and selected page ranges',()=>{
  const items=[B.sanitizeElement({type:'line',x:-500,y:-1700,w:300,h:1370})];
  const p=pdf.layout(items,'A4',false,12);
  assert.deepEqual([p.w,p.h,p.margin],[210,297,12]);assert.ok(p.x<-500&&p.y<-1700);
  assert.ok(Math.abs(p.height/p.width-273/186)<1e-10);assert.equal(p.count,4);
  assert.ok(pdf.layout(items,'A4',true,12).count>p.count);
  assert.deepEqual(pdf.pageNumbers('3–4, 1, 3',4),[1,3,4]);
  for(const range of ['0','5','2-1','a','1,'])assert.throws(()=>pdf.pageNumbers(range,4));
});
