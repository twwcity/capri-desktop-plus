@echo off
rem Stops this PC from opening Capri when the drive is plugged in. Nothing on the drive is touched.
schtasks /delete /tn CapriWatch /f >nul 2>&1
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CapriWatch.vbs" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='powershell.exe'\" | Where-Object CommandLine -like '*Watch-Capri.ps1*' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
rmdir /s /q "%LOCALAPPDATA%\CapriWatch" >nul 2>&1
echo Capri will no longer open by herself on this PC.
timeout /t 5 >nul
