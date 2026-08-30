Set fso = CreateObject("Scripting.FileSystemObject")
Set WShell = CreateObject("WScript.Shell")
WShell.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
WShell.Run "node server.js", 0, False