Set-Location 'C:\Users\ranso\AppData\Local\Android\Sdk\platform-tools'
Write-Host "PWD: $PWD"
Write-Host "ADB path: $(Get-Command .\adb.exe).Source"
.\adb.exe kill-server
.\adb.exe start-server
.\adb.exe reconnect offline
.\adb.exe devices -l
