# Capri drive watcher: starts Capri when the SSD appears, closes it when the SSD is gone
function Launch($letter) {
  $v = "$letter\capri\Start-Capri.vbs"
  if (Test-Path $v) { Start-Process wscript.exe -ArgumentList "`"$v`"" }
}
function CloseOrphans {
  Get-CimInstance Win32_Process -Filter "name='Capri.exe' or name='ollama.exe' or name='ollama app.exe'" | ForEach-Object {
    $p = $_.ExecutablePath
    if ($p -and $p -match '\\capri\\(app|ollama)\\' -and -not (Test-Path $p)) { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  }
}
Get-PSDrive -PSProvider FileSystem | ForEach-Object { Launch $_.Root.TrimEnd('\') }
Register-WmiEvent -Class Win32_VolumeChangeEvent -SourceIdentifier vol | Out-Null
while ($true) {
  $e = Wait-Event -SourceIdentifier vol -Timeout 5
  if ($e) {
    Remove-Event -EventIdentifier $e.EventIdentifier
    $t = $e.SourceEventArgs.NewEvent.EventType; "$(Get-Date -f HH:mm:ss.fff) event type $t" | Add-Content E:\capri\watch.log -ea 0
    if ($t -eq 2) { $d = $e.SourceEventArgs.NewEvent.DriveName.TrimEnd('\'); for ($i = 0; $i -lt 30 -and -not (Test-Path "$d\capri\Start-Capri.vbs"); $i++) { Start-Sleep -Milliseconds 100 }; Launch $d }
  }
  CloseOrphans
}