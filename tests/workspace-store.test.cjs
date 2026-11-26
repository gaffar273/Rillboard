const {test} = require('node:test');
const assert = require('node:assert/strict');
const Store = require('../workspace-store.js');
function setup() {
  const values = new Map();
  const storage = {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  return {storage,store:new Store(storage)};
}
const scene = (text='original') => ({elements:[{type:'text',text,x:0,y:0}],background:'#ffffff',name:'Notes',view:{x:15,y:30,zoom:1.2}});
test('boards remain separate and the active board survives reopening',()=>{
  const {storage,store}=setup();store.create(scene(),'First');const first=store.current().id;
  store.create(scene('second'),'Second');const second=store.current().id;
  const reopened=new Store(storage);assert.equal(reopened.current().id,second);
  assert.equal(reopened.open(first).elements[0].text,'original');
  assert.equal(reopened.open(second).elements[0].text,'second');
  assert.deepEqual(reopened.read().scene.view,{x:15,y:30,zoom:1.2});
});
test('renaming and folders persist and search matches both names and folders',()=>{
  const {storage,store}=setup();store.create(scene(),'First');
  store.organize('Design ideas','Work');store.create(scene(),'Weekend','Home');
  const reopened=new Store(storage);
  assert.equal(reopened.list('DESIGN')[0].name,'Design ideas');
  assert.equal(reopened.list('work')[0].folder,'Work');
  assert.deepEqual(reopened.list('','Home').map(b=>b.name),['Weekend']);
  assert.equal(reopened.list('missing').length,0);
});
test('duplicating a board preserves the original and creates an independent editable copy',()=>{
  const {store}=setup();store.create(scene(),'First','Projects');const first=store.current().id;
  const copy=store.duplicate(first);copy.elements[0].text='changed';store.save(copy);
  assert.equal(store.current().folder,'Projects');assert.equal(store.current().name,'First (copy)');
  assert.equal(store.open(first).elements[0].text,'original');assert.equal(store.list().length,2);
});
test('restoring a version preserves current work as a recoverable version',()=>{
  const {storage,store}=setup();store.create(scene(),'Notes');store.checkpoint(scene());
  store.save(scene('new work'));store.restore(0,scene('new work'));
  assert.equal(store.read().scene.elements[0].text,'original');
  const reopened=new Store(storage);
  assert(reopened.history().some(v=>v.scene.elements[0].text==='new work'));
  const newer=reopened.history().findIndex(v=>v.scene.elements[0].text==='new work');
  reopened.restore(newer,reopened.read().scene);
  assert.equal(reopened.read().scene.elements[0].text,'new work');
});
test('history keeps twenty recent versions and repeated saves do not make duplicates',()=>{
  const {store}=setup();store.create(scene(),'Notes');
  for(let i=0;i<28;i++)store.checkpoint(scene('edit '+i));
  assert.equal(store.history().length,20);
  const count=store.history().length;store.checkpoint(scene('edit 27'));
  assert.equal(store.history().length,count);
  assert.equal(store.history()[0].scene.elements[0].text,'edit 27');
});
test('storage exhaustion does not switch away from the current board or corrupt it',()=>{
  const {storage,store}=setup();store.create(scene(),'First');const first=store.current().id;
  const set=storage.setItem;storage.setItem=()=>{throw new Error('Quota exceeded');};
  assert.throws(()=>store.create(scene('new'),'Second'),/Quota/);
  assert.equal(store.current().id,first);assert.equal(store.read().scene.elements[0].text,'original');
  storage.setItem=set;assert.equal(new Store(storage).list().length,1);
});
test('missing boards are rejected without changing the active board',()=>{
  const {store}=setup();store.create(scene(),'First');const first=store.current().id;
  assert.throws(()=>store.open('missing'),/not found/);assert.equal(store.current().id,first);
});
test('reloading with new element IDs and normalized property order does not consume history',()=>{
  const {store}=setup();
  const initial={elements:[{id:'s1',type:'rectangle',x:1,y:2,w:100,h:50}],background:'#ffffff',name:'Notes'};
  store.create(initial,'Notes');store.checkpoint(initial);
  const reloaded={...initial,elements:[{h:50,w:100,y:2,x:1,type:'rectangle',id:'s2',text:''}]};
  store.save(reloaded,true);store.checkpoint(reloaded);
  assert.equal(store.history().length,1);
});

test('native autosave keeps legacy history readable and leaves archived scenes off the hot path',()=>{
  const {store,storage}=setup();
  store.create(scene(),'Notes');
  for(let i=0;i<21;i++)store.checkpoint(scene('version '+i));
  const expected=store.history();
  storage.separateHistory=true;
  store.save(store.readScene());
  assert.deepEqual(new Store(storage).history(),expected);
  const get=storage.getItem,set=storage.setItem,access=[];
  storage.getItem=key=>{access.push(key);return get(key);};
  storage.setItem=(key,value)=>{access.push(key);set(key,value);};
  assert.deepEqual(store.historySummaries(),expected.map(v=>({at:v.at,count:v.scene.elements.length,name:v.scene.name})));
  store.save(scene('next stroke'));
  assert.ok(access.every(key=>!key.includes(':history:')));
  const key=store.key(store.current().id);
  storage.setItem=(k,value)=>{if(k===key)throw Error('Disk full');set(k,value);};
  assert.throws(()=>store.save(scene('next edit'),true),/Disk full/);
  assert.deepEqual(new Store(storage).history(),expected);
  assert.deepEqual(store.readScene(),scene('next stroke'));
  storage.setItem=set;
  store.save(scene('next edit'),true);
  assert.deepEqual(store.history()[0].scene,scene('next stroke'));
  assert.equal(store.history().length,20);
});
