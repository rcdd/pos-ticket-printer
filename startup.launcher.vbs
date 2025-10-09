Dim sh, cmd
Set sh = CreateObject("WScript.Shell")
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & WScript.ScriptFullName & "\..\scripts\startup.ps1"""
sh.Run cmd, 0, False
