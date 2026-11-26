'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {request}=require('../teacher-bridge/client.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const root=path.join(__dirname,'bridge-check',String(Date.now())),profile=path.join(root,'profile'),directory=path.join(profile,'TeacherBridge');
  await fs.mkdir(root,{recursive:true});
  const settings=path.join(profile,'DrawingStorage');
  await fs.mkdir(settings,{recursive:true});
  const key=require('node:crypto').createHash('sha256').update('rillboard-plugin-teaching').digest('hex').toUpperCase();
  await fs.writeFile(path.join(settings,key+'.json'),'on');
  const app=spawn(path.join(__dirname,'../dist/Rillboard.exe'),['--data-dir',profile],{windowsHide:true,stdio:'ignore'});
  let server;
  try{
    for(let n=0;n<100;n++){try{const s=JSON.parse(await fs.readFile(path.join(directory,'session.json'),'utf8'));if(s.pid===app.pid)break;}catch{}await delay(100);}
    server=spawn(process.execPath,[path.join(__dirname,'../teacher-bridge/server.cjs')],{env:{...process.env,TEACHER_BRIDGE_DIR:directory},windowsHide:true,stdio:['pipe','pipe','pipe']});
    const pending=new Map();let buffer='',sequence=0;
    server.stdout.on('data',data=>{buffer+=data;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);const reply=JSON.parse(line),p=pending.get(reply.id);if(p){clearTimeout(p.timer);pending.delete(reply.id);p.resolve(reply);}}});
    function rpc(method,params){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,timer:setTimeout(()=>{pending.delete(id);reject(Error('MCP timed out: '+method));},25000)});server.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});}
    async function call(name,args={}){const r=await rpc('tools/call',{name,arguments:args});if(r.error||r.result.isError)throw Error(JSON.stringify(r));return r.result.content;}
    const read=async id=>JSON.parse((await call('teacher_read',{conversationId:id}))[0].text);
    await rpc('initialize',{protocolVersion:'2025-06-18',clientInfo:{name:'isolated QA'}});
    assert.equal(JSON.parse((await call('teacher_read'))[0].text).needsConversation,true);
    const first=JSON.parse((await call('teacher_start',{title:'Bridge A',steps:[]}))[0].text),a=first.conversationId;
    assert.ok(a);await call('teacher_step',{conversationId:a,caption:'Saved A',actions:[{op:'add',element:{id:'a',type:'text',x:50,y:50,text:'Bridge A',fontSize:28}}]});
    const second=JSON.parse((await call('teacher_start',{title:'Bridge B',steps:[]}))[0].text),b=second.conversationId;assert.notEqual(a,b);
    await call('teacher_step',{conversationId:b,caption:'Saved B',actions:[]});
    assert.equal((await read(a)).board.elements[0].id,'a');
    assert.equal((await read(b)).board.elements.length,0);
    // Snapshot routing is atomic inside the native host, not a separate read/capture pair.
    const snap=(await call('teacher_snapshot',{conversationId:a}))[0];assert.equal(snap.type,'image');
    await fs.writeFile(path.join(root,'scoped-snapshot.png'),Buffer.from(snap.data,'base64'));
    assert.equal((await request('teacher_read',{}, {directory,open:false})).boardId,first.boardId);
    await assert.rejects(()=>call('teacher_step',{caption:'No identity',actions:[]}),/conversationId/);
    const resume=JSON.parse((await call('teacher_start',{title:'Resume A',conversationId:a,steps:[]}))[0].text);
    assert.equal(resume.boardId,first.boardId);assert.equal(resume.resumed,true);assert.equal(resume.board.elements.length,1);
    const notes=['A change in position over time is velocity.','A cyclist covers 30 m in 6 s. Average speed = 5 m/s.'];
    const compact={conversationId:a,notes};
    await call('teacher_step',compact);
    const written=await read(a),blocks=written.board.elements.slice(-2);
    assert.equal(blocks[0].text.replace(/\s+/g,' '),notes[0]);
    assert.ok(blocks[0].y>50);
    if(written.writingWidth>=720){
      assert.equal(blocks[0].y,blocks[1].y);
      assert.ok(blocks[1].x>written.writingWidth/2);
      assert.ok(blocks[0].x+blocks[0].w<blocks[1].x);
      assert.ok(blocks[1].x+blocks[1].w<=written.writingWidth+8);
    }else assert.ok(blocks[1].y>blocks[0].y);
    const full=JSON.parse((await call('teacher_read',{conversationId:a,detail:'full'}))[0].text);
    assert.ok(full.board.elements[1].fontSize);
    assert.ok(!written.board.elements[1].fontSize);
    assert.ok(!full.board.boards);
    const screenshot=(await call('teacher_snapshot',{conversationId:a}))[0];
    await fs.writeFile(path.join(root,'notes.png'),Buffer.from(screenshot.data,'base64'));
    await assert.rejects(()=>call('teacher_read',{conversationId:'does-not-exist'}),/No board linked/);
    console.log('Compact request bytes:',Buffer.byteLength(JSON.stringify(compact)),'explicit equivalent:',Buffer.byteLength(JSON.stringify({conversationId:a,caption:'',actions:blocks.map(element=>({op:'add',element}))})));
    await fs.writeFile(path.join(root,'result.json'),JSON.stringify({success:true,checks:['real MCP stdio','generated unique chat keys','cross-chat reads','atomic scoped snapshot','missing identity rejected','idempotent resume']},null,2));
    console.log('PASS: MCP conversation routing and native snapshots. '+root);
  }finally{server?.kill();app.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
