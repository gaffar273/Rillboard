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
                    stage = 1;
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
                    window.TeachingBoard.create('Untitled');
                    window.TeachingBoard.show(Array.from({length:6},(_,i)=>window.Board.sanitizeElement({type:'rectangle',x:40+i*90,y:160,w:65,h:70})),null);


                    document.querySelector('button[data-tool=lasso]').click();
                    const emit=(target,type,x,y,buttons)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:19,pointerType:'mouse',button:0,buttons,clientX:r.left+x,clientY:r.top+y}));
                    emit(canvas,'pointerdown',25,140,1);emit(canvas,'pointermove',300,140,1);emit(canvas,'pointermove',300,250,1);emit(canvas,'pointermove',25,250,1);emit(canvas,'pointerup',25,140,0);
                    check(!!document.querySelector('[data-handle=rotate]'),'lasso failed to select '+JSON.stringify({view:window.TeachingBoard.read().view,tool:canvas.dataset.tool,selection:document.querySelector('#selection').innerHTML,active:window.Teacher.state().active}));
                    const beforeMove=window.TeachingBoard.read().elements;
                    emit(canvas,'pointerdown',115,200,1);emit(canvas,'pointermove',135,220,1);emit(canvas,'pointerup',135,220,0);
                    check(window.TeachingBoard.read().elements.filter((e,i)=>e.x!==beforeMove[i].x).length===3,'multi-selection did not move all three objects');
                    document.querySelector('#undo-button').click();
                    document.querySelector('button[data-tool=select]').click();
                    const penSelect=(type,x,y,buttons)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:20,pointerType:'pen',button:0,buttons,clientX:r.left+x,clientY:r.top+y}));
                    penSelect('pointerdown',25,140,1);penSelect('pointermove',300,250,1);penSelect('pointerup',300,250,0);
                    check(window.TeachingBoard.read().elements.length===6,'explicit pen selection drew ink');
                    const handle=document.querySelector('[data-handle=rotate]'),hr=handle.getBoundingClientRect();
                    emit(handle,'pointerdown',hr.x+hr.width/2-r.x,hr.y+hr.height/2-r.y,1);
                    emit(canvas,'pointermove',180,220,1);emit(canvas,'pointerup',180,220,0);
                    check(window.TeachingBoard.read().elements.some(e=>Math.abs(e.angle||0)>.1),'rotation gesture failed');
                    document.querySelector('#undo-button').click();
                    check(window.TeachingBoard.read().elements.every(e=>!e.angle),'rotation undo failed');
                    document.querySelector('[data-pen=highlighter]').click();check(!document.querySelector('select#pen-style'),'pen dropdown still present');
                    document.querySelector('button[data-tool=pencil]').click();
                    emit(canvas,'pointerdown',300,320,1);emit(canvas,'pointermove',360,320,1);emit(canvas,'pointerup',380,320,0);
                    check(window.TeachingBoard.read().elements.at(-1).penStyle==='highlighter','pen preset failed');
                    document.querySelector('button[data-tool=graphpaper]').click();
                    emit(canvas,'pointerdown',700,500,1);emit(canvas,'pointermove',300,250,1);emit(canvas,'pointerup',300,250,0);
                    const paper=window.TeachingBoard.read().elements.at(-1);
                    check(paper.type==='graphpaper'&&Math.abs(paper.w)===400&&Math.abs(paper.h)===250,'drag paper dimensions failed');
                    check(!!document.querySelector('#scene pattern'),'paper grid not rendered');
                    document.querySelector('#undo-button').click();check(!window.TeachingBoard.read().elements.some(e=>e.type==='graphpaper'),'paper undo failed');
                    document.querySelector('#redo-button').click();check(window.TeachingBoard.read().elements.at(-1).type==='graphpaper','paper redo failed');
                    window.TeachingBoard.create('Untitled');
                    document.querySelector('[data-action=graph]').click();
                    const mode=document.querySelector('#graph-mode'),expr=document.querySelector('#graph-expression');
                    for(const [m,value] of [['implicit','x^2+y^2=25'],['parametric','5*cos(t); 3*sin(t)'],['polar','5*cos(3*theta)'],['cartesian','sin(x)\ncos(x)']]){
                      mode.value=m;mode.dispatchEvent(new Event('change'));expr.value=value;document.querySelector('#graph-preview-button').click();
                      check(!document.querySelector('#graph-error').textContent,'graph mode '+m+' failed');check(!!document.querySelector('#graph-preview svg'),'preview missing for '+m);
                    }

                    check(document.querySelector('#graph-dialog').open,'public graph dialog missing');
                    document.querySelector('#graph-expression').value='sin(x)\ncos(x)';
                    document.querySelector('#graph-form').requestSubmit();
                    check(!document.querySelector('#graph-dialog').open,'graph insertion failed: '+document.querySelector('#graph-error').textContent);
                    check(window.TeachingBoard.read().elements.some(e=>e.type==='pencil'),'graph curve missing');
                    document.querySelector('button[data-tool=select]').click();
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
                    passed.Add("Multi-object lasso and pen marquee, group movement and rotation, icon presets, drag graph paper, all four graph modes, preview and insertion; existing teaching and storage checks");
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
                    Script("document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.activeElement.blur();window.dispatchEvent(new Event('beforeunload'));document.querySelector('[data-action=graph]').click();true", delegate { });
                });
            } else if (stage == 5) {
                stage = 99; busy = true;
                Marshal.ThrowExceptionForHR(SHCreateStreamOnFileEx(Path.Combine(folder, "desktop-canvas.png"), 0x1001, 0, true, null, out pngStream));
                capture = new CheckCapture { Done = delegate(int error) {
                    Marshal.ReleaseComObject(pngStream); pngStream = null;
                    busy = false;
                    if (error < 0) { Fail("Canvas capture failed: " + error); return; }
                    passed.Add("Captured actual Windows WebView2 renderer");
                    form.BeginInvoke(new Action(delegate { form.Close(); }));
                }};
                Marshal.ThrowExceptionForHR(webview.CapturePreview(0, pngStream, capture));
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
                    stage = 99;
                    form.BeginInvoke(new Action(delegate { form.Close(); }));
                });
            }
        } catch (Exception ex) { Fail(ex.ToString()); }
    }
    static string[] ReadLabels() {
        var labels = new System.Collections.Generic.List<string>();
        foreach (Control control in form.Controls) if (control is Label) labels.Add(control.Text);
        return labels.ToArray();
    }
}
