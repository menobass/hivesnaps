#!/bin/bash
# Quick diagnostic script to verify Jenkins Android build setup
# Run this on your Jenkins server as the jenkins user

echo "=== Jenkins Android Build Diagnostics ==="
echo ""

# Check Jenkins user
echo "Current user: $(whoami)"
if [ "$(whoami)" != "jenkins" ]; then
    echo "⚠️  WARNING: Not running as jenkins user"
    echo "   Run with: sudo -u jenkins bash diagnose-build-env.sh"
fi
echo ""

# Check Java
echo "1. Java Check:"
if command -v java &> /dev/null; then
    java_version=$(java -version 2>&1 | head -n 1)
    echo "   ✓ Java found: $java_version"
    if [[ "$java_version" == *"17"* ]]; then
        echo "   ✓ Java 17 confirmed"
    else
        echo "   ⚠️  WARNING: Java 17 recommended, found: $java_version"
    fi
else
    echo "   ✗ Java NOT found"
fi
echo ""

# Check Node.js
echo "2. Node.js Check:"
if command -v node &> /dev/null; then
    node_version=$(node --version)
    echo "   ✓ Node found: $node_version"
    major_version=$(echo $node_version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$major_version" -ge 18 ]; then
        echo "   ✓ Node 18+ confirmed"
    else
        echo "   ⚠️  WARNING: Node 18+ recommended, found: $node_version"
    fi
else
    echo "   ✗ Node NOT found"
fi
echo ""

# Check NPM
echo "3. NPM Check:"
if command -v npm &> /dev/null; then
    echo "   ✓ NPM found: $(npm --version)"
else
    echo "   ✗ NPM NOT found"
fi
echo ""

# Check Android SDK
echo "4. Android SDK Check:"
if [ -n "$ANDROID_HOME" ]; then
    echo "   ✓ ANDROID_HOME set: $ANDROID_HOME"
else
    echo "   ✗ ANDROID_HOME not set"
    ANDROID_HOME="/opt/android-sdk"
    echo "   Checking default location: $ANDROID_HOME"
fi

if [ -d "$ANDROID_HOME" ]; then
    echo "   ✓ Android SDK directory exists"
    
    if [ -f "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
        echo "   ✓ sdkmanager found"
        
        # Check installed packages
        echo ""
        echo "   Installed SDK components:"
        $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --list_installed 2>/dev/null | grep -E "(platform-tools|platforms|build-tools|ndk)" | head -10
    else
        echo "   ✗ sdkmanager NOT found at $ANDROID_HOME/cmdline-tools/latest/bin/"
    fi
else
    echo "   ✗ Android SDK directory NOT found"
fi
echo ""

# Check environment variables
echo "5. Environment Variables:"
echo "   ANDROID_HOME: ${ANDROID_HOME:-'not set'}"
echo "   ANDROID_SDK_ROOT: ${ANDROID_SDK_ROOT:-'not set'}"
echo "   JAVA_HOME: ${JAVA_HOME:-'not set'}"
echo "   PATH: $PATH" | fold -w 80 -s
echo ""

# Check disk space
echo "6. Disk Space:"
df -h / | tail -1 | awk '{print "   Total: "$2", Used: "$3", Available: "$4" ("$5" used)"}'
echo ""

# Check permissions
echo "7. Permissions Check:"
if [ -d "$ANDROID_HOME" ]; then
    owner=$(ls -ld "$ANDROID_HOME" | awk '{print $3":"$4}')
    echo "   $ANDROID_HOME owner: $owner"
    if [ "$owner" == "jenkins:jenkins" ] || [ "$(whoami)" == "$(echo $owner | cut -d':' -f1)" ]; then
        echo "   ✓ Permissions OK"
    else
        echo "   ⚠️  WARNING: May need permission adjustment"
        echo "      Run: sudo chown -R jenkins:jenkins $ANDROID_HOME"
    fi
else
    echo "   Skipped (Android SDK not found)"
fi
echo ""

# Summary
echo "=== Summary ==="
echo ""
issues=0

if ! command -v java &> /dev/null; then
    echo "❌ CRITICAL: Install Java 17"
    issues=$((issues+1))
fi

if ! command -v node &> /dev/null; then
    echo "❌ CRITICAL: Install Node.js 18+"
    issues=$((issues+1))
fi

if [ ! -d "$ANDROID_HOME" ] || [ ! -f "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
    echo "❌ CRITICAL: Install Android SDK"
    echo "   Run: sudo bash scripts/setup-jenkins-android-sdk.sh"
    issues=$((issues+1))
fi

if [ -z "$ANDROID_HOME" ]; then
    echo "⚠️  WARNING: Set ANDROID_HOME environment variable"
    issues=$((issues+1))
fi

if [ $issues -eq 0 ]; then
    echo "✅ All checks passed! Environment is ready for Android builds."
else
    echo ""
    echo "Found $issues issue(s) that need attention."
    echo "See docs/JENKINS_ANDROID_BUILD.md for troubleshooting."
fi
echo ""
