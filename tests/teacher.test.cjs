const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {compile,apply}=require('../teacher-core.js');
const {handle}=require('../teacher-bridge/server.cjs');
const box={id:'box',type:'rectangle',x:10,y:20,w:100,h:80};
test('steps keep stable ids, update and remove without mutating earlier frames',()=>{
  const input={title:'Test',steps:[{caption:'Add',actions:[{op:'add',element:box}]},{caption:'Change',actions:[{op:'update',id:'box',changes:{x:90}}]},{caption:'Remove',actions:[{op:'remove',id:'box'}]}]};
  const {frames}=compile(input);assert.equal(frames[1][0].id,'box');assert.equal(frames[1][0].x,10);assert.equal(frames[2][0].x,90);assert.deepEqual(frames[3],[]);assert.equal(input.steps[0].actions[0].element.x,10);
});
test('invalid step is atomic and rejects missing ids, duplicate ids, unsafe ids and nonfinite geometry',()=>{
  const previous=apply([],[{op:'add',element:box}]);
  assert.throws(()=>apply(previous,[{op:'update',id:'box',changes:{x:90}},{op:'remove',id:'missing'}]));assert.equal(previous[0].x,10);
  assert.throws(()=>apply(previous,[{op:'add',element:box}]));
  assert.throws(()=>apply([],[{op:'add',element:{...box,id:'" onload="x'}}]));
  assert.throws(()=>apply([],[{op:'add',element:{...box,x:Infinity}}]));
  assert.throws(()=>compile({title:'Bad',steps:[{caption:'bad',actions:[],focus:['missing']}]}));
});
test('fractions demo compiles and includes six progressively drawn steps',()=>{
  const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('./fixtures/fractions.js'),'utf8'),context);
  const {frames}=compile(context.window.TeacherDemo);assert.equal(frames.length,7);assert.equal(frames[3].find(e=>e.id==='half-label').text,'²⁄₄');assert.match(frames[5].find(e=>e.id==='answer').text,/¾/);
});
test('MCP initializes, lists real drawing tools, and rejects unknown methods',async()=>{
  const call=(method,params)=>handle({jsonrpc:'2.0',id:1,method,params});
  assert.equal((await call('initialize',{protocolVersion:'2025-06-18'})).result.protocolVersion,'2025-06-18');
  assert.equal((await call('tools/list')).result.tools.length,5);
  assert.equal((await call('tools/call',{name:'execute_script'})).error.code,-32602);
  assert.equal((await call('arbitrary')).error.code,-32601);
  assert.equal(await handle({jsonrpc:'2.0',method:'notifications/initialized'}),null);
});
