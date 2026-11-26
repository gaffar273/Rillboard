const {test}=require('node:test'),assert=require('node:assert/strict');
const Board=require('../geometry.js'),Store=require('../teacher-store.js'),Core=require('../teacher-core.js');
const rect={id:'stable',type:'rectangle',x:10,y:20,w:40,h:50};
test('editable ids survive saving and reload; duplicate and unsafe ids are repaired',()=>{
  const parsed=Board.parseScene({elements:[rect,rect,{...rect,id:'" bad'}]});
  assert.equal(parsed.elements[0].id,'stable');assert.notEqual(parsed.elements[1].id,'stable');assert.match(parsed.elements[2].id,/^[a-zA-Z0-9_-]+$/);assert.equal(new Set(parsed.elements.map(e=>e.id)).size,3);
});
test('each board keeps an independent lesson position and handwriting mode',()=>{
  const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},store=new Store(storage);
  const lesson={title:'Live lesson',steps:[{caption:'Draw',actions:[{op:'add',element:rect}]}]};
  store.save('one',lesson,1,true,[rect]);store.save('two',{title:'Other',steps:[]},0,false,[]);
  const restored=new Store(storage);assert.equal(restored.read('one').index,1);assert.equal(restored.read('one').active,true);assert.equal(restored.read('two').lesson.title,'Other');assert.equal(restored.read('missing'),null);
});
test('student annotations are kept in the timeline before the next assistant step',()=>{
  const first={caption:'Draw',actions:[{op:'add',element:rect}]};
  const ink={id:'student',type:'pencil',x:80,y:90,points:[[0,0],[10,15],[20,10]]};
  const result=Core.compile({title:'Teaching',steps:[first,{caption:'Student notes',actions:[],snapshot:[rect,ink]},{caption:'Continue',actions:[{op:'update',id:'stable',changes:{stroke:'#1971c2'}}]}]});
  assert.equal(result.frames[1].length,1);assert.equal(result.frames[3].find(e=>e.id==='student').points.length,3);assert.equal(result.frames[3][0].stroke,'#1971c2');
});
test('failed lesson persistence does not claim success or erase the previous lesson',()=>{
  const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},store=new Store(storage);
  store.save('one',{title:'Saved',steps:[]},0,true,[]);storage.setItem=()=>{throw new Error('Quota exceeded');};
  assert.throws(()=>store.save('one',{title:'New',steps:[]},0,true,[]),/Quota/);assert.equal(store.read('one').lesson.title,'Saved');
});
