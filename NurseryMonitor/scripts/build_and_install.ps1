<#
PowerShell helper: checks for Java, Gradle or gradlew, and adb; optionally generates wrapper,
builds the debug APK, lists devices, and installs the debug APK if a device is connected.
#>

param(
    [switch]$GenerateWrapperIfMissing = $true
)

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

Write-Host "Repository root: $repoRoot"

function Check-Command($exe, $args = "-version") {
    try {
        $proc = Start-Process -FilePath $exe -ArgumentList $args -NoNewWindow -RedirectStandardOutput -RedirectStandardError -PassThru -Wait -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

$javaOk = Check-Command java "-version"
$gradleOk = Check-Command gradle "-v"
$gradlewExists = Test-Path .\gradlew.bat
$adbOk = Check-Command adb "version"

Write-Host "java: $javaOk; gradle: $gradleOk; gradlew.bat exists: $gradlewExists; adb: $adbOk"

if (-not $javaOk) {
    Write-Warning "Java not found. Install a JDK and ensure 'java' is on PATH. See README-setup.md"
}

if (-not $gradlewExists) {
    if ($gradleOk -and $GenerateWrapperIfMissing) {
        Write-Host "Generating Gradle wrapper using system Gradle..."
        & gradle wrapper
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to generate wrapper"; exit 1 }
        $gradlewExists = Test-Path .\gradlew.bat
    } else {
        Write-Warning "No gradlew.bat found. Install Gradle or run 'gradle wrapper' to generate the wrapper."
    }
}

if (-not $gradlewExists) { Write-Error "Cannot continue without gradlew.bat or Gradle installed."; exit 2 }

# Build debug APK
Write-Host "Building debug APK..."
& .\gradlew.bat assembleDebug --no-daemon --stacktrace
if ($LASTEXITCODE -ne 0) { Write-Error "Gradle build failed. Check logs."; exit 3 }

# Locate APK (typical location)
$apkPath = Get-ChildItem -Path . -Recurse -Filter "*-debug.apk" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $apkPath) {
    Write-Warning "Could not find debug APK automatically. Look under app/build/outputs/apk/."
} else {
    Write-Host "Found APK: $($apkPath.FullName)"
}

# Check devices
Write-Host "Checking for connected devices..."
$devicesOutput = & adb devices
Write-Host $devicesOutput

# Parse devices
$devices = ($devicesOutput -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -and ($_ -notmatch "List of devices attached") })
$realDevices = $devices | Where-Object { $_ -match '\S+\s+device$' }
if ($realDevices.Count -gt 0) {
    Write-Host "Device(s) detected. Installing debug APK..."
    & .\gradlew.bat installDebug
    if ($LASTEXITCODE -ne 0) { Write-Error "Install failed. Collect logs with: .\gradlew.bat installDebug --stacktrace --debug > gradle-install.log 2>&1"; exit 4 }
    Write-Host "Install complete. Use 'adb logcat' to view runtime logs."
} else {
    Write-Warning "No device in 'device' state found. Connect a device or start an emulator and enable USB debugging."
}

Write-Host "Done."