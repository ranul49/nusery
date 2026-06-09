@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%install_apk.ps1"
if not exist "%PS_SCRIPT%" (
  echo Error: powershell script not found: %PS_SCRIPT%
  exit /b 1
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %*
endlocal
