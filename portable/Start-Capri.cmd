@echo off
set "ROOT=%~dp0"
set "OLLAMA_MODELS=%ROOT%models"
set "OLLAMA_HOST=127.0.0.1:11435"
tasklist /fi "imagename eq Capri.exe" | find /i "Capri.exe" >nul && (echo %time% skipped, already running>>"%ROOT%launch.log" & exit /b)
echo %time% launch>>"%ROOT%launch.log"
start "" "%ROOT%app\Capri.exe"
start "" /b "%ROOT%Ollama-Late.cmd"