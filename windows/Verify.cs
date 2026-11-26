using System;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class CheckScript : IScriptDone {
    public Action<int, string> Done;
    public int Invoke(int error, string result) { Done(error, result); return 0; }
}
[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class CheckCapture : ICaptureDone {
    public Action<int> Done;
    public int Invoke(int error) { Done(error); return 0; }
}
static class DesktopCheck {
    [DllImport("shlwapi.dll", CharSet = CharSet.Unicode)]
    static extern int SHCreateStreamOnFileEx(string path, int mode, int attributes, bool create, IStream template, out IStream stream);
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    static readonly BindingFlags Private = BindingFlags.NonPublic | BindingFlags.Instance;
    static string folder, failure;
    static Form form;
    static IWebView webview;
    static Timer timer;
    static CheckScript callback;
    static CheckCapture capture;
    static IStream pngStream;
    static int stage, ticks, expectedElements;
    static bool busy, cancelSave, cancelOpen, restoring;
    static readonly System.Collections.Generic.List<string> passed = new System.Collections.Generic.List<string>();

    [STAThread]
    static int Main(string[] args) {
        folder = Path.GetFullPath(args[0]);
        Directory.CreateDirectory(folder);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Run(false);
        if (failure == null) Run(true);
        File.WriteAllText(Path.Combine(folder, "desktop-verification.json"), Json.Serialize(new { success = failure == null, checks = passed, error = failure, executable = typeof(IWebView).Assembly.Location }));
        Console.WriteLine(failure == null ? "PASS: " + String.Join("; ", passed) : "FAIL: " + failure);
        return failure == null ? 0 : 1;
    }
    static void Run(bool restore) {
        restoring = restore; stage = 0; ticks = 0; busy = false;
        Type type = typeof(IWebView).Assembly.GetType("DrawingWindow");
        form = (Form)Activator.CreateInstance(type, Private, null, new object[] { Path.Combine(folder, "profile") }, null);
        form.ShowInTaskbar = false;
        form.Opacity = 1;
        type.GetField("SaveDialog", Private).SetValue(form, new Func<SaveFileDialog, DialogResult>(delegate(SaveFileDialog dialog) {
            if (cancelSave) return DialogResult.Cancel;
            dialog.FileName = Path.Combine(folder, Path.GetFileName(dialog.FileName));
            return DialogResult.OK;
        }));
        type.GetField("OpenDialog", Private).SetValue(form, new Func<OpenFileDialog, DialogResult>(delegate(OpenFileDialog dialog) {
            if (cancelOpen) return DialogResult.Cancel;
            dialog.FileName = Path.Combine(folder, "Untitled.excalidraw");
            return DialogResult.OK;
        }));
        timer = new Timer { Interval = 300 };
        timer.Tick += Tick;
        form.Shown += delegate { timer.Start(); };
        form.FormClosed += delegate { timer.Stop(); };
        Application.Run(form);
    }
    static void Fail(string message) {
        failure = message;
        timer.Stop();
        form.Close();
    }
    static void ClickMenu(string command) {
        Script("(()=>{const b=document.querySelector(\"#main-menu [data-action=\u0027"+command+"\u0027]\");if(!b)throw Error(command);document.querySelector(\u0027#menu-button\u0027).click();const details=b.closest(\u0027details\u0027);if(details)details.open=true;b.click();})()", delegate {});
    }
    static void Script(string source, Action<string> done) {
        busy = true;
        callback = new CheckScript { Done = delegate(int error, string value) {
            busy = false;
            try { if (error < 0) Marshal.ThrowExceptionForHR(error); done(value); }
            catch (Exception ex) { Fail(ex.ToString()); }
        }};
        int status = webview.ExecuteScript(source, callback);
        if (stage == 0 && status == unchecked((int)0x8007139F)) { busy = false; return; }
        Marshal.ThrowExceptionForHR(status);
    }
    static void Capture(string imageName, string check, Action done) {
        stage = 99; busy = true;
        Marshal.ThrowExceptionForHR(SHCreateStreamOnFileEx(Path.Combine(folder, imageName), 0x1001, 0, true, null, out pngStream));
        capture = new CheckCapture { Done = delegate(int error) {
            Marshal.ReleaseComObject(pngStream); pngStream = null;
            busy = false;
            if (error < 0) { Fail("Canvas capture failed: " + error); return; }
            passed.Add(check);
            form.BeginInvoke(done);
        }};
        Marshal.ThrowExceptionForHR(webview.CapturePreview(0, pngStream, capture));
    }
    static void Tick(object sender, EventArgs args) {
        if (++ticks > 80) { string source = null; if (webview != null) webview.GetSource(out source); Fail("Timed out in stage " + stage + ", source=" + source + ": " + String.Join(" | ", ReadLabels())); return; }
        if (busy) return;
        try {
            webview = (IWebView)form.GetType().GetField("webview", Private).GetValue(form);
            if (webview == null) return;
            if (stage == 0) {
                Script("(()=>{if(document.readyState!=='complete'||!window.Board)return false;if(window.Teacher)return true;const b=document.querySelector('#plugin-toggle');if(b&&!b.disabled)b.click();return false})()", delegate(string result) {
                    if (result != "true") return;
                    if (restoring) { stage = 6; return; }
                    if (form.MainMenuStrip != null) throw new Exception("Window still displays native menus");
                    NativeRect bounds;
                    var controller = (IWebController)form.GetType().GetField("controller", Private).GetValue(form);
                    Marshal.ThrowExceptionForHR(controller.GetBounds(out bounds));
                    if (bounds.Top != 0 || bounds.Bottom != form.ClientSize.Height) throw new Exception("Canvas overlaps native menu");
                    passed.Add("Windows form initialized with embedded offline canvas");
                    stage = 22;
                });
            } else if (stage == 1) {
                Script(@"(()=>{try{
                    const check=(v,m)=>{if(!v)throw Error(m)};
                    document.querySelectorAll('dialog[open]').forEach(d=>d.close());
                    check(!!window.chrome.webview,'native bridge missing');
                    check(!!window.WorkspaceStore,'embedded board storage missing');
                    const legacyKey='elixdraw-before-scroll:qa-migration';
                    localStorage.setItem(legacyKey,'legacy drawing');
                    check(window.DrawingStorage.getItem(legacyKey)==='legacy drawing','legacy migration failed');
                    localStorage.setItem(legacyKey,'stale copy');
                    check(window.DrawingStorage.getItem(legacyKey)==='legacy drawing','native value overwritten by stale browser copy');
                    const large='x'.repeat(6*1024*1024);
                    window.DrawingStorage.setItem('elixdraw-before-scroll:qa-large',large);
                    check(window.DrawingStorage.getItem('elixdraw-before-scroll:qa-large')===large,'large disk save failed');
                    check(!document.body.innerText.includes('GitHub'),'GitHub UI present');
                    document.querySelector('[data-action=boards]').click();
                    check(document.querySelector('#boards-dialog').open,'board manager failed');
                    check(document.querySelectorAll('[data-board-open]').length===1,'initial board missing');
                    document.querySelector('#boards-dialog').close();
                    check(document.querySelector('.toolbar').getBoundingClientRect().width>400,'toolbar missing');
                    document.querySelector('#library-button').click();
                    check(!document.querySelector('#library-panel').hidden,'library failed');
                    document.querySelector('[data-action=close-library]').click();
                    check(!!window.Teacher&&!document.querySelector('#teacher-demo'),'live teaching UI missing or canned lesson present');
                    check(!document.querySelector('[data-action=sample]'),'sample drawing UI still present');
                    window.Teacher.start({title:'Native live test',steps:[]});
                    window.Teacher.append({caption:'Live command',actions:[{op:'add',element:{id:'native-shape',type:'rectangle',x:60,y:80,w:120,h:80}}]});
                    const lessonBoard=window.TeachingBoard.read().id;
                    document.querySelector('#teacher-edit').click();
                    const canvas=document.querySelector('#canvas'),r=canvas.getBoundingClientRect();
                    const pointer=(type,x,y,buttons)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:7,pointerType:'pen',isPrimary:true,button:0,buttons,clientX:r.left+x,clientY:r.top+y}));
                    pointer('pointerdown',300,300,1);pointer('pointermove',330,320,1);pointer('pointerup',350,310,0);
                    const ink=window.TeachingBoard.read().elements.find(e=>e.type==='pencil');check(!!ink,'student handwriting missing');
                    window.Teacher.append({caption:'Continue with the student notes',actions:[{op:'update',id:'native-shape',changes:{stroke:'#1971c2'}}]});
                    check(window.TeachingBoard.read().elements.some(e=>e.id===ink.id),'continuing erased student handwriting');
                    document.querySelector('#teacher-receive').click();
                    const blocked=window.Teacher.dispatch({method:'teacher_step',params:{caption:'Blocked',actions:[]}});check(!blocked.ok,'student pause did not block writes');
                    document.querySelector('#teacher-receive').click();
                    document.querySelector('#teacher-export').click();
                    window.TeachingBoard.create('Other board');
                    check(window.TeachingBoard.read().elements.length===0,'new board inherited old elements');
                    document.querySelector('[data-action=boards]').click();
                    document.querySelector('[data-board-open='+lessonBoard+']').click();
                    check(window.TeachingBoard.read().elements.some(e=>e.id===ink.id),'switching boards lost annotations');
                    check(window.Teacher.state().title==='Native live test','switching boards lost lesson timeline');
                    window.Teacher.start({title:'Continuous scroll regression',steps:[]});
                    let previousIds=[],firstZoom;
                    for(let p=1;p<=6;p++){
                      const additions=[0,1,2].map(i=>({id:'page'+p+'_'+i,type:'text',x:60,y:60+i*180,text:'Section '+p+' / line '+i,fontSize:28}));
                      window.Teacher.append({caption:'Section '+p,actions:[...previousIds.map(id=>({op:'remove',id})),...additions.map(element=>({op:'add',element}))]});
                      previousIds=additions.map(e=>e.id);
                      if(p===1)firstZoom=window.TeachingBoard.read().view.zoom;
                    }
                    const longBoard=window.TeachingBoard.read();
                    check(longBoard.elements.length===18,'six sections erased earlier pages');
                    check(longBoard.view.zoom===firstZoom,'long lesson shrank the writing');
                    check(longBoard.view.y<-1500,'new sections did not scroll down');
                    const oldY=longBoard.view.y;
                    canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:-400,bubbles:true,cancelable:true}));
                    check(window.TeachingBoard.read().view.y>oldY,'mouse wheel cannot scroll during teaching');
                    check(window.Teacher.state().active,'scrolling detached the teacher');
                    check(getComputedStyle(canvas).pointerEvents!=='none','canvas blocks actual wheel input');
                    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));
                    check(window.TeachingBoard.read().view.y===window.Teacher.canvasArea().top,'Home failed to reach earlier writing');
                    check(window.TeachingBoard.read().elements.length===18,'scrolling removed content');
                    window.Teacher.control('back');window.Teacher.control('restart');
                    check(window.TeachingBoard.read().elements.length===18,'review removed already written pages');
                    document.querySelector('#teacher-latest').click();
                    check(window.TeachingBoard.read().view.y<-1500,'latest writing failed to return down the board');
                    window.Teacher.control('next');
                    check(document.querySelector('#scene [data-element=page6_0]').textContent==='Section 6 / line 0','review blanked already written text to animate it again');
                    window.TeachingBoard.create('Drawing tools');
                    const choose=tool=>{
                      document.querySelector('#shapes-button').click();
                      const dialog=document.querySelector('#shapes-dialog');
                      check(dialog.open,'Shapes picker did not open');
                      const button=dialog.querySelector('[data-tool='+tool+']');
                      check(button?.getBoundingClientRect().height>0,'Missing shape '+tool);
                      button.click();
                      check(!dialog.open && canvas.dataset.tool===tool,'Shape tool failed '+tool);
                    };
                    const drag=(x,y,dx,dy)=>{
                      pointer('pointerdown',x,y,1);pointer('pointermove',x+dx,y+dy,1);pointer('pointerup',x+dx,y+dy,0);
                    };
                    choose('line');drag(250,160,90,0);drag(250,190,90,0);
                    choose('circle');drag(440,280,-56,-23);
                    choose('tetragonal');drag(230,300,80,100);
                    choose('orthorhombic');drag(390,320,100,70);
                    choose('triangle');drag(530,320,70,60);
                    const scene=document.querySelector('#scene');
                    document.querySelector('.toolbar [data-tool=pencil]').click();
                    const firstBeforeInk=scene.firstElementChild;
                    drag(500,240,18,7);drag(520,245,15,-6);
                    check(firstBeforeInk===scene.firstElementChild,'Handwriting rebuilt completed drawing nodes');
                    const drawn=window.TeachingBoard.read().elements;
                    check(drawn.map(e=>e.type).join(',')==='line,line,ellipse,tetragonal,orthorhombic,triangle,pencil,pencil','Incorrect drawn objects');
                    check(drawn[2].w===drawn[2].h && drawn[2].w<0,'Reverse drag distorted circle');
                    check(drawn.slice(3,5).every(e=>scene.querySelector('[data-element='+e.id+'] [stroke-dasharray]')),'Missing hidden crystal edges');
                    window.TeachingBoard.create('Untitled');
                    window.TeachingBoard.show(drawn,null);
                    const count=document.querySelector('#scene').children.length;
                    check(count>5,'test shapes did not draw');
                    document.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true}));
                    check(document.querySelector('#scene').children.length===0,'undo failed');
                    document.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,shiftKey:true,bubbles:true}));
                    check(document.querySelector('#scene').children.length===count,'redo failed');
                    document.querySelector('[data-action=history]').click();
                    document.querySelector('[data-action=save-version]').click();
                    check(document.querySelectorAll('[data-restore-version]').length>0,'native version history failed');
                    document.querySelector('#history-dialog').close();
                    window.__checkMessages=[];
                    window.chrome.webview.addEventListener('message',e=>window.__checkMessages.push(e.data));
                    return {ok:true,count};
                    }catch(error){return {error:error.message,stack:error.stack};}
                })()", delegate(string result) {
                    var data = Json.Deserialize<System.Collections.Generic.Dictionary<string, object>>(result);
                    if (data == null || !data.ContainsKey("ok")) throw new Exception("Canvas checks failed: " + result);
                    expectedElements = Convert.ToInt32(data["count"]);
                    passed.Add("Shape picker, repeated lines, circle proportions, crystal cell edges and incremental native ink");
                    passed.Add("Live teaching UI, student ink preservation, pause control, board switching, history, undo and redo");
                    stage = 7;
                    ClickMenu("undo");
                });
            } else if (stage == 2) {
                if (!File.Exists(Path.Combine(folder, "Untitled.excalidraw"))) return;
                var drawing = Json.Deserialize<System.Collections.Generic.Dictionary<string, object>>(File.ReadAllText(Path.Combine(folder, "Untitled.excalidraw")));
                if (Convert.ToString(drawing["type"]) != "excalidraw") throw new Exception("Native save did not create editable drawing JSON");
                passed.Add("App file menu saves editable UTF-8 drawing through Windows Save As");
                if (!File.Exists(Path.Combine(folder, "Native live test.lesson.json"))) throw new Exception("Native lesson save did not create a replayable file");
                passed.Add("Lesson timeline exports through native Windows Save As");
                stage = 3;
                Script("document.querySelector('#export-button').click();document.querySelector('[data-action=export-svg]').click();document.querySelector('[data-action=export-png]').click();true", delegate { });
            } else if (stage == 3) {
                if (!File.Exists(Path.Combine(folder, "Untitled.svg")) || !File.Exists(Path.Combine(folder, "Untitled.png"))) return;
                if (!File.ReadAllText(Path.Combine(folder, "Untitled.svg")).Contains("<svg")) throw new Exception("Invalid SVG export");
                byte[] png = File.ReadAllBytes(Path.Combine(folder, "Untitled.png"));
                if (png.Length < 100 || png[0] != 137 || png[1] != 80 || png[2] != 78 || png[3] != 71) throw new Exception("Invalid PNG export");
                passed.Add("PNG and SVG export through Windows host");
                cancelSave = true; stage = 4;
                Script("document.querySelector('#file-name').value='Cancelled';document.querySelector('[data-action=save]').click();true", delegate { });
            } else if (stage == 4) {
                Script("window.__checkMessages.some(e=>e.type==='save-result' && e.saved===false && !e.error)", delegate(string result) {
                    if (result != "true") return;
                    if (File.Exists(Path.Combine(folder, "Cancelled.excalidraw"))) throw new Exception("Cancelled save wrote a file");
                    passed.Add("Cancelling native save writes no file and preserves canvas");
                    stage = 5;
                    Script("document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.activeElement.blur();window.dispatchEvent(new Event('beforeunload'));true", delegate { });
                });
            } else if (stage == 5) {
                Capture("desktop-canvas.png", "Captured actual Windows WebView2 renderer", form.Close);
            } else if (stage == 6) {
                Script("({count:document.querySelector('#scene').children.length,stored:JSON.parse(window.DrawingStorage.getItem('local-excalidraw-v1')).elements.length})", delegate(string result) {
                    var data = Json.Deserialize<System.Collections.Generic.Dictionary<string, object>>(result);
                    if (Convert.ToInt32(data["count"]) != expectedElements || Convert.ToInt32(data["stored"]) != expectedElements) throw new Exception("Autosaved canvas was not restored: " + result);
                    passed.Add("Canvas survives closing and reopening the Windows app");
                    stage = 9;
                    Script("document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelector('[data-action=new]').click();document.querySelector('[data-action=confirm-new]').click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'o',ctrlKey:true,bubbles:true}));true", delegate { });
                });
            } else if (stage == 7) {
                Script("document.querySelector('#scene').children.length", delegate(string result) {
                    if (Convert.ToInt32(result) != 0) return;
                    stage = 8;
                    ClickMenu("redo");
                });
            } else if (stage == 8) {
                Script("document.querySelector('#scene').children.length", delegate(string result) {
                    if (Convert.ToInt32(result) != expectedElements) return;
                    passed.Add("App menu controls undo and redo canvas changes without overlapping the drawing area");
                    stage = 2;
                    ClickMenu("save");
                });
            } else if (stage == 9) {
                Script("document.querySelector('#scene').children.length", delegate(string result) {
                    if (Convert.ToInt32(result) != expectedElements) return;
                    passed.Add("Ctrl O opens saved drawing through native Windows Open dialog");
                    cancelOpen = true;
                    stage = 10;
                    Script("document.dispatchEvent(new KeyboardEvent('keydown',{key:'o',ctrlKey:true,bubbles:true}));true", delegate { });
                });
            } else if (stage == 10) {
                Script("document.querySelector('#scene').children.length", delegate(string result) {
                    if (Convert.ToInt32(result) != expectedElements) throw new Exception("Cancelling native Open changed the drawing");
                    passed.Add("Cancelling native Open preserves the drawing");
                    stage = 11;
                    ClickMenu("help");
                });
            } else if (stage == 11) {
                Script("document.querySelector('#help-dialog').open", delegate(string result) {
                    if (result != "true") return;
                    passed.Add("App help menu opens keyboard shortcuts");
                    cancelSave=false;
                    stage=12;
                });
            } else if(stage==12){
                Script(@"(()=>{try{
                    const q=s=>document.querySelector(s);
                    q('#help-dialog').close();TeachingBoard.create('PDF check');
                    TeachingBoard.show([
                      {id:'label',type:'text',x:0,y:0,text:'First section',fontSize:22},
                      {id:'middle',type:'text',x:0,y:515,text:'Middle section',fontSize:22},
                      {id:'last',type:'text',x:0,y:1030,text:'Last section',fontSize:22},
                      {id:'cross',type:'line',x:0,y:35,w:300,h:1015,stroke:'#187569',strokeWidth:3},
                      {id:'erasetest',type:'line',x:0,y:70,w:150,h:0}
                    ].map(Board.sanitizeElement),null);
                    const canvas=q('#canvas'),rect=canvas.getBoundingClientRect(),view=TeachingBoard.read().view;
                    const tap=(x,y)=>{for(const type of ['pointerdown','pointerup'])canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:31,pointerType:'mouse',button:0,buttons:type==='pointerdown'?1:0,clientX:rect.left+view.x+x*view.zoom,clientY:rect.top+view.y+y*view.zoom}));};
                    q('[data-tool=pencil]').click();
                    const visible=key=>!q('[data-property='+key+']').hidden;
                    if(!visible('pen')||visible('fill')||visible('text'))throw Error('Ink controls mismatch');
                    q('[data-tool=rectangle]').click();
                    if(!visible('fill')||visible('pen'))throw Error('Shape controls mismatch');
                    q('[data-tool=eraser]').click();
                    if(q('#eraser-options').hidden||visible('opacity')||!q('#properties').contains(q('#eraser-mode'))||!q('#eraser-size').hidden)throw Error('Eraser panel mismatch');
                    if(!q('#eraser-mode input[value=object]').checked)throw Error('Object mode should start selected');
                    tap(80,70);
                    if(TeachingBoard.read().elements.some(el=>el.id==='erasetest'))throw Error('Object erase failed');
                    q('#undo-button').click();
                    q('#eraser-mode input[value=area] + span').click();
                    if(!q('#eraser-size').hidden)throw Error('Area mode should hide brush sizes');
                    const areaEvent=(type,x,y)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:32,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:rect.left+view.x+x*view.zoom,clientY:rect.top+view.y+y*view.zoom}));
                    areaEvent('pointerdown',170,85);areaEvent('pointermove',-5,60);
                    if(TeachingBoard.read().elements.length!==5)throw Error('Area changed before release');
                    areaEvent('pointerup',-5,60);
                    if(TeachingBoard.read().elements.length!==4||TeachingBoard.read().elements.some(el=>el.id==='erasetest'))throw Error('Area containment failed');
                    q('#undo-button').click();q('#eraser-mode input[value=brush] + span').click();
                    if(q('#eraser-size').hidden||!q('#eraser-size input[value=""20""]').checked)throw Error('Brush sizes should open with the 20 px setting selected');
                    const defaultCursor=canvas.style.cursor;
                    q('#eraser-size input[value=""40""] + span').click();
                    if(!q('#eraser-size input[value=""40""]').checked||!defaultCursor||canvas.style.cursor===defaultCursor)throw Error('Brush size did not update the canvas cursor');
                    tap(80,70);
                    if(TeachingBoard.read().elements.length!==6)throw Error('Brush did not split line');
                    q('#undo-button').click();if(TeachingBoard.read().elements.length!==5)throw Error('Brush undo failed');
                    q('[data-tool=select]').click();tap(10,10);if(!visible('text')||visible('width')||!visible('layers'))throw Error('Selected text controls mismatch');
                    q('#font-face').value='serif';q('#font-face').dispatchEvent(new Event('change'));
                    for(const b of document.querySelectorAll('[data-format]'))b.click();
                    const label=TeachingBoard.read().elements[0];
                    if(label.fontFace!=='serif'||!label.bold||!label.italic||!label.underline)throw Error('Typeface formatting missing');
                    q('#export-button').click();q('#file-name').value='Paginated';q('[data-action=pdf-options]').click();
                    if(q('#pdf-count').textContent!=='Page 1 of 3')throw Error(q('#pdf-count').textContent);
                    q('#pdf-save').click();return 'ok';
                }catch(e){return e.message}})()",delegate(string result){if(result!="\"ok\"")throw new Exception("PDF setup "+result);stage=13;});
            } else if(stage==13){
                Script("document.querySelector('#pdf-status').textContent",delegate(string result){
                    if(result=="\"\"")return;
                    if(!File.Exists(Path.Combine(folder,"Paginated.pdf")))throw new Exception(result);
                    stage=14;
                    Script("document.querySelector('#file-name').value='Selected pages';document.querySelector('#pdf-pages').value='1,3';document.querySelector('#pdf-pages').dispatchEvent(new Event('input'));document.querySelector('#pdf-save').click();true",delegate{});
                });
            } else if(stage==14){
                if(!File.Exists(Path.Combine(folder,"Selected pages.pdf")))return;
                passed.Add("Brush split and undo, text formatting, A4 PDF and selected-page export");
                stage=15;
                Script("document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelector('[data-tool=eraser]').click();true", delegate {});
            } else if(stage==15){
                Capture("eraser-panel.png", "Captured the eraser panel in Windows WebView2", delegate { stage=16; });
            } else if(stage==16){
                StyleCheck(@"
                    TeachingBoard.create('Drawing styles');
                    q('.toolbar [data-tool=rectangle]').click();
                    if(q('#style-toggle').getAttribute('aria-expanded')!=='true')q('#style-toggle').click();
                    q('#stroke-colors [data-color=""#1971c2""]').click();
                    q('#fill-colors [data-color=""#a5d8ff""]').click();
                    q('#fill-options [data-fill=solid]').click();
                    q('#width-options [data-width=""4""]').click();
                    pointer('pointerdown',480,260);
                    pointer('pointermove',650,345);
                    pointer('pointerup',650,345);
                    const shape=TeachingBoard.read().elements[0];
                    if(!shape || shape.type!=='rectangle' || shape.fill!=='#a5d8ff' || shape.stroke!=='#1971c2' || shape.strokeWidth!==4 || shape.fillStyle!=='solid')throw Error('Shape controls did not style the drawn rectangle');
                    q('.toolbar [data-tool=rectangle]').click();
                    checkLayout();",17);
            } else if(stage==17){
                Capture("style-shape.png","Styled a rectangle with the shape inspector",delegate { stage=18; });
            } else if(stage==18){
                StyleCheck(@"
                    q('.toolbar [data-tool=pencil]').click();
                    q('#pen-style [data-pen=marker]').click();
                    const opacity=q('#opacity');
                    opacity.value='75';
                    opacity.dispatchEvent(new Event('input',{bubbles:true}));
                    opacity.dispatchEvent(new Event('change',{bubbles:true}));
                    pointer('pointerdown',495,375);
                    pointer('pointermove',535,366);
                    pointer('pointermove',575,377);
                    pointer('pointermove',615,366);
                    pointer('pointerup',638,371);
                    const ink=TeachingBoard.read().elements.find(el=>el.type==='pencil');
                    if(!ink || ink.penStyle!=='marker' || ink.opacity!==75)throw Error('Marker or opacity controls did not style the ink');
                    q('.toolbar [data-tool=pencil]').click();
                    checkLayout();",19);
            } else if(stage==19){
                Capture("style-pen.png","Styled marker ink using the pen and opacity controls",delegate {
                    form.ClientSize=new System.Drawing.Size(840,640);
                    stage=20;
                });
            } else if(stage==20){
                StyleCheck(@"
                    q('#menu-button').click();
                    q('[data-theme=dark]').click();
                    q('.toolbar [data-tool=text]').click();
                    q('#font-face').value='sans';
                    q('#font-face').dispatchEvent(new Event('change',{bubbles:true}));
                    q('#font-options [data-font=""24""]').click();
                    if(!document.body.classList.contains('dark') || q('#font-face').value!=='sans')throw Error('Dark text inspector failed');
                    checkLayout();",21);
            } else if(stage==21){
                Capture("style-text-dark.png","Displayed text controls in a compact dark-mode window",form.Close);
            } else if (stage == 22) {
                Script(@"(() => {
                    if (document.querySelector('#plugin-toggle').disabled) return 'loading';
                    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
                    const fonts = [...document.fonts];
                    if (fonts.some(face => face.status === 'loading')) return 'loading';
                    if (!fonts.some(face => face.family === 'Geist' && face.status === 'loaded') ||
                        !fonts.some(face => face.family === 'Instrument Serif' && face.status === 'loaded')) return 'fonts';
                    const button = document.querySelector('#home-draw');
                    const box = button.getBoundingClientRect();
                    const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
                    return button.contains(target) ? 'ready' : 'button blocked by ' + (target?.id || target?.tagName);
                })()", delegate(string result) {
                    if (result == "\"loading\"") return;
                    if (result != "\"ready\"") throw new Exception("Windows welcome panel verification failed: " + result);
                    Capture("rillboard-home.png", "Captured the welcome panel using its embedded offline fonts", delegate { stage = 1; });
                });
            }
        } catch (Exception ex) { Fail(ex.ToString()); }
    }
    static void StyleCheck(string script,int nextStage) {
        Script(@"(()=>{try{
            const q=selector=>document.querySelector(selector);
            const canvas=q('#canvas');
            const rect=canvas.getBoundingClientRect();
            const pointer=(type,x,y)=>canvas.dispatchEvent(new PointerEvent(type,{
                bubbles:true,pointerId:45,pointerType:'mouse',isPrimary:true,button:0,
                buttons:type==='pointerup'?0:1,clientX:rect.left+x,clientY:rect.top+y
            }));
            const checkLayout=()=>{
                const panel=q('#properties'), bounds=panel.getBoundingClientRect();
                if(!bounds.width || !bounds.height || bounds.left<0 || bounds.right>innerWidth+1 || bounds.bottom>innerHeight+1)throw Error('Style panel fell outside the window');
                if(panel.scrollWidth>panel.clientWidth+1)throw Error('Style panel has horizontal overflow');
                for(const control of panel.querySelectorAll('button,select,input[type=range]')){
                    const r=control.getBoundingClientRect();
                    if(r.width && (r.left<bounds.left-1 || r.right>bounds.right+1))throw Error('Style control extends past panel edge: '+(control.title||control.id||control.textContent));
                }
            };" + script + @"return 'ok';}catch(e){return e.message;}})()",delegate(string result) {
            if(result!="\"ok\"")throw new Exception("Style panel check: "+result);
            stage=nextStage;
        });
    }
    static string[] ReadLabels() {
        var labels = new System.Collections.Generic.List<string>();
        foreach (Control control in form.Controls) if (control is Label) labels.Add(control.Text);
        return labels.ToArray();
    }
}
