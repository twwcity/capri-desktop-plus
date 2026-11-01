@echo off
set "ROOT=%~dp0"
rem the portable Ollama on this drive, if there is one (else Capri uses an installed Ollama or a cloud AI)
if exist "%ROOT%ollama\ollama.exe" (
  set "OLLAMA_MODELS=%ROOT%models"
  set "OLLAMA_HOST=127.0.0.1:11435"
)
tasklist /fi "imagename eq Capri.exe" | find /i "Capri.exe" >nul && (echo %time% skipped, already running>>"%ROOT%launch.log" & exit /b)
echo %time% launch>>"%ROOT%launch.log"
start "" "%ROOT%app\Capri.exe"
if exist "%ROOT%ollama\ollama.exe" start "" /b "%ROOT%Ollama-Late.cmd"
