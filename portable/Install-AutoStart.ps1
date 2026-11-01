# Capri drive watcher: once per PC. After this, plugging the drive in opens Capri and pulling it out closes her.
$w = Join-Path $PSScriptRoot 'Watch-Capri.ps1'
$dir = "$env:LOCALAPPDATA\CapriWatch"; New-Item -ItemType Directory -Force $dir | Out-Null
Copy-Item $w $dir -Force
$run = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$dir\Watch-Capri.ps1`""
try {
  $a = New-ScheduledTaskAction -Execute powershell.exe -Argument $run
  $t = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName CapriWatch -Action $a -Trigger $t -Settings $s -Force -ErrorAction Stop | Out-Null
  Start-ScheduledTask CapriWatch
  'installed (scheduled task)'
} catch {
  # no rights for a task on this PC: the user's Startup folder needs none
  $vbs = Join-Path ([Environment]::GetFolderPath('Startup')) 'CapriWatch.vbs'
  "CreateObject(""WScript.Shell"").Run ""powershell.exe $($run.Replace('"', '""'))"", 0, False" | Set-Content -Encoding ASCII $vbs
  Start-Process wscript.exe "`"$vbs`""
  'installed (startup folder)'
}
