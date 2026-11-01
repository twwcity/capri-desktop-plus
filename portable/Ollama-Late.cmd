@echo off
set "ROOT=%~dp0"
set "OLLAMA_MODELS=%ROOT%models"
set "OLLAMA_HOST=127.0.0.1:11435"
ping -n 4 127.0.0.1 >nul
rem load her model as soon as Ollama is up, so the first answer doesn't wait for it
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 5; try { $m = (Get-Content -Raw '%ROOT%data\config.json' | ConvertFrom-Json).chatModel } catch { $m = 'gemma3:12b' }; if (-not $m) { $m = 'gemma3:12b' }; Invoke-RestMethod http://127.0.0.1:11435/api/generate -Method Post -Body (@{ model = $m; keep_alive = '30m' } | ConvertTo-Json) -TimeoutSec 600 | Out-Null"
"%ROOT%ollama\ollama.exe" serve >nul 2>&1
