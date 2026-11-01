param([string]$Action, [string]$Arg = '', [string]$Pids = '')
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -TypeDefinition @"
using System; using System.Text; using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern IntPtr GetTopWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, int d, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int s);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
"@
$skip = @($Pids -split ',' | Where-Object { $_ } | ForEach-Object { [uint32]$_ })
function Find-Target {
  $h = [W]::GetTopWindow([IntPtr]::Zero)
  while ($h -ne [IntPtr]::Zero) {
    if ([W]::IsWindowVisible($h)) {
      $sb = New-Object Text.StringBuilder 256
      [void][W]::GetWindowText($h, $sb, 256)
      $title = $sb.ToString()
      $owner = [uint32]0
      [void][W]::GetWindowThreadProcessId($h, [ref]$owner)
      $cloaked = 0
      [void][W]::DwmGetWindowAttribute($h, 14, [ref]$cloaked, 4)
      $tool = ([W]::GetWindowLong($h, -20) -band 0x80) -ne 0
      if ($title -and -not $tool -and $cloaked -eq 0 -and ($skip -notcontains $owner) -and $title -ne 'Program Manager') { return $h }
    }
    $h = [W]::GetWindow($h, 2)
  }
  return [IntPtr]::Zero
}
function Focus($h) {
  if ([W]::IsIconic($h)) { [void][W]::ShowWindow($h, 9) }
  [W]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [W]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)  # an Alt tap lets Windows hand over the focus
  [void][W]::SetForegroundWindow($h)
  Start-Sleep -Milliseconds 250
}
function Out-Json($o) { $o | ConvertTo-Json -Compress }
$t = Find-Target
if ($t -eq [IntPtr]::Zero) { Out-Json @{ ok = $false; error = 'no window to act on' }; exit }
switch ($Action) {
  'focus' { Focus $t; Out-Json @{ ok = $true } }
  'pid' {
    $owner = [uint32]0
    [void][W]::GetWindowThreadProcessId($t, [ref]$owner)
    $sb = New-Object Text.StringBuilder 256
    [void][W]::GetWindowText($t, $sb, 256)
    Out-Json @{ ok = $true; pid = $owner; title = $sb.ToString() }
  }
  'keys' {
    Focus $t
    Add-Type -AssemblyName System.Windows.Forms
    [Windows.Forms.SendKeys]::SendWait($Arg)
    Out-Json @{ ok = $true }
  }
  'window' {
    $code = @{ minimize = 6; maximize = 3; restore = 9 }[$Arg]
    if (-not $code) { Out-Json @{ ok = $false; error = 'unknown window action' }; exit }
    [void][W]::ShowWindow($t, $code)
    Out-Json @{ ok = $true }
  }
  'scroll' {
    Focus $t
    $r = New-Object W+RECT
    [void][W]::GetWindowRect($t, [ref]$r)
    [void][W]::SetCursorPos([int](($r.L + $r.R) / 2), [int](($r.T + $r.B) / 2))
    $d = if ($Arg -eq 'up') { 480 } else { -480 }
    [W]::mouse_event(0x0800, 0, 0, $d, [UIntPtr]::Zero)
    Out-Json @{ ok = $true }
  }
  'click' {
    Focus $t
    $root = [Windows.Automation.AutomationElement]::FromHandle($t)
    $types = @([Windows.Automation.ControlType]::Button, [Windows.Automation.ControlType]::MenuItem, [Windows.Automation.ControlType]::TabItem, [Windows.Automation.ControlType]::CheckBox, [Windows.Automation.ControlType]::RadioButton, [Windows.Automation.ControlType]::Hyperlink, [Windows.Automation.ControlType]::ListItem, [Windows.Automation.ControlType]::TreeItem, [Windows.Automation.ControlType]::SplitButton, [Windows.Automation.ControlType]::ComboBox)
    $conds = $types | ForEach-Object { New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty, $_) }
    $all = $root.FindAll([Windows.Automation.TreeScope]::Descendants, (New-Object Windows.Automation.OrCondition(,[Windows.Automation.Condition[]]$conds)))
    $want = $Arg.ToLower()
    $best = $null; $bestScore = 0
    foreach ($e in $all) {
      try {
        $n = $e.Current.Name
        if (-not $n -or $e.Current.IsOffscreen -or -not $e.Current.IsEnabled) { continue }
        $low = $n.ToLower()
        $score = 0
        if ($low -eq $want) { $score = 1000 } elseif ($low.StartsWith($want)) { $score = 500 - $low.Length } elseif ($low.Contains($want)) { $score = 200 - $low.Length }
        if ($score -gt $bestScore) { $best = $e; $bestScore = $score }
      } catch { }
    }
    if (-not $best) { Out-Json @{ ok = $false; error = "nothing named '$Arg' in the front window" }; exit }
    $done = $false
    foreach ($p in @([Windows.Automation.InvokePattern]::Pattern, [Windows.Automation.TogglePattern]::Pattern, [Windows.Automation.SelectionItemPattern]::Pattern, [Windows.Automation.ExpandCollapsePattern]::Pattern)) {
      $obj = $null
      if ($best.TryGetCurrentPattern($p, [ref]$obj)) {
        try {
          if ($p -eq [Windows.Automation.InvokePattern]::Pattern) { $obj.Invoke() }
          elseif ($p -eq [Windows.Automation.TogglePattern]::Pattern) { $obj.Toggle() }
          elseif ($p -eq [Windows.Automation.SelectionItemPattern]::Pattern) { $obj.Select() }
          else { $obj.Expand() }
          $done = $true; break
        } catch { }
      }
    }
    if (-not $done) {
      $rc = $best.Current.BoundingRectangle
      [void][W]::SetCursorPos([int]($rc.Left + $rc.Width / 2), [int]($rc.Top + $rc.Height / 2))
      [W]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero); [W]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
    }
    Out-Json @{ ok = $true; name = $best.Current.Name }
  }
  default { Out-Json @{ ok = $false; error = 'unknown action' } }
}
