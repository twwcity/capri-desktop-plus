param([int]$GamePid, [string]$File, [int]$ChatKey = 0x54)
# Types commands into Minecraft's chat, one per line of $File: $ChatKey (your chat key in the game's
# settings, T unless you changed it) opens the chat, the command is typed
# letter by letter as Unicode characters (whatever the keyboard layout, Thai included, and without the
# clipboard), Enter runs it. Works the same in Java and Bedrock. If the game wasn't in front (you were
# typing to her), its pause screen is up: Esc closes it first.
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public class K {
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx, dy; public uint data, flags, time; public IntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort vk, scan; public uint flags, time; public IntPtr extra; }
  [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION u; }
  [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern uint MapVirtualKey(uint code, uint type);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr SetFocus(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr SetActiveWindow(IntPtr h);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  // Windows only lets the window in front hand the focus over: this joins its input for a moment
  // (and the Alt tap counts as a key pressed here), so the game can be brought to the front.
  public static bool Front(IntPtr h) {
    for (int attempt = 0; attempt < 4; attempt++) {
      IntPtr fg = GetForegroundWindow();
      if (fg == h) return true;
      uint dummy;
      uint fgThread = GetWindowThreadProcessId(fg, out dummy);
      uint gameThread = GetWindowThreadProcessId(h, out dummy);
      uint me = GetCurrentThreadId();
      keybd_event(0x12, 0, 0, UIntPtr.Zero); keybd_event(0x12, 0, 2, UIntPtr.Zero);
      AttachThreadInput(me, fgThread, true);
      AttachThreadInput(gameThread, fgThread, true);
      if (IsIconic(h)) ShowWindow(h, 9);
      BringWindowToTop(h);
      SetForegroundWindow(h);
      SetActiveWindow(h);
      SetFocus(h);
      AttachThreadInput(gameThread, fgThread, false);
      AttachThreadInput(me, fgThread, false);
      System.Threading.Thread.Sleep(150 + attempt * 150);
      if (GetForegroundWindow() == h) return true;
    }
    return false;
  }
  static void Send(ushort vk, ushort scan, uint flags) {
    var i = new INPUT[1];
    i[0].type = 1;
    i[0].u.ki = new KEYBDINPUT { vk = vk, scan = scan, flags = flags };
    SendInput(1, i, Marshal.SizeOf(typeof(INPUT)));
  }
  // a key, with both its virtual key and its scan code (the game wants the key, not just the scan code)
  public static void Tap(byte vk) {
    ushort scan = (ushort)MapVirtualKey(vk, 0);
    Send(vk, scan, 0); System.Threading.Thread.Sleep(40); Send(vk, scan, 0x0002);
  }
  public static void Hold(byte vk, bool down) { Send(vk, (ushort)MapVirtualKey(vk, 0), down ? 0u : 0x0002u); }
  // text as Unicode characters: what the chat box takes, whatever the layout
  public static void Type(string text) {
    foreach (char c in text) {
      Send(0, c, 0x0004); Send(0, c, 0x0004 | 0x0002);
      System.Threading.Thread.Sleep(6);
    }
  }
}
"@
function Out-Json($o) { $o | ConvertTo-Json -Compress }
# what happened, step by step, for when it doesn't work (%TEMP%\capri-mc.log, the last run only)
$trace = Join-Path $env:TEMP 'capri-mc.log'
function Trace($s) { Add-Content -LiteralPath $trace -Value ("{0:HH:mm:ss.fff} {1}" -f (Get-Date), $s) -Encoding UTF8 }
Set-Content -LiteralPath $trace -Value "pid=$GamePid file=$File" -Encoding UTF8
$proc = Get-Process -Id $GamePid -ErrorAction SilentlyContinue
if (-not $proc -or $proc.MainWindowHandle -eq [IntPtr]::Zero) { Out-Json @{ ok = $false; error = 'Minecraft is not running' }; exit }
$h = $proc.MainWindowHandle
$lines = @(Get-Content -LiteralPath $File -Encoding UTF8 | Where-Object { $_ })

$fgPid = [uint32]0
[void][K]::GetWindowThreadProcessId([K]::GetForegroundWindow(), [ref]$fgPid)
Trace "lines=$($lines.Count) foreground=$fgPid game window=$h"
if ($fgPid -ne $GamePid) {
  $front = [K]::Front($h)
  $now = [uint32]0; [void][K]::GetWindowThreadProcessId([K]::GetForegroundWindow(), [ref]$now)
  Trace "brought to front: $front (foreground now $now)"
  if (-not $front) { Out-Json @{ ok = $false; error = 'Windows wouldn''t let me bring Minecraft to the front: click the game once, then ask me again.' }; exit }
  # back in front, the game takes a moment to put up its pause screen and grab the mouse again
  Start-Sleep -Milliseconds 900
  [K]::Tap(0x1B)  # Esc: off its pause screen
  Start-Sleep -Milliseconds 700
}

$n = 0
foreach ($line in $lines) {
  [K]::Tap([byte]$ChatKey)  # your chat key: the chat
  Start-Sleep -Milliseconds 350
  # emptied first: the chat keeps what was left typed in it, and with a Thai keyboard the T that
  # opened it also typed "ะ" (Ctrl+A, then Backspace)
  [K]::Hold(0x11, $true); [K]::Tap(0x41); [K]::Hold(0x11, $false)
  Start-Sleep -Milliseconds 40
  [K]::Tap(0x08)
  Start-Sleep -Milliseconds 40
  [K]::Type($line)
  Trace "typed: $line"
  # the game takes the letters in a frame at a time: Enter too soon and it isn't all there yet
  Start-Sleep -Milliseconds (450 + 6 * $line.Length)
  [K]::Tap(0x0D)  # Enter
  Start-Sleep -Milliseconds 400
  $n++
}
Out-Json @{ ok = $true; sent = $n }
