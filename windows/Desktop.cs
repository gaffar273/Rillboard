using System;
using System.IO;
using System.Drawing;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly: AssemblyTitle("Rillboard")]
[assembly: AssemblyProduct("Rillboard")]
[assembly: AssemblyVersion("2.0.0.0")]

// Minimal interop for Microsoft's documented, stable WebView2 COM interfaces.
// Unused methods retain their ABI slots; they are never invoked.
[ComImport, Guid("B96D755E-0319-4E92-A296-23436F46A1FC"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IWebEnvironment {
    [PreserveSig] int CreateController(IntPtr parent, IControllerReady callback);
}
[ComImport, Guid("4D00C0D1-9434-4EB6-8078-8697A560334F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IWebController {
    [PreserveSig] int GetVisible(out int value);
    [PreserveSig] int SetVisible(int value);
    [PreserveSig] int GetBounds(out NativeRect value);
    [PreserveSig] int SetBounds(NativeRect value);
    [PreserveSig] int GetZoomFactor(out double value);
    [PreserveSig] int SetZoomFactor(double value);
    void Slot06(); void Slot07(); void Slot08();
    [PreserveSig] int MoveFocus(int reason);
    void Slot10(); void Slot11(); void Slot12(); void Slot13(); void Slot14(); void Slot15();
    void Slot16(); void Slot17(); void Slot18(); void Slot19();
    [PreserveSig] int NotifyParentPosition();
    [PreserveSig] int Close();
    [PreserveSig] int GetWebView(out IWebView value);
}
[ComImport, Guid("76ECEACB-0462-4D94-AC83-423A6793775E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IWebView {
    [PreserveSig] int GetSettings(out IWebSettings value);
    [PreserveSig] int GetSource([MarshalAs(UnmanagedType.LPWStr)] out string uri);
    [PreserveSig] int Navigate([MarshalAs(UnmanagedType.LPWStr)] string uri);
    void Slot03(); void Slot04(); void Slot05(); void Slot06(); void Slot07();
    void Slot08(); void Slot09(); void Slot10(); void Slot11();
    [PreserveSig] int AddNavigationCompleted(INavigationDone callback, out long token);
    void Slot13();
    void Slot14(); void Slot15(); void Slot16(); void Slot17(); void Slot18(); void Slot19();
    void Slot20(); void Slot21(); void Slot22(); void Slot23(); void Slot24(); void Slot25();
    [PreserveSig] int ExecuteScript([MarshalAs(UnmanagedType.LPWStr)] string script, IScriptDone callback);
    [PreserveSig] int CapturePreview(int format, System.Runtime.InteropServices.ComTypes.IStream stream, ICaptureDone callback);
    void Slot28();
    [PreserveSig] int PostJson([MarshalAs(UnmanagedType.LPWStr)] string json);
    void Slot30();
    [PreserveSig] int AddMessage(IMessageReceived callback, out long token);
    void Slot32();
    [PreserveSig] int CallDevToolsProtocolMethod([MarshalAs(UnmanagedType.LPWStr)] string method, [MarshalAs(UnmanagedType.LPWStr)] string parameters, IPdfDone callback);
    void Slot34(); void Slot35(); void Slot36(); void Slot37();
    void Slot38(); void Slot39(); void Slot40(); void Slot41(); void Slot42(); void Slot43(); void Slot44(); void Slot45();
    [PreserveSig] int AddHostObjectToScript([MarshalAs(UnmanagedType.LPWStr)] string name, [In, MarshalAs(UnmanagedType.Struct)] ref object value);
}

[ComVisible(true), Guid("5C4889F0-5EF6-4C5A-952C-D8F1B92D0574"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPdfDone {
    [PreserveSig] int Invoke(int error, [MarshalAs(UnmanagedType.LPWStr)] string result);
}
[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class PdfDone : IPdfDone {
    public Action<int,string> Complete;
    public int Invoke(int error,string result){ Complete(error,result);return 0; }
}
[ComImport, Guid("E562E4F0-D7FA-43AC-8D71-C05150499F00"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IWebSettings {
    void Slot00(); void Slot01(); void Slot02(); void Slot03();
    void Slot04(); void Slot05(); void Slot06(); void Slot07();
    void Slot08(); void Slot09(); void Slot10(); void Slot11();
    void Slot12(); void Slot13();
    [PreserveSig] int GetZoomControlEnabled(out int value);
    [PreserveSig] int SetZoomControlEnabled(int value);
}

[ComVisible(true), Guid("18D0C851-4110-46DF-B676-B379D7977C48"), InterfaceType(ComInterfaceType.InterfaceIsIDispatch)]
public interface IDrawingStorage {
    [DispId(1)] string Read(string key);
    [DispId(2)] void Write(string key, string value);
    [DispId(3)] string ConnectorPath();
}
[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class DrawingStorage : IDrawingStorage {
    readonly string folder;
    public DrawingStorage(string profile) { folder = Path.Combine(profile, "DrawingStorage"); Directory.CreateDirectory(folder); }
    public string ConnectorPath() {
        return Path.Combine(Path.GetDirectoryName(folder), "GPT Teaching", "server.cjs");
    }
    string FileFor(string key) {
        if (key == null || key.Length > 300 || !(key == "rillboard-plugin-teaching" || key == "teaching-client" || key == "teaching-writing" || key == "local-excalidraw-v1" || key == "local-excalidraw-workspace-v1" || key.StartsWith("local-excalidraw-workspace-v1:") || key.StartsWith("elixdraw-teaching-session-v2:") || key.StartsWith("elixdraw-before-scroll:"))) throw new ArgumentException("Invalid drawing storage key.");
        using (var hash = System.Security.Cryptography.SHA256.Create()) {
            return Path.Combine(folder, BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(key))).Replace("-", "") + ".json");
        }
    }
    public string Read(string key) { string file = FileFor(key); return File.Exists(file) ? File.ReadAllText(file, Encoding.UTF8) : null; }
    public void Write(string key, string value) {
        string file = FileFor(key), temporary = file + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try {
            using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None)) {
                byte[] bytes = new UTF8Encoding(false).GetBytes(value);
                stream.Write(bytes, 0, bytes.Length); stream.Flush(true);
            }
            if (File.Exists(file)) File.Replace(temporary, file, null); else File.Move(temporary, file);
        } finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
}
[StructLayout(LayoutKind.Sequential)] public struct NativeRect { public int Left, Top, Right, Bottom; }
[Guid("4E8A3389-C9D8-4BD2-B6B5-124FEE6CC14D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IEnvironmentReady { [PreserveSig] int Invoke(int error, IWebEnvironment environment); }
[Guid("6C4819F3-C9B7-4260-8127-C9F5BDE7F68C"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IControllerReady { [PreserveSig] int Invoke(int error, IWebController controller); }
[Guid("49511172-CC67-4BCA-9923-137112F4C4CC"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IScriptDone { [PreserveSig] int Invoke(int error, [MarshalAs(UnmanagedType.LPWStr)] string result); }
[Guid("697E05E9-3D8F-45FA-96F4-8FFE1EDEDA0D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface ICaptureDone { [PreserveSig] int Invoke(int error); }
[Guid("D33A35BF-1C49-4F98-93AB-006E0533FE1C"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface INavigationDone { [PreserveSig] int Invoke(IWebView sender, INavigationArgs args); }
[ComImport, Guid("30D68B7D-20D9-4752-A9CA-EC8448FBB5C1"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface INavigationArgs {
    [PreserveSig] int GetSuccess(out int success);
    [PreserveSig] int GetError(out int error);
}
[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class NavigationDone : INavigationDone {
    internal Action<INavigationArgs> Callback;
    public int Invoke(IWebView sender, INavigationArgs args) { Callback(args); return 0; }
}
[Guid("57213F19-00E6-49FA-8E07-898EA01ECBD2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMessageReceived { [PreserveSig] int Invoke(IWebView sender, IMessageArgs args); }
[ComImport, Guid("0F99A40C-E962-4207-9E92-E3D542EFF849"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMessageArgs {
    [PreserveSig] int GetSource([MarshalAs(UnmanagedType.LPWStr)] out string source);
    void Slot01();
    [PreserveSig] int GetString([MarshalAs(UnmanagedType.LPWStr)] out string message);
}
[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class EnvironmentReady : IEnvironmentReady {
    internal Action<int, IWebEnvironment> Callback;
    public int Invoke(int error, IWebEnvironment value) { Callback(error, value); return 0; }
}
[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class ControllerReady : IControllerReady {
    internal Action<int, IWebController> Callback;
    public int Invoke(int error, IWebController value) { Callback(error, value); return 0; }
}
[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class ScriptDone : IScriptDone {
    internal Action<int, string> Callback;
    public int Invoke(int error, string value) { if (Callback != null) Callback(error, value); return 0; }
}
[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class MessageReceived : IMessageReceived {
    internal Action<IMessageArgs> Callback;
    public int Invoke(IWebView sender, IMessageArgs args) { Callback(args); return 0; }
}

[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class TeacherCapture : ICaptureDone {
    internal Action<int> Callback;
    public int Invoke(int error) { Callback(error); return 0; }
}

sealed class DrawingWindow : Form {
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("shlwapi.dll", CharSet = CharSet.Unicode)]
    static extern int SHCreateStreamOnFileEx(string path, int mode, int attributes, bool create, System.Runtime.InteropServices.ComTypes.IStream template, out System.Runtime.InteropServices.ComTypes.IStream stream);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr LoadLibrary(string path);
    [DllImport("WebView2Loader.dll", CharSet = CharSet.Unicode)]
    static extern int CreateCoreWebView2EnvironmentWithOptions(string browserFolder, string userDataFolder, IntPtr options, IEnvironmentReady callback);

    readonly string dataFolder;
    readonly Label loading;
    readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 48 * 1024 * 1024 };
    IWebController controller;
    IWebView webview;
    EnvironmentReady environmentReady;
    ControllerReady controllerReady;
    MessageReceived messageReceived;
    ScriptDone closeDone;
    NavigationDone navigationDone;
    bool canClose, closing;
    Timer closeTimer;
    string appUri;
    Timer teacherTimer;
    string teacherFolder, teacherSession;
    bool teacherBusy;
    ScriptDone teacherDone;
    TeacherCapture teacherCapture;
    System.Runtime.InteropServices.ComTypes.IStream teacherStream;
    // Injectable picker for isolated integration checks; production always uses the Windows dialog.
    internal Func<SaveFileDialog, DialogResult> SaveDialog;
    internal Func<OpenFileDialog, DialogResult> OpenDialog;

    internal DrawingWindow(string storage) {
        dataFolder = storage;
        Text = "Rillboard";
        Icon = System.Drawing.Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location);
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(1280, 820);
        MinimumSize = new Size(800, 600);
        BackColor = Color.FromArgb(247, 246, 242);
        loading = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter, Text = "Opening your drawing canvas...", Font = new Font("Segoe UI", 14) };
        Controls.Add(loading);
        SaveDialog = delegate(SaveFileDialog dialog) { return dialog.ShowDialog(this); };
        OpenDialog = delegate(OpenFileDialog dialog) { return dialog.ShowDialog(this); };
        Shown += delegate { InitializeCanvas(); };
        Resize += delegate { ResizeCanvas(); };
        Move += delegate { if (controller != null) controller.NotifyParentPosition(); };
        Activated += delegate { if (controller != null) controller.MoveFocus(0); };
        FormClosing += BeforeClose;
        FormClosed += delegate { if (teacherTimer != null) teacherTimer.Stop(); if (controller != null) controller.Close(); };
    }
    void Fail(Exception error) {
        loading.Visible = true;
        loading.Text = "The drawing app could not start.\n\n" + error.Message + "\n\nThis app needs Windows 10/11 (x64), .NET Framework 4.8,\nand Microsoft Edge WebView2 Runtime.\n\nWebView2 Runtime: developer.microsoft.com/microsoft-edge/webview2/";
        loading.BringToFront();
    }
    void InitializeCanvas() {
        try {
            string content = Path.Combine(dataFolder, "Application");
            Directory.CreateDirectory(content);
            Assembly assembly = Assembly.GetExecutingAssembly();
            foreach (string name in new[] { "index.html", "styles.css", "india-boundary.js", "perfect-freehand.js", "shapes.js", "geometry.js", "device-storage.js", "workspace-store.js", "board-pdf.js", "app.js", "plugins.js", "teacher.css", "teacher-core.js", "teacher-store.js", "teacher.js", "icon.svg", "fonts/geist.woff2", "fonts/instrument-serif-italic.woff2", "WebView2Loader.dll" }) {
                using (Stream source = assembly.GetManifestResourceStream("Assets." + name))
                using (var memory = new MemoryStream()) {
                    source.CopyTo(memory);
                    byte[] bytes = memory.ToArray();
                    string target = Path.Combine(content, name);
                    if (!File.Exists(target) || !System.Linq.Enumerable.SequenceEqual(File.ReadAllBytes(target), bytes)) {
                        Directory.CreateDirectory(Path.GetDirectoryName(target));
                        File.WriteAllBytes(target, bytes);
                    }
                }
            }
            if (LoadLibrary(Path.Combine(content, "WebView2Loader.dll")) == IntPtr.Zero) throw new InvalidOperationException("The embedded Windows canvas loader could not be loaded.");
            appUri = new Uri(Path.Combine(content, "index.html")).AbsoluteUri;
            environmentReady = new EnvironmentReady { Callback = delegate(int error, IWebEnvironment environment) {
                try {
                    Marshal.ThrowExceptionForHR(error);
                    controllerReady = new ControllerReady { Callback = delegate(int controllerError, IWebController value) {
                        try {
                            Marshal.ThrowExceptionForHR(controllerError);
                            controller = value;
                            Marshal.ThrowExceptionForHR(controller.GetWebView(out webview));
                            IWebSettings settings;
                            Marshal.ThrowExceptionForHR(webview.GetSettings(out settings));
                            Marshal.ThrowExceptionForHR(settings.SetZoomControlEnabled(0));
                            Marshal.ThrowExceptionForHR(controller.SetZoomFactor(1));
                            object drawingStorage = new DrawingStorage(dataFolder);
                            Marshal.ThrowExceptionForHR(webview.AddHostObjectToScript("drawingStorage", ref drawingStorage));
                            messageReceived = new MessageReceived { Callback = OnMessage };
                            long token;
                            Marshal.ThrowExceptionForHR(webview.AddMessage(messageReceived, out token));
                            navigationDone = new NavigationDone { Callback = delegate(INavigationArgs navigation) {
                                int success, status;
                                navigation.GetSuccess(out success);
                                if (success != 0) { loading.Visible = false;  ShowWindow(Handle, 5); }
                                else { navigation.GetError(out status); Fail(new InvalidOperationException("The offline canvas could not load (status " + status + "). Please close and reopen the app.")); }
                            }};
                            Marshal.ThrowExceptionForHR(webview.AddNavigationCompleted(navigationDone, out token));
                            ResizeCanvas();
                            controller.SetVisible(1);
                            Marshal.ThrowExceptionForHR(webview.Navigate(appUri));
                            controller.MoveFocus(0);
                        } catch (Exception ex) { Fail(ex); }
                    }};
                    Marshal.ThrowExceptionForHR(environment.CreateController(Handle, controllerReady));
                } catch (Exception ex) { Fail(ex); }
            }};
            Marshal.ThrowExceptionForHR(CreateCoreWebView2EnvironmentWithOptions(null, Path.Combine(dataFolder, "Profile"), IntPtr.Zero, environmentReady));
        } catch (Exception ex) { Fail(ex); }
    }
    void ResizeCanvas() {
        if (controller != null) controller.SetBounds(new NativeRect { Top = 0, Right = ClientSize.Width, Bottom = ClientSize.Height });
    }
    void ConfigureTeacherBridge(bool enabled) {
        if (teacherTimer != null) { teacherTimer.Stop(); teacherTimer.Dispose(); teacherTimer = null; }
        teacherFolder = Path.Combine(dataFolder, "TeacherBridge");
        Directory.CreateDirectory(teacherFolder);
        if (enabled) {
            string plugin = Path.Combine(dataFolder, "GPT Teaching");
            Directory.CreateDirectory(plugin);
            foreach(string name in new[] { "server.cjs", "client.cjs" })
                using(var source = Assembly.GetExecutingAssembly().GetManifestResourceStream("Plugin." + name))
                using(var output = File.Create(Path.Combine(plugin, name))) source.CopyTo(output);
            File.WriteAllText(Path.Combine(plugin,"launcher.json"), json.Serialize(Application.ExecutablePath));
        }
        teacherSession = Guid.NewGuid().ToString("N");
        string descriptor = Path.Combine(teacherFolder, "session.json");
        string temporary = descriptor + ".tmp";
        File.WriteAllText(temporary, json.Serialize(new { session = teacherSession, pid = System.Diagnostics.Process.GetCurrentProcess().Id, version = 1, enabled = enabled }), new UTF8Encoding(false));
        if (File.Exists(descriptor)) File.Replace(temporary, descriptor, null); else File.Move(temporary, descriptor);
        if (!enabled) return;
        teacherTimer = new Timer { Interval = 150 };
        teacherTimer.Tick += delegate { PollTeacher(); };
        teacherTimer.Start();
    }
    void TeacherReply(string id, string value) {
        try {
            string target = Path.Combine(teacherFolder, id + ".response.json"), temporary = target + ".tmp";
            File.WriteAllText(temporary, value, new UTF8Encoding(false));
            if (File.Exists(target)) File.Replace(temporary, target, null); else File.Move(temporary, target);
        } finally { teacherBusy = false; }
    }
    void TeacherError(string id, string error) { TeacherReply(id, json.Serialize(new { ok = false, error = error })); }
    void CaptureTeacher(string id) {
        string png = Path.Combine(teacherFolder, id + ".png");
        try {
            Marshal.ThrowExceptionForHR(SHCreateStreamOnFileEx(png, 0x1001, 0, true, null, out teacherStream));
            teacherCapture = new TeacherCapture { Callback = delegate(int status) { BeginInvoke(new Action(delegate {
                try {
                    if (teacherStream != null) { Marshal.ReleaseComObject(teacherStream); teacherStream = null; }
                    Marshal.ThrowExceptionForHR(status);
                    TeacherReply(id, json.Serialize(new { ok = true, result = new { mimeType = "image/png", data = Convert.ToBase64String(File.ReadAllBytes(png)) } }));
                } catch (Exception ex) { TeacherError(id, ex.Message); }
                finally { if (File.Exists(png)) File.Delete(png); }
            })); }};
            Marshal.ThrowExceptionForHR(webview.CapturePreview(0, teacherStream, teacherCapture));
        } catch (Exception ex) { TeacherError(id, ex.Message); }
    }
    void PollTeacher() {
        if (teacherBusy || closing || webview == null) return;
        string requestId = null;
        try {
            foreach (string file in Directory.GetFiles(teacherFolder, "*.request.json")) {
                string id = Path.GetFileName(file).Replace(".request.json", "");
                Guid parsed;
                if (!Guid.TryParseExact(id, "N", out parsed)) continue;
                requestId = id;
                if (new FileInfo(file).Length > 2 * 1024 * 1024) { File.Delete(file); TeacherError(id, "Request exceeds 2 MB."); return; }
                string body = File.ReadAllText(file);
                File.Delete(file); // Claim exactly once; stale commands are never replayed on restart.
                var request = json.Deserialize<Dictionary<string, object>>(body);
                if (!request.ContainsKey("session") || Convert.ToString(request["session"]) != teacherSession) { TeacherError(id, "The board session changed. Reconnect before sending commands."); return; }
                double now = (DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds;
                if (!request.ContainsKey("expires") || Convert.ToDouble(request["expires"]) < now) { TeacherError(id, "Request expired before execution."); return; }
                string method = Convert.ToString(request["method"]);
                if (method != "teacher_read" && method != "teacher_start" && method != "teacher_step" && method != "teacher_control" && method != "teacher_snapshot") { TeacherError(id, "Unknown teacher tool."); return; }
                teacherBusy = true;
                if (method == "teacher_start") { ShowWindow(Handle, 9); SetForegroundWindow(Handle); }
                webview.PostJson(json.Serialize(new { type = "teacher-activity", method = method, origin = request.ContainsKey("origin") ? request["origin"] : null }));
                {
                    teacherDone = new ScriptDone { Callback = delegate(int status, string value) {
                        if (status < 0) TeacherError(id, "The canvas could not run the command.");
                        else if (method == "teacher_snapshot" && value != "null") {
                            try {
                                var result = json.Deserialize<Dictionary<string, object>>(value);
                                if (result.ContainsKey("ok") && Convert.ToBoolean(result["ok"])) CaptureTeacher(id);
                                else TeacherReply(id, value);
                            } catch (Exception ex) { TeacherError(id, ex.Message); }
                        }
                        else TeacherReply(id, value == "null" ? "{\"ok\":false,\"error\":\"Teacher board is not ready.\"}" : value);
                    }};
                    // Only this fixed dispatcher executes. Request content is JSON data, never source code.
                    string script = "window.Teacher ? window.Teacher.dispatch(" + json.Serialize(request) + ") : null";
                    Marshal.ThrowExceptionForHR(webview.ExecuteScript(script, teacherDone));
                }
                return;
            }
        } catch (Exception ex) { teacherBusy = false; if (requestId != null) TeacherError(requestId, ex.Message); }
    }
    void Reply(string id, bool saved, string name, string error) {
        if (webview != null) webview.PostJson(json.Serialize(new { type = "save-result", id = id, saved = saved, name = name, error = error }));
    }
    void OnMessage(IMessageArgs args) {
        string source, message;
        if (args.GetSource(out source) < 0 || !String.Equals(source, appUri, StringComparison.OrdinalIgnoreCase) || args.GetString(out message) < 0) return;
        // Return from WebView2's callback before entering a native modal message loop.
        BeginInvoke(new Action(delegate { SaveMessage(message); }));
    }
    PdfDone pdfJob;
    void PrintPdf(string id, string target, double width, double height) {
        if(pdfJob != null) throw new InvalidOperationException("A PDF export is already running.");
        if(!(width >= 100 && width <= 500 && height >= 100 && height <= 500)) throw new InvalidDataException("Invalid paper size.");
        string options=json.Serialize(new {printBackground=true,preferCSSPageSize=true,displayHeaderFooter=false,
            paperWidth=width/25.4,paperHeight=height/25.4,marginLeft=0,marginRight=0,marginTop=0,marginBottom=0});
        pdfJob=new PdfDone { Complete=delegate(int status,string result) {
            try {
                Marshal.ThrowExceptionForHR(status);
                var data=json.Deserialize<Dictionary<string,object>>(result);
                WriteExport(target,Convert.FromBase64String(Convert.ToString(data["data"])));
                Reply(id,true,Path.GetFileName(target),null);
            } catch(Exception ex){Reply(id,false,null,"PDF export failed. "+ex.Message);}
            finally {pdfJob=null;}
        }};
        int hr=webview.CallDevToolsProtocolMethod("Page.printToPDF",options,pdfJob);
        if(hr<0){pdfJob=null;Marshal.ThrowExceptionForHR(hr);}
    }
    static void WriteExport(string target, byte[] bytes) {
        string temporary=target+"."+Guid.NewGuid().ToString("N")+".tmp";
        try {
            File.WriteAllBytes(temporary,bytes);
            if(File.Exists(target))File.Replace(temporary,target,null);else File.Move(temporary,target);
        } finally {if(File.Exists(temporary))File.Delete(temporary);}
    }
    void SaveMessage(string message) {
        string id = null;
        try {
            var data = json.Deserialize<Dictionary<string, object>>(message);
            if (Convert.ToString(data["type"]) == "quit") { Close(); return; }
            if (Convert.ToString(data["type"]) == "teaching-plugin") {
                string failure = null;
                try { ConfigureTeacherBridge(Convert.ToBoolean(data["enabled"])); }
                catch(Exception ex) { failure = ex.Message; }
                webview.PostJson(json.Serialize(new { type = "teaching-plugin-result", error = failure }));
                return;
            }
            if (Convert.ToString(data["type"]) == "focus-chatgpt") {
                bool found = false;
                foreach (var process in System.Diagnostics.Process.GetProcessesByName("ChatGPT")) {
                    if (process.MainWindowHandle == IntPtr.Zero) continue;
                    ShowWindow(process.MainWindowHandle, 9); SetForegroundWindow(process.MainWindowHandle); found = true; break;
                }
                webview.PostJson(json.Serialize(new { type = "chatgpt-focus-result", error = found ? null : "Open ChatGPT on Windows, then ask your question in the chat with elixdraw-teacher connected." }));
                return;
            }
            if (Convert.ToString(data["type"]) == "open") { OpenDrawing(); return; }
            bool pdf=Convert.ToString(data["type"])=="print-pdf";
            if (!pdf && Convert.ToString(data["type"]) != "save") return;
            id = Convert.ToString(data["id"]);
            string filename = Path.GetFileName(Convert.ToString(data["name"]));
            string extension = Path.GetExtension(filename).ToLowerInvariant();
            if (pdf ? extension!=".pdf" : extension != ".excalidraw" && extension != ".png" && extension != ".svg" && !(extension == ".json" && id == "teacher-lesson")) throw new InvalidDataException("Unsupported export format.");
            using (var dialog = new SaveFileDialog()) {
                dialog.Title = "Save your drawing";
                dialog.FileName = filename;
                dialog.DefaultExt = extension.TrimStart('.');
                dialog.Filter = pdf ? "PDF document|*.pdf" : extension == ".json" ? "Teacher lesson|*.json" : extension == ".png" ? "PNG image|*.png" : extension == ".svg" ? "SVG image|*.svg" : "Excalidraw drawing|*.excalidraw";
                dialog.AddExtension = true;
                dialog.OverwritePrompt = true;
                if (SaveDialog(dialog) != DialogResult.OK) { Reply(id, false, null, null); return; }
                if(pdf){PrintPdf(id,dialog.FileName,Convert.ToDouble(data["width"]),Convert.ToDouble(data["height"]));return;}
                WriteExport(dialog.FileName,Convert.FromBase64String(Convert.ToString(data["base64"])));
                Text = Path.GetFileNameWithoutExtension(dialog.FileName) + " | Rillboard";
                Reply(id, true, Path.GetFileName(dialog.FileName), null);
            }
        } catch (Exception ex) { Reply(id, false, null, ex.Message); }
    }
    void OpenDrawing() {
        try {
            using (var dialog = new OpenFileDialog()) {
                dialog.Title = "Open a drawing";
                dialog.Filter = "Excalidraw drawings|*.excalidraw;*.json|All files|*.*";
                dialog.CheckFileExists = true;
                dialog.Multiselect = false;
                if (OpenDialog(dialog) != DialogResult.OK) return;
                if (new FileInfo(dialog.FileName).Length > 25 * 1024 * 1024) throw new InvalidDataException("Please choose a drawing file smaller than 25 MB.");
                string text = File.ReadAllText(dialog.FileName, Encoding.UTF8);
                webview.PostJson(json.Serialize(new { type = "open-result", name = Path.GetFileName(dialog.FileName), text = text }));
            }
        } catch (Exception ex) { MessageBox.Show(this, ex.Message, "Could not open drawing", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
        if (controller != null) controller.MoveFocus(0);
    }
    void BeforeClose(object sender, FormClosingEventArgs args) {
        if (canClose || webview == null) return;
        args.Cancel = true;
        if (closing) return;
        closing = true;
        // Finish active text/ink and flush autosave before destroying the canvas.
        closeDone = new ScriptDone { Callback = delegate {
            BeginInvoke(new Action(delegate { canClose = true; if (closeTimer != null) closeTimer.Stop(); Close(); }));
        }};
        closeTimer = new Timer { Interval = 2500 };
        closeTimer.Tick += delegate { closeTimer.Stop(); canClose = true; Close(); };
        closeTimer.Start();
        webview.ExecuteScript("window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('beforeunload'));", closeDone);
    }
}

static class Program {
    [STAThread]
    static void Main(string[] args) {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CraftSketchDesktop");
        // Isolated storage for build verification; normal users always use the persistent profile.
        if (args.Length == 2 && args[0] == "--data-dir") data = Path.GetFullPath(args[1]);
        string mutexId;
        using (var hash = System.Security.Cryptography.SHA256.Create()) mutexId = BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(data.ToLowerInvariant()))).Replace("-", "");
        bool first;
        using (var mutex = new System.Threading.Mutex(true, "Local\\CraftSketchDesktop-" + mutexId, out first)) {
            if (!first) { MessageBox.Show("Rillboard is already open. Switch to its window on the taskbar.", "Rillboard"); return; }
            Application.Run(new DrawingWindow(data));
        }
    }
}
