// capri-mem: Capri's value finder for offline games (the Cheat Engine idea, kept small).
// Reads JSON-ish commands, one per line, on stdin; answers one JSON line each on stdout.
//   attach <pid>            the game (refused when it has an anti-cheat)
//   scan <int|float> <v>    every address holding v
//   next <v>                of those, the ones holding v now
//   set <v>                 write v to what's left (only when few are left)
//   reset
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;

static class CapriMem {
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll")] static extern bool ReadProcessMemory(IntPtr h, IntPtr addr, byte[] buf, IntPtr size, out IntPtr read);
  [DllImport("kernel32.dll")] static extern bool WriteProcessMemory(IntPtr h, IntPtr addr, byte[] buf, IntPtr size, out IntPtr written);
  [DllImport("kernel32.dll")] static extern IntPtr VirtualQueryEx(IntPtr h, IntPtr addr, out MBI info, IntPtr size);
  [DllImport("kernel32.dll")] static extern bool IsWow64Process(IntPtr h, out bool wow);

  [StructLayout(LayoutKind.Sequential)]
  struct MBI { public IntPtr Base; public IntPtr AllocBase; public uint AllocProtect; public uint Pad1; public IntPtr Size; public uint State; public uint Protect; public uint Type; public uint Pad2; }

  const uint MEM_COMMIT = 0x1000, PAGE_GUARD = 0x100, PAGE_NOACCESS = 0x01;
  const uint WRITABLE = 0x04 | 0x08 | 0x40 | 0x80; // RW, WC, XRW, XWC
  const int MAX_HITS = 20000000;
  const int MAX_SET = 30;

  // what online games ship with: these are never touched
  static readonly string[] ANTI_CHEAT = { "easyanticheat", "beclient", "battleye", "bedaisy", "vgk", "vanguard", "xigncode", "nprotect", "gameguard", "ricochet", "faceit", "esea", "punkbuster", "mhyprot", "ace-base", "tersafe", "equ8", "hackshield" };
  static readonly string[] ONLINE = { "valorant", "league of legends", "leagueclient", "cs2", "csgo", "fortniteclient", "r5apex", "overwatch", "pubg", "tslgame", "destiny2", "rainbowsix", "dota2", "eldenring_online", "genshinimpact", "zenlesszonezero", "starrail", "robloxplayerbeta", "rocketleague", "escapefromtarkov", "warframe", "dbd", "deadbydaylight", "thefinals", "marvelrivals", "rust", "fallguys", "apex", "naraka", "bf2042", "cod", "modernwarfare", "blackops", "gta5_enhanced", "playgtav" };

  static IntPtr handle = IntPtr.Zero;
  static int pid;
  static string kind = "int";
  static List<long> hits = null;

  static void Main() {
    Console.OutputEncoding = new UTF8Encoding(false);
    string line;
    while ((line = Console.ReadLine()) != null) {
      string answer;
      try { answer = Run(line.Trim()); }
      catch (Exception e) { answer = Fail(e.Message); }
      Console.WriteLine(answer);
      Console.Out.Flush();
    }
  }

  static string Esc(string s) { return s.Replace("\\", "\\\\").Replace("\"", "\\\""); }
  static string Ok(string msg, int count = -1) { return "{\"ok\":true,\"message\":\"" + Esc(msg) + "\"" + (count >= 0 ? ",\"count\":" + count : "") + "}"; }
  static string Fail(string msg) { return "{\"ok\":false,\"error\":\"" + Esc(msg) + "\"}"; }

  static string Run(string line) {
    var parts = line.Split(new[] { ' ' }, 3, StringSplitOptions.RemoveEmptyEntries);
    if (parts.Length == 0) return Fail("empty");
    switch (parts[0]) {
      case "attach": return Attach(int.Parse(parts[1]));
      case "scan":
        if (parts.Length < 3) return Fail("scan <int|float> <value>");
        kind = parts[1] == "float" ? "float" : "int";
        return Scan(parts[2]);
      case "next": return Next(parts[1]);
      case "set": return Set(parts[1]);
      case "reset": hits = null; return Ok("cleared");
      default: return Fail("unknown command");
    }
  }

  static string Blocked(Process p) {
    string name = p.ProcessName.ToLowerInvariant();
    foreach (var o in ONLINE) if (name == o || name.StartsWith(o)) return p.ProcessName + " is an online game";
    string dir = "";
    try { dir = Path.GetDirectoryName(p.MainModule.FileName); } catch { return "can't look inside " + p.ProcessName + " (it may be protected)"; }
    try { foreach (ProcessModule m in p.Modules) { var mn = m.ModuleName.ToLowerInvariant(); foreach (var a in ANTI_CHEAT) if (mn.Contains(a)) return p.ProcessName + " runs an anti-cheat (" + m.ModuleName + ")"; } } catch { }
    // the game's folder and the one above it
    foreach (var d in new[] { dir, Path.GetDirectoryName(dir), Path.GetDirectoryName(Path.GetDirectoryName(dir) ?? "") }) {
      if (string.IsNullOrEmpty(d) || !Directory.Exists(d)) continue;
      try {
        foreach (var e in Directory.EnumerateFileSystemEntries(d)) {
          var en = Path.GetFileName(e).ToLowerInvariant();
          foreach (var a in ANTI_CHEAT) if (en.Contains(a)) return p.ProcessName + " ships with an anti-cheat (" + Path.GetFileName(e) + ")";
        }
      } catch { }
    }
    foreach (var a in ANTI_CHEAT) if (Process.GetProcesses().Any(q => q.ProcessName.ToLowerInvariant().Contains(a) && a != "vgk" && a != "vanguard")) return "an anti-cheat is running (" + a + "): close the online game first";
    return null;
  }

  static string Attach(int id) {
    if (handle != IntPtr.Zero) { CloseHandle(handle); handle = IntPtr.Zero; }
    hits = null;
    var p = Process.GetProcessById(id);
    var why = Blocked(p);
    if (why != null) return Fail(why);
    handle = OpenProcess(0x0010 | 0x0020 | 0x0008 | 0x0400, false, id); // VM_READ | VM_WRITE | VM_OPERATION | QUERY_INFORMATION
    if (handle == IntPtr.Zero) return Fail("Windows won't let me open " + p.ProcessName + " (run Capri as administrator for this game)");
    pid = id;
    return Ok("attached to " + p.ProcessName);
  }

  static byte[] Bytes(string v) {
    if (kind == "float") return BitConverter.GetBytes(float.Parse(v, System.Globalization.CultureInfo.InvariantCulture));
    return BitConverter.GetBytes(int.Parse(v));
  }

  static bool Matches(byte[] buf, int i, byte[] want, float fwant) {
    if (kind == "float") { float f = BitConverter.ToSingle(buf, i); return Math.Abs(f - fwant) < 0.5f; }
    return buf[i] == want[0] && buf[i + 1] == want[1] && buf[i + 2] == want[2] && buf[i + 3] == want[3];
  }

  static string Scan(string v) {
    if (handle == IntPtr.Zero) return Fail("no game attached");
    var want = Bytes(v);
    float fwant = kind == "float" ? BitConverter.ToSingle(want, 0) : 0;
    var found = new List<long>();
    long addr = 0;
    MBI m;
    var size = (IntPtr)Marshal.SizeOf(typeof(MBI));
    while (VirtualQueryEx(handle, (IntPtr)addr, out m, size) != IntPtr.Zero) {
      long len = m.Size.ToInt64();
      if (len <= 0) break;
      if (m.State == MEM_COMMIT && (m.Protect & WRITABLE) != 0 && (m.Protect & (PAGE_GUARD | PAGE_NOACCESS)) == 0) {
        const int CHUNK = 1 << 20;
        for (long off = 0; off < len; off += CHUNK) {
          int n = (int)Math.Min(CHUNK, len - off);
          var buf = new byte[n];
          IntPtr read;
          if (!ReadProcessMemory(handle, (IntPtr)(m.Base.ToInt64() + off), buf, (IntPtr)n, out read)) continue;
          int got = read.ToInt32();
          for (int i = 0; i + 4 <= got; i += 4) {
            if (Matches(buf, i, want, fwant)) {
              found.Add(m.Base.ToInt64() + off + i);
              if (found.Count >= MAX_HITS) { hits = found; return Ok("too many matches: change the value in the game, then tell me the new one", found.Count); }
            }
          }
        }
      }
      addr = m.Base.ToInt64() + len;
    }
    hits = found;
    return Ok(found.Count + " places hold " + v, found.Count);
  }

  static string Next(string v) {
    if (hits == null) return Fail("scan first");
    var want = Bytes(v);
    float fwant = kind == "float" ? BitConverter.ToSingle(want, 0) : 0;
    var buf = new byte[4];
    var keep = new List<long>();
    foreach (var a in hits) {
      IntPtr read;
      if (ReadProcessMemory(handle, (IntPtr)a, buf, (IntPtr)4, out read) && read.ToInt32() == 4 && Matches(buf, 0, want, fwant)) keep.Add(a);
    }
    hits = keep;
    return Ok(keep.Count + " left", keep.Count);
  }

  static string Set(string v) {
    if (hits == null || hits.Count == 0) return Fail("nothing found yet");
    if (hits.Count > MAX_SET) return Fail(hits.Count + " places still match: change the value in the game and tell me the new one, until only a few are left");
    var bytes = Bytes(v);
    int done = 0;
    foreach (var a in hits) {
      IntPtr written;
      if (WriteProcessMemory(handle, (IntPtr)a, bytes, (IntPtr)4, out written)) done++;
    }
    return Ok("set " + done + " of " + hits.Count + " to " + v, done);
  }
}
