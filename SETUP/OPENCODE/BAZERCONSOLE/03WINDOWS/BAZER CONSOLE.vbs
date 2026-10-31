' BAZER CONSOLE - hidden launcher (Windows)
' Double-click this file. It finds MAJOR from its own location, so the repo can be moved.
' No terminal window: launch.mjs itself reuses or starts the detached server.
Option Explicit
Dim fso, sh, here, major, launcher, cmd, rc
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

here = fso.GetParentFolderName(WScript.ScriptFullName)
major = fso.GetParentFolderName(fso.GetParentFolderName(here))
launcher = major & "\BAZERCONSOLE\01MAIN\ACTIVE\SERVER\launch.mjs"

If Not fso.FileExists(launcher) Then
  MsgBox "Launcher not found:" & vbCrLf & launcher & vbCrLf & vbCrLf & _
         "Expected layout: <repo dir>\BAZERCONSOLE\01MAIN\ACTIVE\SERVER\launch.mjs", 16, "BAZER CONSOLE"
  WScript.Quit 1
End If

sh.CurrentDirectory = major
cmd = "node """ & launcher & """"
On Error Resume Next
rc = sh.Run(cmd, 0, True)
If Err.Number <> 0 Then
  MsgBox "Cannot start node. Install Node.js 20+ and make sure node is on PATH.", 16, "BAZER CONSOLE"
  WScript.Quit 1
End If
On Error GoTo 0
If rc <> 0 Then
  MsgBox "Console did not start. Run 03WINDOWS\launch.cmd to see the error.", 16, "BAZER CONSOLE"
  WScript.Quit 1
End If
