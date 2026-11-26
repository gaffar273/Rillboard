'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const {request}=require('../teacher-bridge/client.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const root=path.join(__dirname,'teacher-check',String(Date.now()));await fs.mkdir(root,{recursive:true});
  const profile=path.join(root,'profile'),directory=path.join(profile,'TeacherBridge');
  const settings=path.join(profile,'DrawingStorage');
  await fs.mkdir(settings,{recursive:true});
  const key=require('node:crypto').createHash('sha256').update('rillboard-plugin-teaching').digest('hex').toUpperCase();
  await fs.writeFile(path.join(settings,key+'.json'),'on');
  const exe=path.join(__dirname,'..','dist','Rillboard.exe');
  let child;
  async function open(){child=spawn(exe,['--data-dir',profile],{windowsHide:true,stdio:'ignore'});child.on('error',e=>{throw e;});for(let i=0;i<100;i++){await delay(150);try{const data=JSON.parse(await fs.readFile(path.join(directory,'session.json'),'utf8'));if(data.pid===child.pid)return;}catch{}}throw new Error('App launch timed out.');}
  async function close(){if(!child)return;execFileSync('powershell.exe',['-NoProfile','-Command',`(Get-Process -Id ${child.pid}).CloseMainWindow() | Out-Null`],{windowsHide:true});for(let i=0;i<50&&child.exitCode===null;i++)await delay(100);if(child.exitCode===null)child.kill();child=null;}
  const send=(method,params={})=>request(method,params,{directory,open:false});
  const checks=[];
  try{
    await open();
    assert.equal((await send('teacher_read')).board.elements.length,0);
    await send('teacher_start',{title:'Preserved lesson',steps:[]});
    await send('teacher_step',{caption:'Keep this board.',actions:[{op:'add',element:{id:'keep',type:'text',x:70,y:80,text:'Original work',fontSize:32}}]});
    await delay(450);
    const context={window:{}};vm.runInNewContext(await fs.readFile(path.join(__dirname,'../tests/fixtures/fractions.js'),'utf8'),context);
    const started=await send('teacher_start',context.window.TeacherDemo);assert.equal(started.totalSteps,6);assert.equal(started.step,0);assert.ok((await send('teacher_read')).board.boards.some(b=>b.name==='Preserved lesson'));checks.push('New lessons start paused on separate boards; previous board remains available');
    await send('teacher_control',{command:'next'});assert.equal((await send('teacher_read')).board.elements.length,2);
    await send('teacher_control',{command:'next'});const before=await send('teacher_read');
    await assert.rejects(()=>send('teacher_step',{caption:'Invalid',actions:[{op:'remove',id:'missing'}]}),/not found/);
    assert.deepEqual((await send('teacher_read')).board,before.board);checks.push('Invalid steps do not change the board');
    await send('teacher_control',{command:'back'});assert.equal((await send('teacher_read')).step,1);
    await send('teacher_control',{command:'play'});assert.equal((await send('teacher_read')).playing,true);
    await send('teacher_control',{command:'pause'});assert.equal((await send('teacher_read')).playing,false);checks.push('Playback, pause and previous step work');
    for(let i=0;i<5;i++)await send('teacher_control',{command:'next'});
    await delay(1200);
    const final=await send('teacher_read');assert.equal(final.step,6);assert.ok(final.board.elements.some(e=>e.id==='answer'&&e.text.includes('¾')));
    const snap=await send('teacher_snapshot');assert.ok(Buffer.from(snap.data,'base64').subarray(1,4).equals(Buffer.from('PNG')));await fs.writeFile(path.join(root,'lesson.png'),Buffer.from(snap.data,'base64'));checks.push('Actual WebView2 screenshot and all six teaching steps verified');
    await send('teacher_step',{caption:'Live correction',actions:[{op:'update',id:'practice',changes:{text:'½ + ⅛ = ⅝'}}]});assert.equal((await send('teacher_read')).board.elements.find(e=>e.id==='practice').text,'½ + ⅛ = ⅝');checks.push('Live tool commands update editable elements by id');
    await delay(450);
    await close();await open();const restored=await send('teacher_read');assert.ok(restored.board.elements.some(e=>e.id==='practice'&&e.text==='½ + ⅛ = ⅝'));assert.equal(restored.active,true);assert.equal(restored.step,7);checks.push('Editable ids, active lesson and complete timeline persist through close/reopen');
    await send('teacher_step',{caption:'Continued after reopening',actions:[{op:'update',id:'practice',changes:{stroke:'#1971c2'}}]});assert.equal((await send('teacher_read')).step,8);
    await send('teacher_control',{command:'detach'});assert.equal((await send('teacher_read')).active,false);checks.push('Real teaching continues after reopening and can hand off to student');
    // Exercise the actual stdio transport against this native window.
    const server=spawn(process.execPath,[path.join(__dirname,'../teacher-bridge/server.cjs')],{env:{...process.env,TEACHER_BRIDGE_DIR:directory},stdio:['pipe','pipe','pipe'],windowsHide:true});
    const replies=[];let buffer='';server.stdout.on('data',chunk=>{buffer+=chunk;const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines)if(line)replies.push(JSON.parse(line));});
    server.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}})+'\n');
    server.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'teacher_read',arguments:{}}})+'\n');
    for(let i=0;i<100&&replies.length<2;i++)await delay(100);server.stdin.end();
    assert.equal(replies.length,2);assert.equal(replies[1].result.isError,undefined);assert.match(replies[1].result.content[0].text,/⅝/);assert.equal(JSON.parse(replies[1].result.content[0].text).lastCommand.source,'mcp');checks.push('MCP stdio initialize, native tool call and truthful connection activity pass');
    await send('teacher_start',{title:'Six-section persistence check',steps:[]});
    let previousIds=[],firstZoom;
    for(let n=1;n<=6;n++){
      const items=[0,1,2].map(i=>({id:'section'+n+'_'+i,type:'text',x:60,y:60+i*180,text:'Section '+n+' line '+i,fontSize:28}));
      await send('teacher_step',{caption:'Section '+n,actions:[...previousIds.map(id=>({op:'remove',id})),...items.map(element=>({op:'add',element}))]});
      previousIds=items.map(e=>e.id);
      const state=await send('teacher_read');if(n===1)firstZoom=state.board.view.zoom;
      assert.equal(state.board.elements.length,n*3);assert.equal(state.board.view.zoom,firstZoom);
    }
    await send('teacher_control',{command:'back'});await send('teacher_control',{command:'restart'});
    const scrollBefore=await send('teacher_read');assert.equal(scrollBefore.board.elements.length,18);
    await close();await open();const scrollRestored=await send('teacher_read');
    assert.deepEqual(scrollRestored.board.elements,scrollBefore.board.elements);assert.equal(scrollRestored.step,0);
    assert.equal(scrollRestored.layout,'continuous-scroll');assert.ok(scrollRestored.nextY>3000);
    await send('teacher_step',{caption:'Continue below all six sections',actions:[{op:'add',element:{id:'seventh',type:'text',x:60,y:scrollRestored.nextY,text:'Continued after reopening',fontSize:28}}]});
    const continued=await send('teacher_read');assert.equal(continued.board.elements.length,19);assert.equal(continued.board.view.zoom,firstZoom);assert.ok(Math.abs(continued.board.view.y+scrollRestored.nextY*firstZoom-110)<2);
    await delay(1800);const scrollShot=await send('teacher_snapshot');await fs.writeFile(path.join(root,'continuous-scroll.png'),Buffer.from(scrollShot.data,'base64'));
    checks.push('Six old-style page clears preserve all writing, readable scale, review, restart, close/reopen and continuation below saved work');
    await fs.writeFile(path.join(root,'result.json'),JSON.stringify({success:true,checks},null,2));console.log(JSON.stringify({root,checks},null,2));
  }finally{await close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
