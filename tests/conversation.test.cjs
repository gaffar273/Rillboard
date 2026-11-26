const {test}=require('node:test'),assert=require('node:assert/strict');
const Workspace=require('../workspace-store.js'),Store=require('../teacher-store.js'),Core=require('../teacher-core.js');
const {handle,tools}=require('../teacher-bridge/server.cjs');
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
const scene={elements:[],background:'#ffffff'};
test('chat keys survive reopening and never follow the current board or duplicate',()=>{
  const memory=storage(),w=new Workspace(memory);w.create(scene,'A');const a=w.current().id;w.bindConversation('chat-a');
  w.create(scene,'B');const b=w.current().id;w.bindConversation('chat-b');
  const restored=new Workspace(memory);assert.equal(restored.conversation('chat-a').id,a);assert.equal(restored.conversation('chat-b').id,b);
  assert.throws(()=>restored.bindConversation('chat-a'),/already/);assert.equal(restored.current().id,b);
  restored.duplicate(a);assert.equal(restored.current().conversationId,undefined);assert.equal(restored.conversation('chat-a').id,a);
  assert.throws(()=>restored.bindConversation('bad key'),/Invalid/);
});
test('questions and responses persist independently with their saved lesson',()=>{
  const memory=storage(),s=new Store(memory),question={prompt:'Predict what changes.',hint:'Look at the arrow.'};
  const lesson=Core.compile({title:'Practice',steps:[{caption:'Your turn',actions:[],question}]}).lesson;
  s.save('a',lesson,1,true,[],1,{1:{answer:'It moves right.',submittedAt:'2026-11-14',hintUsed:true}});
  s.save('b',{title:'Other',steps:[]},0,false,[]);
  assert.deepEqual(new Store(memory).read('a').lesson.steps[0].question,question);
  assert.equal(new Store(memory).read('a').responses[1].answer,'It moves right.');assert.deepEqual(s.read('b').responses,{});
  assert.throws(()=>Core.compile({title:'Bad',steps:[{caption:'',actions:[],question:{prompt:''}}]}),/prompt/);
});
test('MCP never reads or mutates an arbitrary current board without chat identity',async()=>{
  const call=(name,args={})=>handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}});
  const read=await call('teacher_read');assert.equal(JSON.parse(read.result.content[0].text).needsConversation,true);
  for(const name of ['teacher_step','teacher_control','teacher_snapshot']){
    assert.ok(tools.find(t=>t.name===name).inputSchema.required.includes('conversationId'));
    assert.equal((await call(name)).result.isError,true);
  }
});
