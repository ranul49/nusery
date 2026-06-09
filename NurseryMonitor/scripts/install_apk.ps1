<#
install_apk.ps1
Installs the debug APK to a connected device or starts an AVD and installs it.
Usage:
  powershell -ExecutionPolicy Bypass -File .\scripts\install_apk.ps1
  powershell -ExecutionPolicy Bypass -File .\scripts\install_apk.ps1 -ApkPath "C:\path\to\app-debug.apk" -AvdName "test_emulator"
#>
param(
    [string]$ApkPath = "${PSScriptRoot}\..\app\build\outputs\apk\debug\app-debug.apk",
    [string]$AvdName = "test_emulator",
    [int]$WaitSeconds = 300
)

function Resolve-SdkDir {
    # 1) check local.properties in project root
    $projectRoot = Resolve-Path "$PSScriptRoot\.." | Select-Object -ExpandProperty Path
    $localProps = Join-Path $projectRoot 'local.properties'
    if (Test-Path $localProps) {
        $line = Select-String -Path $localProps -Pattern '^sdk\.dir=' -SimpleMatch -ErrorAction SilentlyContinue
        if ($line) { return ($line -replace '^sdk\.dir=','').Trim() }
    }
    # 2) environment variables
    if ($env:ANDROID_SDK_ROOT) { return $env:ANDROID_SDK_ROOT }
    if ($env:ANDROID_HOME) { return $env:ANDROID_HOME }
    # 3) common default
    $default = Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk'
    if (Test-Path $default) { return $default }
    return $null
}

$sdk = Resolve-SdkDir
if (-not $sdk) {
    Write-Error "Android SDK not found. Set ANDROID_SDK_ROOT/ANDROID_HOME or add sdk.dir to local.properties."
    exit 2
}

$adb = Join-Path $sdk 'platform-tools\adb.exe'
$emulator = Join-Path $sdk 'emulator\emulator.exe'

if (-not (Test-Path $adb)) { Write-Error "adb not found at $adb"; exit 3 }

$apkFull = Resolve-Path -LiteralPath $ApkPath -ErrorAction SilentlyContinue
if (-not $apkFull) {
    Write-Error "APK not found at path: $ApkPath"; exit 4
}
$apkFull = $apkFull.Path

Write-Host "Using SDK: $sdk"
Write-Host "Using adb: $adb"
Write-Host "APK: $apkFull"

function Get-DeviceList {
    # Ensure any offline emulator is reconnected automatically.
    & $adb reconnect offline | Out-Null
    # Return raw adb devices output lines after header
    $out = & $adb devices
    $lines = $out -split "\r?\n" | Where-Object { ($_ -and ($_ -notmatch 'List of devices attached')) }
    return $lines
}

$devices = Get-DeviceList
$hasOnline = $devices | Where-Object { $_ -match '\S+\s+device$' }

if (-not $hasOnline) {
    Write-Host "No online devices found. Attempting to start AVD: $AvdName"
    if (-not (Test-Path $emulator)) { Write-Error "emulator.exe not found at $emulator"; exit 5 }
    Start-Process -FilePath $emulator -ArgumentList '-avd', $AvdName -WindowStyle Minimized

    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 3
        $devices = Get-DeviceList
        $hasOnline = $devices | Where-Object { $_ -match '\S+\s+device$' }
        if ($hasOnline) { break }
        if ($devices -match 'offline') {
            Write-Host -NoNewline "." # still booting
            continue
        }
        Write-Host -NoNewline "."
    }
    Write-Host "`n"
}

$devices = Get-DeviceList
$hasOnline = $devices | Where-Object { $_ -match '\S+\s+device$' }
if (-not $hasOnline) {
    Write-Error "No online device/emulator available after waiting. Use Android Studio or connect a device with USB debugging enabled."; exit 6
}

Write-Host "Installing APK..."
$install = & "$adb" install -r "${apkFull}"
Write-Host $install
if ($LASTEXITCODE -ne 0 -or $install -match 'Failure') {
    Write-Error "adb install failed"
    exit 7
}
Write-Host "APK installed successfully."

# Attempt to launch the main launcher activity
$package = 'com.futa.nurserymonitor'
$activity = 'com.futa.nurserymonitor.ui.splash.SplashActivity'
Write-Host "Starting app: $package/$activity"
& "$adb" shell am start -n "$package/$activity" | Write-Host

Write-Host "Done."
