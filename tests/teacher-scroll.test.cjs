const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../teacher-core.js');
const page=n=>[0,1,2].map(i=>({id:'p'+n+'_'+i,type:'text',x:50,y:50+i*200,text:'Section '+n+' line '+i,fontSize:28}));
test('six replacement-style pages become one continuous board; serialization is stable',()=>{
  const steps=[];
  for(let n=1;n<=6;n++)steps.push({caption:'Section '+n,actions:[...(n>1?page(n-1).map(e=>({op:'remove',id:e.id})):[]),...page(n).map(element=>({op:'add',element}))]});
  const result=Core.compile({title:'Six sections',steps});
  assert.equal(result.frames[6].length,18);
  for(let n=2;n<=6;n++)assert.ok(result.frames[6].find(e=>e.id==='p'+n+'_0').y>Core.bottom(result.frames[n-1]));
  assert.deepEqual(Core.compile(JSON.parse(JSON.stringify(result.lesson))),result);
  assert.equal(steps[1].actions[3].element.y,50,'input remains untouched');
});
test('page breaks preserve existing content, reused ids and subsequent corrections',()=>{
  const result=Core.compile({title:'Reused ids',steps:[
    {caption:'First',actions:page(1).map(element=>({op:'add',element}))},
    {caption:'Next',actions:[...page(1).map(e=>({op:'remove',id:e.id})),...page(1).map(element=>({op:'add',element:{...element,text:'New'}}))]},
    {caption:'Correct',actions:[{op:'update',id:'p1_0',changes:{text:'Corrected',y:80}}]},
    {caption:'Third',pageBreak:true,actions:[{op:'add',element:{...page(3)[0],id:'third'}}]}
  ]});
  assert.equal(result.frames[4].length,7);
  assert.equal(result.frames[4].find(e=>e.id==='p1_0').text,'Corrected');
  assert.ok(result.frames[4].find(e=>e.id.startsWith('saved_')).y<100);
  assert.ok(result.frames[4].find(e=>e.id==='p1_0').y>500);
  assert.ok(result.frames[4].find(e=>e.id==='third').y>Core.bottom(result.frames[3]));
});
test('absolute downward coordinates and small corrections are retained',()=>{
  const result=Core.compile({title:'Append',steps:[
    {caption:'First',actions:page(1).map(element=>({op:'add',element}))},
    {caption:'Second',actions:[{op:'add',element:{...page(2)[0],y:1200}}]},
    {caption:'Remove error',actions:[{op:'remove',id:'p1_1'}]}
  ]});
  assert.equal(result.frames[3].find(e=>e.id==='p2_0').y,1200);
  assert.equal(result.frames[3].length,3);
});
