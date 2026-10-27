using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;

// Small local-only static host. Compiled once by Windows PowerShell at installation.
// No Node.js, npm, administrator rights, or remote server is needed at login.
public static class QuickNote {
    const int Port = 43827;
    const string Origin = "http://localhost:43827";
    const string Identity = "QuickNote-local-host-v1";
    static string Root = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app");
    static string Edge;

    [STAThread]
    public static void Main() {
        try {
            Edge = FindEdge();
            if (Healthy()) { OpenNote(); return; }
            using (var mutex = new Mutex(false, "Local\\QuickNote.LocalHost.v1")) {
                bool acquired;
                try { acquired = mutex.WaitOne(0); } catch (AbandonedMutexException) { acquired = true; }
                if (!acquired) {
                    for (int i = 0; i < 50; i++) { Thread.Sleep(100); if (Healthy()) { OpenNote(); return; } }
                    throw new Exception("QuickNote is already starting. Please try again in a moment.");
                }
                try {
                    if (!File.Exists(Path.Combine(Root, "index.html"))) throw new Exception("App files are missing. Run Install.cmd again.");
                    var listener = new TcpListener(IPAddress.Loopback, Port);
                    listener.Start();
                    // Serve before opening Edge; only loopback connections are accepted.
                    ThreadPool.QueueUserWorkItem(delegate { try { OpenNote(); } catch (Exception e) { ShowError(e); } });
                    while (true) {
                        var client = listener.AcceptTcpClient();
                        ThreadPool.QueueUserWorkItem(delegate { Serve(client); });
                    }
                } finally { mutex.ReleaseMutex(); }
            }
        } catch (Exception e) { ShowError(e); }
    }
    static void ShowError(Exception error) {
        MessageBox.Show(error.Message, "QuickNote", MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }
    static string FindEdge() {
        foreach (var folder in new [] {Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)}) {
            var path = Path.Combine(folder, "Microsoft", "Edge", "Application", "msedge.exe");
            if (File.Exists(path)) return path;
        }
        throw new Exception("Microsoft Edge is required. Install Edge and run QuickNote again.");
    }
    static void OpenNote() {
        Process.Start(new ProcessStartInfo(Edge, "--app=" + Origin + "/?sticky=auto --window-size=360,380") { UseShellExecute = false });
    }
    static bool Healthy() {
        try {
            var request = (HttpWebRequest)WebRequest.Create(Origin + "/__quicknote_health");
            request.Proxy = null; request.Timeout = 600; request.ReadWriteTimeout = 600;
            using (var response = request.GetResponse()) using (var reader = new StreamReader(response.GetResponseStream())) return reader.ReadToEnd() == Identity;
        } catch { return false; }
    }
    static void Serve(TcpClient client) {
        using (client) {
            try {
                client.ReceiveTimeout = 3000; client.SendTimeout = 3000;
                using (var stream = client.GetStream()) {
                    var bytes = new MemoryStream(); int value; int end = 0;
                    while (bytes.Length < 16384 && (value = stream.ReadByte()) != -1) {
                        bytes.WriteByte((byte)value);
                        end = (end << 8) | value;
                        if (end == 0x0d0a0d0a) break;
                    }
                    if (end != 0x0d0a0d0a) { Reply(stream, 400, "text/plain", Encoding.UTF8.GetBytes("Bad request")); return; }
                    var headers = Encoding.ASCII.GetString(bytes.ToArray()).Split(new [] {"\r\n"}, StringSplitOptions.None);
                    var first = headers[0].Split(' ');
                    bool validHost = false;
                    foreach (var line in headers) if (line.StartsWith("Host:", StringComparison.OrdinalIgnoreCase)) validHost = line.Substring(5).Trim().Equals("localhost:" + Port, StringComparison.OrdinalIgnoreCase);
                    if (!validHost) { Reply(stream, 403, "text/plain", new byte[0]); return; }
                    if (first.Length != 3 || first[0] != "GET" || !first[1].StartsWith("/")) { Reply(stream, 405, "text/plain", new byte[0]); return; }
                    var path = Uri.UnescapeDataString(first[1].Split('?')[0]);
                    if (path == "/__quicknote_health") { Reply(stream, 200, "text/plain", Encoding.UTF8.GetBytes(Identity)); return; }
                    if (path == "/") path = "/index.html";
                    if (path.IndexOf('\\') >= 0 || path.IndexOf(':') >= 0 || path.IndexOf('\0') >= 0) { Reply(stream, 403, "text/plain", new byte[0]); return; }
                    var file = Path.GetFullPath(Path.Combine(Root, path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar)));
                    if (!file.StartsWith(Path.GetFullPath(Root) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) { Reply(stream, 403, "text/plain", new byte[0]); return; }
                    if (!File.Exists(file)) { Reply(stream, 404, "text/plain", new byte[0]); return; }
                    Reply(stream, 200, Mime(file), File.ReadAllBytes(file));
                }
            } catch (IOException) {} catch (SocketException) {} catch (ArgumentException) {}
        }
    }
    static string Mime(string path) {
        switch(Path.GetExtension(path).ToLowerInvariant()) {
            case ".html": return "text/html; charset=utf-8";
            case ".js": return "text/javascript; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".json": return "application/json";
            case ".webmanifest": return "application/manifest+json";
            case ".svg": return "image/svg+xml";
            case ".png": return "image/png";
            case ".woff2": return "font/woff2";
            default: return "application/octet-stream";
        }
    }
    static void Reply(Stream stream, int code, string mime, byte[] body) {
        var header = Encoding.ASCII.GetBytes("HTTP/1.1 " + code + " " + (code == 200 ? "OK" : "Error") + "\r\nContent-Type: " + mime + "\r\nContent-Length: " + body.Length + "\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n");
        stream.Write(header, 0, header.Length); stream.Write(body, 0, body.Length);
    }
}
