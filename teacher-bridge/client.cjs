'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const defaultDirectory=()=>path.join(process.env.LOCALAPPDATA||'', 'CraftSketchDesktop','TeacherBridge');
async function session(directory){
  const data=JSON.parse(await fs.readFile(path.join(directory,'session.json'),'utf8'));
  if(!/^[a-f0-9]{32}$/.test(data.session)||!Number.isInteger(data.pid))throw new Error('Invalid board session.');
  process.kill(data.pid,0);return data;
}
async function request(method,params={},options={}){
  const directory=options.directory||process.env.TEACHER_BRIDGE_DIR||defaultDirectory();
  let connected;
  try{connected=await session(directory);}catch{
    if(options.open===false||process.env.TEACHER_BRIDGE_DIR)throw new Error('Open Rillboard before using the teacher tools.');
    let executable=path.join(__dirname,'..','Rillboard.exe');
    try { executable=JSON.parse(await fs.readFile(path.join(__dirname,'launcher.json'),'utf8')); }
    catch(error){ if(error.code!=='ENOENT')throw error; }
    await fs.access(executable);
    // This is the user's interactive GUI, not a hidden helper process.
    const child=spawn(executable,[],{detached:true,stdio:'ignore',windowsHide:false});
    let launchError;child.on('error',error=>{launchError=error;});child.unref();
    for(let i=0;i<80;i++){await delay(150);if(launchError)throw launchError;try{connected=await session(directory);break;}catch{}}
    if(!connected)throw new Error('The drawing app did not become ready. Open it and try again.');
  }
  if(connected.enabled===false)throw new Error('GPT Teaching is off. Open the Rillboard menu, choose Settings, then Add plugin.');
  const id=crypto.randomUUID().replaceAll('-','');
  const input=path.join(directory,id+'.request.json'),output=path.join(directory,id+'.response.json'),temporary=input+'.tmp';
  const timeout=options.timeout||20000;
  const body=JSON.stringify({session:connected.session,expires:Date.now()+timeout,method,params,origin:options.origin||{source:'local',client:'command line'}});
  if(Buffer.byteLength(body)>2*1024*1024)throw new Error('Request exceeds 2 MB. Send smaller steps.');
  await fs.writeFile(temporary,body,{flag:'wx'});await fs.rename(temporary,input);
  try{
    const until=Date.now()+timeout;
    while(Date.now()<until){
      try{const result=JSON.parse(await fs.readFile(output,'utf8'));if(!result.ok)throw new Error(result.error||'Board command failed.');return result.result;}
      catch(e){if(e.code!=='ENOENT')throw e;}
      await delay(75);
    }
    throw new Error('Board response timed out. Read the board before retrying; the command may have been applied.');
  }finally{await Promise.all([input,output,temporary].map(file=>fs.rm(file,{force:true}).catch(()=>{})));}
}
module.exports={request};
if(require.main===module){
  (async()=>{
    const [method,input,output]=process.argv.slice(2);
    if(!method)throw new Error('Usage: node teacher-bridge/client.cjs teacher_read | teacher_start lesson.json | teacher_step step.json | teacher_control command.json | teacher_snapshot - output.png');
    const params=input&&input!=='-'?JSON.parse(await fs.readFile(input,'utf8')):{};
    const result=await request(method,params);
    if(method==='teacher_snapshot'&&output){await fs.writeFile(output,Buffer.from(result.data,'base64'));console.log(output);}
    else console.log(JSON.stringify(result,null,2));
  })().catch(e=>{console.error(e.message);process.exitCode=1;});
}
