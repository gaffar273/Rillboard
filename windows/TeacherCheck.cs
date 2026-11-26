using System;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class LessonScript : IScriptDone { public Action<int,string> Done; public int Invoke(int error,string result){Done(error,result);return 0;} }
[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class LessonCapture : ICaptureDone { public Action<int> Done; public int Invoke(int error){Done(error);return 0;} }
static class TeacherCheck {
    [DllImport("shlwapi.dll", CharSet=CharSet.Unicode)] static extern int SHCreateStreamOnFileEx(string path,int mode,int attrs,bool create,IStream template,out IStream stream);
    static readonly BindingFlags Private=BindingFlags.NonPublic|BindingFlags.Instance;
    static Form form; static IWebView webview; static Timer timer; static LessonScript callback; static LessonCapture capture; static IStream stream;
    static string folder,failure; static int stage,ticks; static bool busy,restore;
    [STAThread] static int Main(string[] args){
        folder=Path.GetFullPath(args[0]);Directory.CreateDirectory(folder);Application.EnableVisualStyles();
        Run(false);if(failure==null)Run(true);
        File.WriteAllText(Path.Combine(folder,"result.json"),new JavaScriptSerializer().Serialize(new{success=failure==null,error=failure}));
        Console.WriteLine(failure??("PASS: native layout, chat isolation, answer/hint persistence, annotation-safe review, resize and restart. Screenshots: "+folder));return failure==null?0:1;
    }
    static void Run(bool reopening){
        restore=reopening;stage=0;ticks=0;busy=false;
        form=(Form)Activator.CreateInstance(typeof(IWebView).Assembly.GetType("DrawingWindow"),Private,null,new object[]{Path.Combine(folder,"profile")},null);
        timer=new Timer{Interval=200};timer.Tick+=Tick;form.Shown+=delegate{timer.Start();};form.FormClosed+=delegate{timer.Stop();};Application.Run(form);
    }
    static void Fail(string message){failure=message;timer.Stop();form.Close();}
    static void Script(string source,Action<string> done){busy=true;callback=new LessonScript{Done=delegate(int error,string value){busy=false;try{if(error<0)Marshal.ThrowExceptionForHR(error);done(value);}catch(Exception e){Fail(e.ToString());}}};webview.ExecuteScript(source,callback);}
    static void Check(string source,Action done){Script("(()=>{try{"+source+";return 'ok'}catch(e){return e.stack}})()",delegate(string value){if(value!="\"ok\"")throw new Exception("Stage "+stage+": "+value);done();});}
    static void Shot(string name,Action done){
        busy=true;SHCreateStreamOnFileEx(Path.Combine(folder,name+".png"),0x1001,0,true,null,out stream);
        capture=new LessonCapture{Done=delegate(int error){Marshal.ReleaseComObject(stream);stream=null;busy=false;if(error<0)Fail("Screenshot failed");else done();}};webview.CapturePreview(0,stream,capture);
    }
    const string Setup=@"
      const q=s=>document.querySelector(s),check=(v,m)=>{if(!v)throw Error(m)};
      const send=(method,params={})=>{const r=Teacher.dispatch({method,params,origin:{source:'mcp'}});if(!r.ok)throw Error(r.error);return r.result};
    ";
    static void Tick(object sender,EventArgs args){
        if(++ticks>180){Fail("Timed out in stage "+stage);return;}if(busy)return;
        try{
            webview=(IWebView)form.GetType().GetField("webview",Private).GetValue(form);if(webview==null)return;
            if(stage==0)Script("document.readyState==='complete' && !!window.TeachingBoard && !document.querySelector('#plugin-toggle').disabled",delegate(string value){if(value=="true")stage=restore?21:26;});
            else if(stage==26)Shot("home-light",delegate{stage=27;});
            else if(stage==27)Check(Setup+@"q('#menu-button').click();q('[data-theme=dark]').click();q('#menu-button').click();check(document.body.classList.contains('dark'),'Dark theme failed');",delegate{stage=28;});
            else if(stage==28)Shot("home-dark",delegate{stage=29;});
            else if(stage==29)Check(Setup+@"q('#menu-button').click();q('[data-theme=light]').click();q('#menu-button').click();",delegate{stage=20;});
            else if(stage==20)Check(Setup+@"check(!window.Teacher && !q('#teacher-panel'),'Teaching loaded by default');q('#menu-button').click();q('[data-action=settings]').click();check(q('#settings-dialog').open,'Settings failed');q('#plugin-toggle').click();",delegate{stage=21;});
            else if(stage==21)Script("!!window.Teacher && !document.querySelector('#plugin-toggle').disabled",delegate(string value){if(value=="true")stage=restore?1:30;});
            else if(stage==30)Shot("connection-guide",delegate{stage=22;});
            else if(stage==22)Check(Setup+@"check(q('#connection-dialog').open && q('#bridge-command').textContent.includes('server.cjs'),'Guide unavailable');const client=q('#bridge-client');for(const [value,match] of [['gemini','gemini mcp add'],['claude','mcpServers'],['codex','codex mcp add']]){client.value=value;client.onchange();check(q('#bridge-command').textContent.includes(match),'Client setup mismatch');}q('#guide-close').click();q('#writing-mode').value='instant';q('#writing-mode').onchange();check(DrawingStorage.getItem('teaching-writing')==='instant','Writing preference failed');q('#plugin-toggle').click();",delegate{stage=23;});
            else if(stage==23)Script("!window.Teacher && !document.querySelector('#plugin-toggle').disabled",delegate(string value){if(value=="true")stage=24;});
            else if(stage==24)Check(Setup+@"check(!q('#teacher-toggle')&&q('#style-toggle'),'Removal left teaching controls');q('#plugin-toggle').click();",delegate{stage=25;});
            else if(stage==25)Script("!!window.Teacher && !document.querySelector('#plugin-toggle').disabled",delegate(string value){if(value=="true")Check(Setup+@"document.querySelectorAll('dialog[open]').forEach(d=>d.close());",delegate{stage=1;});});
            else if(stage==1&&!restore)Check(Setup+@"
              check(q('#teacher-panel').hidden,'Teaching panel must start closed');check(q('#teacher-dock').hidden,'No lesson dock on standalone board');
              q('[data-tool=pencil]').click();check(getComputedStyle(q('#properties')).display==='none','Style panel occupies left side');
              q('#style-toggle').click();check(getComputedStyle(q('#properties')).display!=='none','Style toggle cannot open properties');q('#style-toggle').click();
              q('[data-tool=select]').click();check(q('#canvas').clientWidth===innerWidth,'Canvas should use full width');
            ",delegate{stage=2;});
            else if(stage==2&&!restore)Shot("standalone",delegate{stage=3;});
            else if(stage==3&&!restore)Check(Setup+@"
              const a=send('teacher_start',{title:'Chat A · Motion',conversationId:'qa-chat-a',steps:[]});localStorage.setItem('qa-a',a.boardId);
              send('teacher_step',{conversationId:'qa-chat-a',caption:'Predict the direction before continuing.',actions:[
                {op:'add',element:{id:'heading',type:'text',x:55,y:40,text:'Motion: make a prediction',fontSize:30}},
                {op:'add',element:{id:'block',type:'rectangle',x:80,y:150,w:170,h:100,fill:'#a5d8ff',fillStyle:'solid'}},
                {op:'add',element:{id:'force',type:'arrow',x:270,y:200,w:230,h:0,stroke:'#1971c2',strokeWidth:3}},
                {op:'add',element:{id:'label',type:'text',x:320,y:140,text:'Push',fontSize:26}}],question:{prompt:'Which way will the block speed up?',hint:'Follow the arrow.'}});
              send('teacher_control',{conversationId:'qa-chat-a',command:'pause'});
              check(q('#teacher-panel').hidden,'Incoming drawing reopened side panel');
              check(TeachingBoard.read().view.zoom===1,'Hidden side panels still shrink drawing');
              check(!q('#teacher-practice').hidden,'Practice prompt missing');
              check(!send('teacher_control',{conversationId:'qa-chat-a',command:'play'}).playing,'Playback did not pause for unanswered question');
              q('#teacher-answer').value='To the right';q('#teacher-answer').dispatchEvent(new Event('input'));
              q('#teacher-practice').dispatchEvent(new Event('submit',{cancelable:true}));q('#teacher-hint-button').click();
              check(send('teacher_read',{conversationId:'qa-chat-a'}).responses[1].answer==='To the right','Student response not exposed to teacher');
              q('#teacher-toggle').click();q('#teacher-close').click();check(q('#teacher-panel').hidden,'Panel does not stay collapsed');
            ",delegate{stage=4;});
            else if(stage==4&&!restore)Shot("interactive-lesson",delegate{stage=5;});
            else if(stage==5&&!restore)Check(Setup+@"
              send('teacher_start',{title:'Chat B',conversationId:'qa-chat-b',steps:[]});
              send('teacher_step',{conversationId:'qa-chat-b',caption:'Separate conversation',actions:[{op:'add',element:{id:'b-only',type:'text',x:55,y:40,text:'A separate saved board',fontSize:28}}]});
              const resumed=send('teacher_start',{title:'Ignored on resume',conversationId:'qa-chat-a',steps:[]});
              check(resumed.resumed&&resumed.boardId===localStorage.getItem('qa-a'),'Old chat did not resume same board');
              check(resumed.board.elements.length===4&&!resumed.board.elements.some(e=>e.id==='b-only'),'Chat content crossed boards');
              check(resumed.responses[1].hintUsed&&q('#teacher-answer').value==='To the right','Saved response or hint lost on switch');
              send('teacher_control',{conversationId:'qa-chat-a',command:'detach'});
              const current=TeachingBoard.read();TeachingBoard.show([...current.elements,{id:'student-ink',type:'pencil',x:600,y:180,points:[[0,0],[15,25],[50,-10]],stroke:'#2b8a3e',strokeWidth:3}],null);
              const denied=Teacher.dispatch({method:'teacher_control',params:{conversationId:'qa-chat-a',command:'restart'},origin:{source:'mcp'}});
              check(!denied.ok&&TeachingBoard.read().elements.some(e=>e.id==='student-ink'),'Replay erased student annotations');
              send('teacher_step',{conversationId:'qa-chat-a',caption:'Your prediction is saved with your drawing.',pageBreak:true,actions:[{op:'add',element:{id:'later',type:'text',x:55,y:40,text:'Next section — earlier work stays above',fontSize:28}}]});
              check(TeachingBoard.read().elements.some(e=>e.id==='student-ink'),'Continuing erased student ink');
              send('teacher_control',{conversationId:'qa-chat-a',command:'restart'});
              check(TeachingBoard.read().elements.length===6,'Review cleared old sections');
              send('teacher_control',{conversationId:'qa-chat-a',command:'next'});
              q('#teacher-close').click();
              const missing=Teacher.dispatch({method:'teacher_step',params:{caption:'Unsafe',actions:[]},origin:{source:'mcp'}});check(!missing.ok,'Missing identity wrote into current board');q('#teacher-close').click();
              check(send('teacher_read',{conversationId:'qa-chat-b'}).board.elements.length===1,'Chat B changed unexpectedly');
              send('teacher_read',{conversationId:'qa-chat-a'});
            ",delegate{form.ClientSize=new System.Drawing.Size(800,600);stage=6;});
            else if(stage==6&&!restore)Check(Setup+@"
              const nav=q('#teacher-navigation').getBoundingClientRect(),zoom=q('.bottom-left').getBoundingClientRect();
              check(nav.left>zoom.right,'Navigation overlaps zoom at minimum window size');
              const dock=q('#teacher-dock').getBoundingClientRect();check(dock.left>=0&&dock.right<=innerWidth,'Practice dock clipped');
              check(q('#teacher-answer').getBoundingClientRect().width>=80,'Answer input too small');
            ",delegate{stage=7;});
            else if(stage==7&&!restore)Shot("small-window",delegate{stage=99;timer.Stop();form.Close();});
            else if(stage==1&&restore)Check(Setup+@"
              check(q('#teacher-panel').hidden,'Reopening forced teacher panel open');
              const a=send('teacher_read',{conversationId:'qa-chat-a'});check(a.boardId===localStorage.getItem('qa-a'),'Reopening lost chat mapping');
              check(a.responses[1].answer==='To the right'&&a.responses[1].hintUsed,'Reopening lost answers');
              check(a.board.elements.length===6&&a.board.elements.some(e=>e.id==='student-ink'),'Reopening lost editable drawings');
              const b=send('teacher_read',{conversationId:'qa-chat-b'});check(b.board.elements.length===1&&b.board.elements[0].id==='b-only','Second saved chat lost');
              send('teacher_read',{conversationId:'qa-chat-a'});
              send('teacher_step',{conversationId:'qa-chat-a',caption:'Continue after reopening.',pageBreak:true,actions:[{op:'add',element:{id:'resumed',type:'text',x:55,y:40,text:'Continued after reopening',fontSize:28}}]});
              check(TeachingBoard.read().elements.length===7,'Continuation failed after reopening');
            ",delegate{stage=99;timer.Stop();form.Close();});
        }catch(Exception e){Fail(e.ToString());}
    }
}
