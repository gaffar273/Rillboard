window.installGPTTeaching = function () {
  'use strict';
  const listeners=new AbortController();
  const B=window.Board,board=window.TeachingBoard,core=window.TeacherCore,$=s=>document.querySelector(s);
  document.body.insertAdjacentHTML('beforeend',`<button id="teacher-toggle" aria-expanded="false" aria-controls="teacher-panel">✦ Teaching</button>
    <aside id="teacher-panel" aria-label="Teaching add-on" hidden>
      <div class="teacher-heading"><h2 id="teacher-title">Live teaching</h2><button id="teacher-close" aria-label="Close teaching controls">×</button></div>
      <p id="teacher-connection" role="status">Waiting for a teaching connection</p>
      <p id="teacher-status">No lesson in progress</p><progress id="teacher-progress" max="1" value="0" aria-label="Lesson progress"></progress>
      <p>Ask your connected assistant when you want a lesson. You can always draw and save boards on your own.</p>
      <div id="teacher-error" role="alert"></div>
      <div class="teacher-controls"><button id="teacher-prev" title="Previous step">Back</button><button id="teacher-play" class="primary">Play</button><button id="teacher-next" title="Next step">Next</button></div>
      <div class="teacher-settings"><label><input id="teacher-voice" type="checkbox">Read aloud</label><select id="teacher-speed" aria-label="Playback speed"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></div>
      <div class="teacher-secondary"><button id="teacher-restart">Restart</button><button id="teacher-edit">Keep drawing</button></div>
      <div class="teacher-secondary"><button id="teacher-chat" class="primary">Ask in ChatGPT</button><button id="teacher-receive" aria-pressed="true">Pause live drawing</button></div>
      <details id="teacher-options"><summary>Lesson files</summary><div class="teacher-secondary"><button id="teacher-import">Open lesson</button><button id="teacher-export">Save lesson</button></div></details><input id="teacher-file" type="file" accept=".json" hidden>
    </aside><section id="teacher-dock" aria-label="Current explanation" hidden><div class="teacher-heading"><span class="teacher-kicker">Lesson notes</span><button id="teacher-notes-close" aria-label="Hide lesson notes">×</button></div><p id="teacher-caption" aria-live="polite"></p>
      <form id="teacher-practice" hidden><label id="teacher-question" for="teacher-answer"></label><div class="teacher-answer-row"><input id="teacher-answer" maxlength="2000" placeholder="Your answer or prediction" autocomplete="off"><button type="submit">Save answer</button><button type="button" id="teacher-hint-button">Hint</button><button type="button" id="teacher-draw-answer">Draw it</button></div><p id="teacher-hint" hidden></p><p id="teacher-answer-status" role="status"></p></form>
    </section><div id="teacher-scroll" role="scrollbar" aria-label="Position in board" aria-controls="canvas" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0" hidden><div></div></div><span id="teacher-scroll-thumb" class="board-scroll-thumb" hidden></span>
    <nav id="teacher-navigation" hidden aria-label="Lesson scrolling"><button id="teacher-up">↑ Earlier</button><button id="teacher-down">↓ Later</button><button id="teacher-latest">Latest writing</button><button id="teacher-notes" aria-expanded="true">Notes</button></nav>`);
  document.querySelector('.top-right').prepend(document.querySelector('#teacher-toggle'));
  const layer=document.createElementNS('http://www.w3.org/2000/svg','g');layer.id='teacher-overlay';$('#canvas').appendChild(layer);
  let compiled=null,index=0,revealed=0,playing=false,timer=null,active=false,animations=[],boardId=null;
  let lastCommand=null,storageError='',acceptingCommands=true;
  let responses={},notesVisible=true,practiceStep=0;
  const store=new window.TeacherStore(window.DrawingStorage),fingerprint=window.TeacherStore.fingerprint;
  let textReveals=[];
  const panel=$('#teacher-panel');
  function setPanel(open){panel.hidden=!open;$('#teacher-toggle').setAttribute('aria-expanded',String(open));}
  function canvasArea(){return {left:24,right:panel.hidden?32:Math.max(32,$('#canvas').getBoundingClientRect().right-panel.getBoundingClientRect().left+12),top:Math.max(110,document.querySelector('.toolbar').getBoundingClientRect().bottom+16),bottom:$('#teacher-dock').hidden?80:Math.max(100,$('#teacher-dock').getBoundingClientRect().height+86)};}
  function practice(){
    const question=compiled?.lesson.steps[index-1]?.question,response=responses[index];
    $('#teacher-dock').hidden=!compiled||!notesVisible||!!index&&!(question||compiled.lesson.steps[index-1]?.caption);
    $('#teacher-notes').setAttribute('aria-expanded',String(notesVisible));
    $('#teacher-practice').hidden=!question;
    if(!question){practiceStep=0;return;}
    $('#teacher-question').textContent=question.prompt;
    if(practiceStep!==index){$('#teacher-answer').value=response?.answer||'';practiceStep=index;}
    $('#teacher-hint-button').hidden=!question.hint;
    $('#teacher-hint').textContent=question.hint||'';$('#teacher-hint').hidden=!response?.hintUsed;
    $('#teacher-answer-status').textContent=response?.submittedAt?'Answer saved. Ask your assistant to review it.':'Try it, then ask your assistant to check your reasoning.';
  }
  function error(e){$('#teacher-error').textContent=e.message||String(e);setPanel(true);}
  function cancel(){clearTimeout(timer);timer=null;window.speechSynthesis?.cancel();animations.forEach(a=>a.cancel());animations=[];textReveals.forEach(f=>f());textReveals=[];}
  function pause(){playing=false;cancel();update();}
  function update(){
    $('#teacher-chat').hidden=(window.DrawingStorage.getItem('teaching-client')||'codex')!=='codex';
    $('#teacher-play').textContent=playing?'Pause':'Play';
    $('#teacher-prev').disabled=!compiled||index===0;
    $('#teacher-next').disabled=!compiled||index>=compiled.lesson.steps.length;
    $('#teacher-play').disabled=!compiled||!compiled.lesson.steps.length;
    $('#teacher-restart').disabled=!compiled;$('#teacher-edit').disabled=!active;$('#teacher-export').disabled=!compiled;
    $('#teacher-progress').max=compiled?.lesson.steps.length||1;$('#teacher-progress').value=index;
    $('#teacher-status').textContent=compiled?`${playing?'Replaying':active?'Live lesson':'Drawing mode'} · ${index} / ${compiled.lesson.steps.length}`:'No lesson in progress';
    $('#teacher-connection').textContent=!window.chrome?.webview?'Browser preview — open the Windows app':!acceptingCommands?'Live drawing paused by you':lastCommand?`${lastCommand.source==='mcp'?lastCommand.client+' tool received':'Local command received'} · ${new Date(lastCommand.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'Waiting for a teaching connection';
    $('#teacher-connection').dataset.connected=String(!!lastCommand&&acceptingCommands);
    $('#teacher-receive').textContent=acceptingCommands?'Pause live drawing':'Allow live drawing';$('#teacher-receive').setAttribute('aria-pressed',String(acceptingCommands));
    practice();
  }
  function saveSession(){
    if(!compiled||!boardId)return;
    const scene=board.read();if(scene.id!==boardId)return;
    try{store.save(boardId,compiled.lesson,index,active,scene.elements,revealed,responses);if(!board.flush())throw new Error('Drawing storage is unavailable.');storageError='';}
    catch(e){storageError=e.message;error(new Error('Could not save this lesson: '+e.message));}
  }
  function detach(){cancel();playing=false;active=false;layer.innerHTML='';document.body.classList.remove('teacher-active');saveSession();update();}
  function activate(){active=true;document.body.classList.add('teacher-active');}
  function beforeBoardChange(){saveSession();cancel();playing=false;}
  function boardChanged(){
    cancel();compiled=null;active=false;playing=false;index=0;revealed=0;responses={};practiceStep=0;notesVisible=false;storageError='';boardId=board.read().id;layer.innerHTML='';document.body.classList.remove('teacher-active');
    $('#teacher-title').textContent='Your live teaching board';$('#teacher-caption').textContent='Ask your connected assistant and say “use my whiteboard”. Your existing drawings stay saved.';
    try{
      const saved=store.read(boardId);
      if(saved){compiled=core.compile(saved.lesson);measureFrames(compiled.frames);index=Math.min(saved.index,compiled.lesson.steps.length);revealed=Math.min(saved.revealed??index,compiled.lesson.steps.length);$('#teacher-title').textContent=compiled.lesson.title;
        responses=saved.responses||{};notesVisible=!!saved.active;
        $('#teacher-caption').textContent=compiled.lesson.steps[index-1]?.caption||'Waiting for the next teaching step.';
        const unchanged=saved.fingerprint===fingerprint(board.read().elements);
        if(unchanged&&saved.lesson.version!==2){
          // Keep the old timeline intact as a recovery copy before upgrading.
          window.DrawingStorage.setItem('elixdraw-before-scroll:'+boardId,JSON.stringify(saved));
          board.show(compiled.frames[revealed],targetBounds(index),{scroll:true,force:true});
        }
        if(saved.active&&unchanged){activate();overlays(compiled.lesson.steps[index-1]);}
        if(unchanged)saveSession();
      }
    }catch(e){error(e);}
    update();viewportChanged();
  }
  function targetBounds(position){
    const step=compiled?.lesson.steps[position-1],frame=compiled?.frames[position]||[];
    const ids=new Set(step?.actions.filter(a=>a.op!=='remove').map(a=>a.id||a.element.id)||[]);
    const items=frame.filter(e=>ids.has(e.id)&&!e.id.startsWith('saved_'));
    return B.union(items)||{x:0,y:step?.pageTop||0,w:900,h:100};
  }
  let contentBottom=0;
  function viewportChanged(sceneChanged=true){
    const rail=$('#teacher-scroll'),nav=$('#teacher-navigation');if(!rail)return;
    $('#teacher-scroll-thumb').hidden=rail.hidden=nav.hidden=!compiled; if(!compiled)return;
    const view=board.viewport(),zoom=view.zoom;
    if(sceneChanged)contentBottom=board.contentBottom();
    rail.firstElementChild.style.height=((contentBottom+160)*zoom+rail.clientHeight)+'px';
    const top=Math.max(0,canvasArea().top-view.y);
    if(Math.abs(rail.scrollTop-top)>1)rail.scrollTop=top;
    const max=Math.max(1,rail.scrollHeight-rail.clientHeight),thumb=$('#teacher-scroll-thumb'),height=Math.max(32,rail.clientHeight*rail.clientHeight/rail.scrollHeight);
    thumb.style.height=height+'px';thumb.style.top=(rail.getBoundingClientRect().top+rail.scrollTop/max*(rail.clientHeight-height))+'px';
    rail.setAttribute('aria-valuenow',String(Math.round(rail.scrollTop/max*100)));
    if(active){
      if(sceneChanged)overlays(compiled.lesson.steps[index-1]);
      else layer.setAttribute('transform',`translate(${view.x} ${view.y}) scale(${zoom})`);
    }
  }
  function overlays(step){
    const scene=step?.focus?.length?board.read():{view:board.viewport(),elements:[]};layer.setAttribute('transform',`translate(${scene.view.x} ${scene.view.y}) scale(${scene.view.zoom})`);
    layer.innerHTML=(step?.focus||[]).map(id=>{const e=scene.elements.find(e=>e.id===id);if(!e)return '';const b=B.bounds(e);return `<rect class="teacher-focus" x="${b.x-9}" y="${b.y-9}" width="${b.w+18}" height="${b.h+18}" rx="8"/>`;}).join('')+(step?.pointer?`<circle class="teacher-pointer" cx="${step.pointer.x}" cy="${step.pointer.y}" r="9"/>`:'');
  }
  function animate(step){
    if(window.DrawingStorage.getItem('teaching-writing')==='instant'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const ids=step.actions.filter(a=>a.op==='add').map(a=>a.element.id);
    ids.forEach((id,i)=>{
      const group=$(`#scene [data-element="${id}"]`);if(!group)return;
      const paths=[...group.querySelectorAll('path,line,rect,ellipse,polyline')];
      if(paths.length)paths.forEach(path=>{try{const length=path.getTotalLength();animations.push(path.animate([{strokeDasharray:`${length} ${length}`,strokeDashoffset:length,opacity:0},{strokeDasharray:`${length} ${length}`,strokeDashoffset:0,opacity:1}],{duration:330,delay:Math.min(i*50,250),easing:'ease-out',fill:'backwards'}));}catch{}});
      else if(group.querySelector('text')){
        const spans=[...group.querySelectorAll('tspan')],texts=spans.map(s=>s.textContent),characters=texts.map(t=>Array.from(t)),total=characters.reduce((n,t)=>n+t.length,0);
        const start=performance.now()+Math.min(i*50,250),duration=Math.min(720,Math.max(120,total*7));let frame;
        const finish=()=>{cancelAnimationFrame(frame);spans.forEach((s,j)=>s.textContent=texts[j]);};textReveals.push(finish);
        const draw=now=>{let available=Math.floor(total*Math.max(0,Math.min(1,(now-start)/duration)));spans.forEach((s,j)=>{const chars=characters[j];s.textContent=chars.slice(0,available).join('');available=Math.max(0,available-chars.length);});if(now<start+duration)frame=requestAnimationFrame(draw);};
        spans.forEach(s=>s.textContent='');frame=requestAnimationFrame(draw);
      }else animations.push(group.animate([{opacity:0},{opacity:1}],{duration:450,delay:Math.min(i*50,250),fill:'backwards'}));
    });
  }
  function show(next,animated=false,reconciled=false){
    if(!reconciled&&compiled&&fingerprint(board.read().elements)!==fingerprint(compiled.frames[revealed]))throw new Error('Your board has new annotations. Continue with ChatGPT to keep them in the lesson before replaying.');
    const previouslyRevealed=revealed;
    cancel();index=Math.max(0,Math.min(compiled.lesson.steps.length,next));
    revealed=Math.max(revealed,index);
    practice();board.show(compiled.frames[revealed],targetBounds(index),{scroll:true,force:!animated});
    const step=compiled.lesson.steps[index-1];
    $('#teacher-caption').textContent=step?.caption??'Ready when you are. Press Play or Next to begin.';
    overlays(step);if(animated&&step&&index>previouslyRevealed)animate(step);update();saveSession();
    if(animated&&step&&$('#teacher-voice').checked&&window.speechSynthesis){const speech=new SpeechSynthesisUtterance(step.caption);speech.rate=Number($('#teacher-speed').value);window.speechSynthesis.speak(speech);}
  }
  function schedule(){
    const step=compiled.lesson.steps[index-1];
    if(step?.question&&!responses[index]?.submittedAt){pause();return;}
    timer=setTimeout(function advance(){if(!playing)return;if(window.speechSynthesis?.speaking){timer=setTimeout(advance,250);return;}if(index>=compiled.lesson.steps.length){pause();return;}show(index+1,true);schedule();},(step?.durationMs||6000)/Number($('#teacher-speed').value));
  }
  function play(){if(!active)return;if(playing){pause();return;}playing=true;if(index===0||index===compiled.lesson.steps.length)show(1,true);update();schedule();}
  function measureFrames(frames){
    for(const frame of frames)for(const item of frame)if(item.type==='text')board.measureText(item);
  }
  function writingWidth(){
    const area=canvasArea();
    return Math.max(160, $('#canvas').clientWidth-area.left-area.right-16);
  }
  function layoutNotes(notes,items){
    if(!Array.isArray(notes)||!notes.length||notes.length>12)throw new Error('Send 1 to 12 notes.');
    const width=writingWidth(), columns=width>=720&&notes.length>1?2:1;
    const cell=(width-32*(columns-1))/columns;
    const actions=[];
    let top=items.length?Math.ceil(core.bottom(items))+64:20,rowHeight=0;
    for(const [i,text] of notes.entries()){
      if(typeof text!=='string'||!text.trim()||text.length>2000)throw new Error('Each note needs 1 to 2000 characters.');
      const e={id:'note_'+crypto.randomUUID(),type:'text',x:8+(i%columns)*(cell+32),y:top,fontSize:24,text:''};
      const lines=[];
      for(const paragraph of text.split('\n')){
        let line='';
        for(const word of paragraph.split(/\s+/).filter(Boolean)){
          e.text=line?line+' '+word:word;board.measureText(e);
          if(line&&e.w>cell){lines.push(line);line=word;}else line=e.text;
          e.text=line;board.measureText(e);
          if(e.w>cell){
            line='';
            for(const char of e.text){e.text=line+char;board.measureText(e);if(line&&e.w>cell){lines.push(line);line=char;}else line=e.text;}
          }
        }
        lines.push(line);
      }
      e.text=lines.join('\n');board.measureText(e);
      actions.push({op:'add',element:e});rowHeight=Math.max(rowHeight,e.h);
      if((i+1)%columns===0){top+=rowHeight+32;rowHeight=0;}
    }
    return actions;
  }
  function start(lesson){
    if(lesson.conversationId){
      const existing=board.conversation(lesson.conversationId);
      if(existing){board.open(existing.id);return {...state(true),resumed:true};}
      if(lesson.boardId){
        if(!store.read(lesson.boardId))throw new Error('The selected board has no saved lesson.');
        const candidate=board.read().boards.find(b=>b.id===lesson.boardId);
        if(!candidate||candidate.conversationId)throw new Error('The selected board is missing or already linked.');
        board.open(lesson.boardId);board.bindConversation(lesson.conversationId);return {...state(true),resumed:true};
      }
    }
    const next=core.compile(lesson);measureFrames(next.frames);
    board.create(next.lesson.title);board.bindConversation(lesson.conversationId||crypto.randomUUID());compiled=next;responses={};notesVisible=true;boardId=board.read().id;revealed=0;playing=false;activate();
    $('#teacher-title').textContent=compiled.lesson.title;$('#teacher-options').open=false;$('#teacher-error').textContent='';show(0);return state(true);
  }
  function append(step){
    if(!compiled||boardId!==board.read().id)throw new Error('Start a lesson first.');
    const current=board.read().elements,steps=[];
    if(fingerprint(current)!==fingerprint(compiled.frames[compiled.frames.length-1]))steps.push({caption:'Your board annotations',actions:[],snapshot:current});
    if(step.notes!==undefined){
      if(step.actions?.length)throw new Error('Send notes or drawing actions in a step.');
      const {notes,...rest}=step;
      const actions=layoutNotes(notes,current);
      if(rest.pageBreak){const dy=Math.max(0,Math.ceil((core.bottom(current)+120)/100)*100-actions[0].element.y);for(const action of actions)action.element.y+=dy;}
      step={caption:'',...rest,actions};
    }
    const next=core.extend(compiled,[...steps,step]);
    measureFrames(next.frames.slice(compiled.frames.length));
    pause();compiled=next;revealed=compiled.lesson.steps.length-1;activate();show(compiled.lesson.steps.length,true,true);return state();
  }
  function state(includeScene=false){return {boardId,conversationId:board.identity(),writingWidth:writingWidth(),active,playing,acceptingCommands,lastCommand,saved:!storageError,storageError:storageError||null,title:compiled?.lesson.title||null,step:index,totalSteps:compiled?.lesson.steps.length||0,caption:compiled?.lesson.steps[index-1]?.caption||'',question:compiled?.lesson.steps[index-1]?.question||null,responses:structuredClone(responses),...(includeScene?{board:board.read(),nextY:Math.ceil((core.bottom(board.read().elements)+100)/50)*50,layout:'continuous-scroll',canvasArea:canvasArea(),hint:'Reuse this conversationId on EVERY tool call in this chat, including after reopening. A new chat starts a new board. Keep previous work; use nextY or pageBreak:true for a new topic/section. Read responses and student annotations before explaining the next step.'}:{} )};}
  function control(command){
    if(!compiled)throw new Error('No lesson on this board. Start a lesson first.');
    if(!active&&command!=='detach'&&command!=='pause'){
      if(fingerprint(board.read().elements)!==fingerprint(compiled.frames[revealed]))throw new Error('This board has your edits. Ask ChatGPT to continue with a new step, which will preserve them.');
      activate();
    }
    if(command==='play'){if(!playing)play();}else if(command==='pause')pause();
    else if(command==='next'){pause();show(index+1,true);}else if(command==='back'){pause();show(index-1);}else if(command==='restart'){pause();show(0);}else if(command==='detach')detach();else throw new Error('Unknown playback command.');
    return state();
  }
  function noteCommand(request){lastCommand={source:request.origin?.source||'local',client:request.origin?.client||'local bridge',method:request.method,at:new Date().toISOString()};update();}
  window.Teacher={get active(){return active;},detach,beforeBoardChange,boardChanged,state,start,append,control,viewportChanged,canvasArea,dispatch(request){try{
    noteCommand(request);
    if(!acceptingCommands&&!['teacher_read','teacher_snapshot'].includes(request.method)&&!(request.method==='teacher_control'&&request.params?.command==='pause'))throw new Error('Live drawing is paused by the student. Ask them to click Allow live drawing in the whiteboard.');
    const key=request.params?.conversationId;
    if(request.origin?.source==='mcp'&&request.method!=='teacher_start'&&!key)throw new Error('Use the conversationId returned by teacher_start in THIS chat. For a new chat call teacher_start with empty steps. Never use whichever board happens to be open.');
    if(key&&request.method!=='teacher_start'){
      const target=board.conversation(key);if(!target)throw new Error('No board linked to this conversation. Call teacher_start with this conversationId.');
      board.open(target.id);
    }
    let result;
    if(request.method==='teacher_read'||request.method==='teacher_snapshot')result=state(true);
    else if(request.method==='teacher_start')result=start(request.params);
    else if(request.method==='teacher_step')result=append(request.params);
    else if(request.method==='teacher_control')result=control(request.params.command);
    else throw new Error('Unknown teacher tool.');
    if(request.method!=='teacher_read'&&!storageError)$('#teacher-error').textContent='';
    return {ok:true,result};
  }catch(e){error(e);return {ok:false,error:e.message};}}};
  const safe=fn=>()=>{try{fn();$('#teacher-error').textContent='';}catch(e){error(e);}};
  let railDrag=null;
  const scrollRail=$('#teacher-scroll');
  function seekRail(e){
    const rect=scrollRail.getBoundingClientRect(),thumb=$('#teacher-scroll-thumb'),height=thumb.getBoundingClientRect().height;
    const fraction=B.clamp((e.clientY-rect.top-(railDrag?.offset??height/2))/Math.max(1,rect.height-height),0,1);
    scrollRail.scrollTop=fraction*(scrollRail.scrollHeight-scrollRail.clientHeight);
  }
  scrollRail.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();scrollRail.focus();const thumb=$('#teacher-scroll-thumb'),rect=thumb.getBoundingClientRect();railDrag={id:e.pointerId,offset:e.clientY>=rect.top&&e.clientY<=rect.bottom?e.clientY-rect.top:rect.height/2};try{scrollRail.setPointerCapture(e.pointerId);}catch{}scrollRail.classList.add('dragging');seekRail(e);});
  scrollRail.addEventListener('pointermove',e=>{if(railDrag?.id===e.pointerId){e.preventDefault();seekRail(e);}});
  const endRail=e=>{if(railDrag?.id!==e.pointerId)return;railDrag=null;scrollRail.classList.remove('dragging');};
  scrollRail.addEventListener('pointerup',endRail);scrollRail.addEventListener('pointercancel',endRail);scrollRail.addEventListener('lostpointercapture',endRail);
  scrollRail.addEventListener('keydown',e=>{
    viewportChanged();
    const delta={ArrowUp:-40,ArrowDown:40,PageUp:-scrollRail.clientHeight*.8,PageDown:scrollRail.clientHeight*.8}[e.key];
    if(delta!==undefined||['Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();scrollRail.scrollTop=e.key==='Home'?0:e.key==='End'?scrollRail.scrollHeight:scrollRail.scrollTop+delta;}
  });
  $('#teacher-scroll').onscroll=()=>{const y=$('#teacher-scroll').scrollTop,view=board.viewport();if(Math.abs((canvasArea().top-view.y)-y)>1)board.scrollTo(y/view.zoom);};
  $('#teacher-up').onclick=()=>board.scrollBy(-$('#canvas').clientHeight*.75);
  $('#teacher-down').onclick=()=>board.scrollBy($('#canvas').clientHeight*.75);
  $('#teacher-latest').onclick=()=>{pause();board.scrollTo(targetBounds(revealed).y);};
  function togglePanel(open){
    setPanel(open);
    if(compiled&&active)board.reframe(targetBounds(index));
  }
  $('#teacher-toggle').onclick=()=>togglePanel(panel.hidden);
  $('#teacher-close').onclick=()=>togglePanel(false);
  $('#teacher-notes').onclick=()=>{notesVisible=!notesVisible;practice();};$('#teacher-notes-close').onclick=()=>{notesVisible=false;practice();};
  $('#teacher-answer').oninput=()=>{responses[index]={...responses[index],answer:$('#teacher-answer').value,submittedAt:null};saveSession();};
  $('#teacher-practice').onsubmit=e=>{e.preventDefault();if(!$('#teacher-answer').value.trim())return;responses[index]={...responses[index],answer:$('#teacher-answer').value.trim(),submittedAt:new Date().toISOString()};saveSession();practice();};
  $('#teacher-hint-button').onclick=()=>{responses[index]={...responses[index],hintUsed:true};saveSession();practice();};
  $('#teacher-draw-answer').onclick=()=>{detach();document.querySelector('[data-tool="pencil"]').click();};
  $('#teacher-play').onclick=safe(()=>control(playing?'pause':'play'));$('#teacher-prev').onclick=safe(()=>control('back'));$('#teacher-next').onclick=safe(()=>control('next'));
  $('#teacher-restart').onclick=safe(()=>control('restart'));$('#teacher-edit').onclick=()=>{detach();$('#teacher-caption').textContent='The drawing is yours. Use any drawing tool; your board saves locally. Start a new lesson whenever you’re ready.';};
  $('#teacher-chat').onclick=()=>{if(window.chrome?.webview)window.chrome.webview.postMessage(JSON.stringify({type:'focus-chatgpt'}));else error(new Error('Open the Windows executable to connect to ChatGPT.'));};
  $('#teacher-receive').onclick=()=>{acceptingCommands=!acceptingCommands;if(!acceptingCommands)pause();update();};
  $('#teacher-speed').onchange=()=>{if(playing){pause();play();}};$('#teacher-voice').onchange=()=>{if(!$('#teacher-voice').checked)window.speechSynthesis?.cancel();};
  if(!window.speechSynthesis){$('#teacher-voice').disabled=true;$('#teacher-voice').parentElement.title='Read aloud is unavailable in this Windows runtime.';}
  $('#teacher-import').onclick=()=>$('#teacher-file').click();
  $('#teacher-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>2*1024*1024)throw new Error('Lesson files must be under 2 MB.');start(JSON.parse(await file.text()));}catch(e){error(e);}finally{e.target.value='';}};
  $('#teacher-export').onclick=safe(()=>{
    const text=JSON.stringify(compiled.lesson,null,2);
    if(window.chrome?.webview){const bytes=new TextEncoder().encode(text);let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));window.chrome.webview.postMessage(JSON.stringify({type:'save',id:'teacher-lesson',name:compiled.lesson.title.replace(/[^\w -]/g,'')+'.lesson.json',base64:btoa(binary)}));}
    else{const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='lesson.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  });
  // Editing commands leave playback first, so a timer can never overwrite user work.
  document.addEventListener('keydown',e=>{
    if(!active||scrollRail.contains(e.target)||panel.contains(e.target)||$('#teacher-dock').contains(e.target)||e.target.closest?.('input,textarea,select,dialog'))return;
    if(['PageDown','PageUp','Home','End','ArrowUp','ArrowDown'].includes(e.key)){
      e.preventDefault();e.stopImmediatePropagation();
      if(e.key==='Home')board.scrollTo(0);else if(e.key==='End')board.scrollTo(targetBounds(revealed).y);
      else board.scrollBy((e.key==='PageUp'||e.key==='ArrowUp'?-1:1)*(e.key.startsWith('Page')?$('#canvas').clientHeight*.75:60));return;
    }
    if(!['Shift','Control','Alt','Meta',' '].includes(e.key))detach();
  },{capture:true,signal:listeners.signal});
  document.addEventListener('click',e=>{if(active&&!panel.contains(e.target)&&!$('#teacher-dock').contains(e.target)&&!$('#teacher-navigation').contains(e.target)&&!$('#teacher-toggle').contains(e.target)&&e.target.closest('button,[data-action],[data-tool]'))detach();},{capture:true,signal:listeners.signal});
  const webview=window.chrome?.webview;
  const onMessage=({data})=>{
    if(data?.type==='teacher-activity')noteCommand(data);
    if(data?.type==='chatgpt-focus-result'&&data.error)error(new Error(data.error));
    if(data?.type==='command'||data?.type==='open-result')detach();
    if(data?.type==='save-result'&&data.id==='teacher-lesson'){
      if(data.error)error(new Error(data.error));else $('#teacher-status').textContent=data.saved?'Lesson saved. Open this JSON file to replay it.':'Save cancelled.';
    }
  };
  webview?.addEventListener('message',onMessage);
  window.addEventListener('resize',()=>{if(compiled&&active)board.reframe(targetBounds(index));viewportChanged();},{signal:listeners.signal});
  window.addEventListener('beforeunload',saveSession,{signal:listeners.signal});
  boardChanged();
  return function removeTeaching(){
    detach();listeners.abort();webview?.removeEventListener('message',onMessage);
    for(const id of ['teacher-toggle','teacher-panel','teacher-dock','teacher-navigation','teacher-scroll','teacher-scroll-thumb','teacher-overlay'])document.getElementById(id)?.remove();
    delete window.Teacher;
  };
};
