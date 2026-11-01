CreateObject("WScript.Shell").Run """" & Replace(WScript.ScriptFullName, "Start-Capri.vbs", "Start-Capri.cmd") & """", 0, False
