(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./geometry.js'));
  else root.TeacherCore=factory(root.Board);
})(typeof globalThis!=='undefined'?globalThis:this,function(B){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);
  function bottom(items){return Math.max(0,...items.map(e=>{const b=B.bounds(e);return b.y+Math.max(b.h,e.type==='text'?e.text.split('\n').length*e.fontSize*1.4:0);}));}
  // Normalize old slide-style clears into new sections of one continuous board.
  // Persist normalized actions so reopening never applies the offset twice.
  function paginate(step,previous,pageTop,number){
    if(step.layoutVersion===2){if(!Number.isFinite(step.pageTop)||step.pageTop<0)throw new Error('Invalid page position.');return {step,pageTop:step.pageTop};}
    if(!Array.isArray(step.actions))throw new Error('A step needs actions.');
    const removes=new Set(step.actions.filter(a=>a?.op==='remove').map(a=>a.id));
    for(const id of removes)if(!previous.some(e=>e.id===id))throw new Error('Element not found: '+id);
    const page=previous.filter(e=>e.y>=pageTop);
    const clearing=removes.size>=2&&page.filter(e=>removes.has(e.id)).length>=page.length*.6;
    if(step.pageBreak||clearing){
      pageTop=Math.ceil((bottom(previous)+120)/100)*100;
      // IDs reused by an old slide remain editable on the new page. Archive the
      // previous occurrence under a distinct id, without changing its drawing.
      const reused=new Set(step.actions.filter(a=>a?.op==='add').map(a=>a.element?.id));
      const archive=[];
      for(const e of previous)if(removes.has(e.id)&&reused.has(e.id)){
        let attempt=0,id=('saved_'+number+'_'+e.id).slice(0,80);
        while(previous.some(p=>p.id===id)||reused.has(id))id=('saved_'+number+'_'+(++attempt)+'_'+e.id).slice(0,80);
        archive.push({op:'remove',id:e.id},{op:'add',element:{...clone(e),id}});
      }
      step.actions=[...archive,...step.actions.filter(a=>a.op!=='remove')];
    }
    for(const action of step.actions){
      if(action.op==='add'&&!action.element.id.startsWith('saved_')&&action.element.y<pageTop)action.element.y+=pageTop;
      if(action.op==='update'&&action.changes?.y!==undefined&&action.changes.y<pageTop){
        const target=previous.find(e=>e.id===action.id);
        if(target?.y>=pageTop)action.changes.y+=pageTop;
      }
    }
    if(step.pointer&&step.pointer.y<pageTop)step.pointer.y+=pageTop;
    step.layoutVersion=2;step.pageTop=pageTop;
    return {step,pageTop};
  }
  function element(raw){
    if(!raw||!validId(raw.id))throw new Error('Every element needs an id containing letters, numbers, _ or -.');
    for(const key of ['x','y','w','h','fontSize','strokeWidth','opacity'])if(raw[key]!==undefined&&(!Number.isFinite(raw[key])||Math.abs(raw[key])>100000))throw new Error('Invalid element '+key);
    const clean=B.sanitizeElement(raw);
    if(!clean)throw new Error('Unsupported or invalid drawing element: '+raw.id);
    clean.id=raw.id;
    return clean;
  }
  function apply(previous,actions){
    if(!Array.isArray(actions)||actions.length>200)throw new Error('A step supports at most 200 actions.');
    let next=clone(previous);
    for(const action of actions){
      if(!action||typeof action!=='object')throw new Error('Invalid action.');
      if(action.op==='add'){
        const item=element(action.element);
        if(next.some(e=>e.id===item.id))throw new Error('Duplicate element id: '+item.id);
        next.push(item);
      }else if(action.op==='update'){
        const index=next.findIndex(e=>e.id===action.id);
        if(index<0)throw new Error('Element not found: '+action.id);
        next[index]=element({...next[index],...action.changes,id:action.id,type:next[index].type});
      }else if(action.op==='remove'){
        if(!next.some(e=>e.id===action.id))throw new Error('Element not found: '+action.id);
        next=next.filter(e=>e.id!==action.id);
      }else throw new Error('Unknown action: '+action.op);
      if(next.length>1000)throw new Error('A lesson board supports at most 1,000 elements.');
    }
    return next;
  }
  function compile(input){
    if(!input||typeof input.title!=='string'||!input.title.trim()||input.title.length>100)throw new Error('A lesson needs a title (1–100 characters).');
    if(!Array.isArray(input.steps)||input.steps.length>200)throw new Error('A lesson supports at most 200 steps.');
    return extend({lesson:{version:2,title:input.title,steps:[]},frames:[[]],count:0},input.steps);
  }
  function extend(existing, additions){
    if(existing.lesson.steps.length+additions.length>200)throw new Error('A lesson supports at most 200 steps.');
    const steps=clone(additions), frames=existing.frames.slice();
    const lesson={...existing.lesson,steps:[...existing.lesson.steps,...steps]};
    let count=existing.count,pageTop=existing.lesson.steps.at(-1)?.pageTop||0;
    for(const step of steps){
      if(!step||typeof step.caption!=='string'||step.caption.length>4000)throw new Error('Each step needs a caption of at most 4,000 characters.');
      if(step.question && (typeof step.question.prompt!=='string'||!step.question.prompt.trim()||step.question.prompt.length>1000||
        (step.question.hint!==undefined&&(typeof step.question.hint!=='string'||step.question.hint.length>1000))))throw new Error('A practice question needs a prompt and an optional hint, each at most 1,000 characters.');
      if(step.durationMs!==undefined&&(!Number.isFinite(step.durationMs)||step.durationMs<500||step.durationMs>60000))throw new Error('Step duration must be between 500 and 60,000 ms.');
      if(step.pointer&&(!Number.isFinite(step.pointer.x)||!Number.isFinite(step.pointer.y)))throw new Error('Pointer coordinates must be finite numbers.');
      if(step.focus&&(!Array.isArray(step.focus)||step.focus.some(id=>!validId(id))))throw new Error('Focus must contain element ids.');
      let previous=frames[frames.length-1];
      if(step.snapshot!==undefined){
        if(!Array.isArray(step.snapshot)||step.snapshot.length>1000)throw new Error('Invalid annotation snapshot.');
        previous=step.snapshot.map(element);
        if(new Set(previous.map(e=>e.id)).size!==previous.length)throw new Error('Duplicate annotation ids.');
        count+=previous.length;
      }
      ({pageTop}=paginate(step,previous,pageTop,frames.length));
      const frame=apply(previous,step.actions);
      if(step.focus?.some(id=>!frame.some(e=>e.id===id)))throw new Error('Focus references a missing element.');
      count+=step.actions.length;
      if(count>5000)throw new Error('A lesson supports at most 5,000 actions.');
      frames.push(frame);
    }
    return {lesson,frames,count};
  }
  return {compile,extend,apply,bottom};
});
