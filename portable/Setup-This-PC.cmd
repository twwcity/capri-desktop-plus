@echo off
rem Run once on a new PC: Capri then opens by herself whenever this drive is plugged in.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-AutoStart.ps1"
echo.
echo Capri will now open whenever this drive is plugged in to this PC.
wscript "%~dp0Start-Capri.vbs"
timeout /t 5 >nul
