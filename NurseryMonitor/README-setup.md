# Setup and Build Instructions (Windows)

This document explains how to prepare a Windows machine to build and install the `NurseryMonitor` Android app from this repository.

Prerequisites
- Java JDK 11+ (Temurin/AdoptOpenJDK or Oracle). Ensure `java -version` works.
- Android SDK Platform Tools (adb). Ensure `adb` is on PATH.
- Gradle (optional) or use the Gradle wrapper once generated.
- Android device or emulator with USB debugging enabled.

Quick steps

1) Verify Java, adb, and Gradle availability:

```powershell
java -version
adb version
gradle -v    # optional
```

2) If `gradlew.bat` does not exist or the wrapper JAR is missing, create the Gradle wrapper using your system Gradle:

```powershell
cd "C:\Users\ranso\New folder\NurseryMonitor"
gradle wrapper --gradle-version 9.5.1
```

This will generate the wrapper JAR and the wrapper files under `gradle/wrapper`.

3) Build the debug APK using the wrapper (preferred) or system Gradle:

```powershell
cd "C:\Users\ranso\New folder\NurseryMonitor"
# using wrapper
.\gradlew.bat assembleDebug --no-daemon --stacktrace
# or using system Gradle
gradle assembleDebug --stacktrace
```

4) Check for connected devices and install the debug APK:

```powershell
adb devices
# if a device listed then install
.\gradlew.bat installDebug
# or
gradle installDebug
```

If install fails, collect logs with:

```powershell
# Gradle detailed logs
.\gradlew.bat installDebug --stacktrace --debug > gradle-install.log 2>&1
# adb logcat (requires device connected)
adb logcat -v time > device-log.log
```

Troubleshooting & links
- Java JDK (Temurin): https://adoptium.net
- Android Studio (includes SDK): https://developer.android.com/studio
- Platform-tools (adb): https://developer.android.com/studio/releases/platform-tools
- Gradle: https://gradle.org/install/

Automation
A PowerShell script `scripts/build_and_install.ps1` is provided to detect tools, generate the wrapper (if Gradle is installed), build the APK, and attempt install to a connected device. Run it in an elevated PowerShell when ready.

Questions
If you want, I can add a prebuilt Gradle wrapper into the repo (not recommended) or help walk through installing the Android SDK and Java on your machine interactively.