'use strict';
// MCP stdio transport: one JSON-RPC message per line; stdout is protocol-only.
const readline=require('node:readline');
const {request}=require('./client.cjs');
let clientName='MCP client';
const object=properties=>({type:'object',properties,additionalProperties:false});
const conversationId={type:'string',pattern:'^[a-zA-Z0-9_:.\\-]{1,200}$',description:'Stable key for THIS chat, returned by its first teacher_start. Reuse it on every call and after reopening. Never reuse a key from another chat or use the current open board as the chat identity.'};
const element={type:'object',description:'Editable drawing element. Use unique stable id. Coordinates are board units; x/y is top left. Text supports Unicode and newlines. Lines/arrows use w/h as signed endpoint offsets. Pencil points are relative [x,y] pairs.',properties:{
  id:{type:'string',pattern:'^[a-zA-Z0-9_-]{1,80}$'},type:{enum:['rectangle','diamond','ellipse','line','arrow','text','pencil','image']},
  x:{type:'number'},y:{type:'number'},w:{type:'number'},h:{type:'number'},text:{type:'string'},fontSize:{type:'number'},
  stroke:{type:'string',description:'Hex color, for example #1971c2.'},fill:{type:'string'},fillStyle:{enum:['solid','hachure']},strokeWidth:{type:'number'},rough:{type:'number'},opacity:{type:'number'},dash:{enum:['solid','dashed','dotted']},
  points:{type:'array',items:{type:'array',items:{type:'number'},minItems:2,maxItems:2}},src:{type:'string',description:'Image data URL, PNG/JPEG/WebP/GIF only.'}
},required:['id','type','x','y'],additionalProperties:false};
const step={...object({caption:{type:'string',maxLength:4000},pageBreak:{type:'boolean',description:'Continue in a fresh section BELOW all existing work; local y coordinates start on that section. Earlier pages remain on the board.'},durationMs:{type:'number',minimum:500,maximum:60000},focus:{type:'array',items:{type:'string'}},pointer:{...object({x:{type:'number'},y:{type:'number'}}),required:['x','y']},actions:{type:'array',maxItems:200,items:{oneOf:[
  {...object({op:{const:'add'},element}),required:['op','element']},
  {...object({op:{const:'update'},id:{type:'string'},changes:{type:'object',description:'Changed drawing properties; id and type remain unchanged.'}}),required:['op','id','changes']},
  {...object({op:{const:'remove'},id:{type:'string'}}),required:['op','id']}
]}}}),required:['caption','actions']};
const tools=[
  {name:'teacher_read',description:'Read the current whiteboard elements and lesson playback status. Opens the local Windows app if needed. Use before changing an existing lesson.',inputSchema:object({}),annotations:{readOnlyHint:true}},
  {name:'teacher_start',description:'Create a NEW lesson board only for a NEW topic, preserving other boards. Starts paused. Use teacher_step for live drawing. This is a continuous scrolling board: use writingWidth and extend y downward. Never start another board or erase previous writing merely to make room.',inputSchema:{...object({title:{type:'string',minLength:1,maxLength:100},steps:{type:'array',maxItems:200,items:step}}),required:['title','steps']}},
  {name:'teacher_step',description:'Append and scroll to a teaching step while preserving earlier pages. Read teacher_read.nextY and place new sections below it, or set pageBreak:true with local y coordinates. Never remove previous sections to make room. Stable ids allow targeted corrections. Bulk page clears are preserved automatically. Supply short captions and inspect screenshots.',inputSchema:{...step,properties:{...step.properties,notes:{type:'array',minItems:1,maxItems:12,items:{type:'string',maxLength:2000},description:'Plain text blocks arranged across the board. Use notes alone for writing.'}},required:[]}},
  {name:'teacher_control',description:'Review lesson steps and scroll to their writing. Back/restart preserve all already revealed pages. detach leaves the board editable and stops playback.',inputSchema:{...object({command:{enum:['play','pause','next','back','restart','detach']}}),required:['command']}},
  {name:'teacher_snapshot',description:'See a PNG screenshot of the actual Windows whiteboard, including captions. Use to inspect layout, overlaps and legibility after drawing.',inputSchema:object({}),annotations:{readOnlyHint:true}}
];
// Identity is per call, never process-global: one MCP process can serve many chats.
for(const tool of tools){
  tool.inputSchema.properties.conversationId=conversationId;
  if(['teacher_step','teacher_control','teacher_snapshot'].includes(tool.name))tool.inputSchema.required=[...(tool.inputSchema.required||[]),'conversationId'];
}
const question={...object({prompt:{type:'string',minLength:1,maxLength:1000},hint:{type:'string',maxLength:1000}}),required:['prompt']};
step.properties.question=question;
tools.find(t=>t.name==='teacher_step').inputSchema.properties.question=question;
tools.find(t=>t.name==='teacher_read').inputSchema.properties.detail={enum:['compact','full'],description:'Full includes drawing styles, stroke points and image data.'};
tools.find(t=>t.name==='teacher_start').inputSchema.properties.boardId={type:'string',description:'Only for migrating an older unlinked lesson: use its board id from this chat history with a conversationId. Never choose the currently open board by default.'};
tools.find(t=>t.name==='teacher_read').description='Read the saved board and student responses for THIS conversationId, restoring its board if needed. With no key, return setup guidance only. Use the key returned in this chat history. Read before continuing and after a timeout.';
tools.find(t=>t.name==='teacher_start').description='Open this chat\'s saved board, or create one for a NEW chat. First call: title and empty steps; retain the returned conversationId in chat history. Later calls: reuse that key to resume, without resetting any work. New topics in the same chat use pageBreak:true, not new boards. Optional boardId links a legacy lesson from this chat history.';
tools.find(t=>t.name==='teacher_step').description+=' Prefer notes:[explanation, worked example] for text. The app wraps and positions the blocks. For diagrams use actions across the returned writingWidth. Reuse this chat\'s conversationId. Add question:{prompt,hint} for a prediction or practice checkpoint; pause and let the student respond. Read their saved responses and annotations before explaining the answer. Use short steps with diagrams, arrows, highlighting and targeted corrections.';
async function handle(message){
  if(!message||message.jsonrpc!=='2.0')return {jsonrpc:'2.0',id:message?.id??null,error:{code:-32600,message:'Invalid request'}};
  if(message.id===undefined)return null;
  const reply=result=>({jsonrpc:'2.0',id:message.id,result});
  if(message.method==='initialize'){clientName=String(message.params?.clientInfo?.name||'MCP client').slice(0,100);return reply({protocolVersion:['2024-11-05','2025-03-26','2025-06-18'].includes(message.params?.protocolVersion)?message.params.protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'elixdraw-teacher',version:'2.0.0'},instructions:'You are the teacher in this conversation; draw on the connected Windows whiteboard using these tools. One chat owns one saved board. For a new chat call teacher_start with empty steps and retain the returned conversationId in this chat history. Reuse that key on EVERY read, step, control and snapshot, including when returning later. Never infer chat identity from whichever board is open. In the same chat, start new topics below previous writing using pageBreak:true. Use short steps, diagrams, highlights and question checkpoints; read student responses before giving feedback. Inspect teacher_snapshot to check actual results. Respond to student questions by updating the live board. Do not load canned sample lessons. No API key or separate model is needed. Drawings and lesson timelines persist; teacher_step preserves student annotations.'});}
  if(message.method==='ping')return reply({});
  if(message.method==='tools/list')return reply({tools});
  if(message.method==='tools/call'){
    const name=message.params?.name;
    if(!tools.some(t=>t.name===name))return {jsonrpc:'2.0',id:message.id,error:{code:-32602,message:'Unknown tool'}};
    try{
      const args=message.params.arguments||{};
      if(name==='teacher_read'&&!args.conversationId)return reply({content:[{type:'text',text:JSON.stringify({needsConversation:true,instruction:'For a new chat call teacher_start with title and empty steps. Reuse the returned conversationId on EVERY subsequent tool call in this chat. For an older chat, recover its key (or legacy boardId) from its tool history. No current board was read or changed.'})}]});
      if(name!=='teacher_start'&&!args.conversationId)throw new Error('conversationId is required. Use the key returned by teacher_start in this chat.');
      const result=await request(name,args,{origin:{source:'mcp',client:clientName}});if(result.board){
        // The workspace directory includes other conversations. Return only this board.
        delete result.board.boards;
        if(args.detail!=='full')result.board.elements=result.board.elements.map(e=>{
          const {id,type,x,y,w,h,text}=e;
          return {id,type,x,y,w,h,text};
        });
      }
      return reply({content:name==='teacher_snapshot'?[{type:'image',mimeType:'image/png',data:result.data}]:[{type:'text',text:JSON.stringify(result)}]});}
    catch(e){return reply({isError:true,content:[{type:'text',text:e.message}]});}
  }
  return {jsonrpc:'2.0',id:message.id,error:{code:-32601,message:'Method not found'}};
}
module.exports={handle,tools};
if(require.main===module){
  const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});let queue=Promise.resolve();
  const send=value=>{if(value)process.stdout.write(JSON.stringify(value)+'\n');};
  lines.on('line',line=>{queue=queue.then(async()=>{let parsed;try{if(Buffer.byteLength(line)>2*1024*1024)throw new Error();parsed=JSON.parse(line);}catch{send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON or oversized message'}});return;}send(await handle(parsed));}).catch(e=>{process.stderr.write(e.message+'\n');});});
}
