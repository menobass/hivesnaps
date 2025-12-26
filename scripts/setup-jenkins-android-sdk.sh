#!/bin/bash
# Setup script for installing Android SDK on Jenkins server (without Android Studio)
# Run this on your Jenkins server as the Jenkins user

set -e

echo "=== Android SDK Setup for Jenkins ==="

# Configuration
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
ANDROID_HOME="${ANDROID_SDK_ROOT}"
JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"

echo "Installing Android SDK to: ${ANDROID_SDK_ROOT}"
echo "Using Java: ${JAVA_HOME}"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "This script should be run with sudo or as root"
    echo "Usage: sudo bash setup-jenkins-android-sdk.sh"
    exit 1
fi

# Install Java if not present
echo "Checking for Java..."
if ! command -v java &> /dev/null; then
    echo "Installing OpenJDK 17..."
    apt-get update
    apt-get install -y openjdk-17-jdk
else
    echo "Java found: $(java -version 2>&1 | head -n 1)"
fi

# Install dependencies
echo "Installing dependencies..."
apt-get install -y wget unzip

# Create Android SDK directory
echo "Creating Android SDK directory..."
mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools
cd ${ANDROID_SDK_ROOT}/cmdline-tools

# Download Android command-line tools
echo "Downloading Android command-line tools..."
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
wget -q --show-progress ${CMDLINE_TOOLS_URL} -O commandlinetools.zip

echo "Extracting command-line tools..."
unzip -q commandlinetools.zip
mv cmdline-tools latest
rm commandlinetools.zip

# Set permissions
chown -R jenkins:jenkins ${ANDROID_SDK_ROOT}

# Accept Android SDK licenses
echo "Accepting Android SDK licenses..."
yes | ${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager --licenses || true

# Install required SDK components
echo "Installing Android SDK components..."
${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager \
    "platform-tools" \
    "platforms;android-34" \
    "platforms;android-33" \
    "build-tools;34.0.0" \
    "build-tools;33.0.0" \
    "ndk;26.1.10909125"

# Set permissions again
chown -R jenkins:jenkins ${ANDROID_SDK_ROOT}

# Create environment file for Jenkins
echo "Creating environment configuration..."
cat > /etc/profile.d/android-sdk.sh << EOF
export ANDROID_HOME=${ANDROID_SDK_ROOT}
export ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT}
export PATH=\${ANDROID_HOME}/cmdline-tools/latest/bin:\${ANDROID_HOME}/platform-tools:\${ANDROID_HOME}/build-tools/34.0.0:\${PATH}
EOF

chmod +x /etc/profile.d/android-sdk.sh

# Add to Jenkins systemd environment (if using systemd)
if [ -f /etc/systemd/system/jenkins.service.d/override.conf ]; then
    echo "Updating Jenkins systemd environment..."
    mkdir -p /etc/systemd/system/jenkins.service.d/
    cat > /etc/systemd/system/jenkins.service.d/override.conf << EOF
[Service]
Environment="ANDROID_HOME=${ANDROID_SDK_ROOT}"
Environment="ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT}"
Environment="PATH=${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools:${ANDROID_SDK_ROOT}/build-tools/34.0.0:/usr/local/bin:/usr/bin:/bin"
EOF
    systemctl daemon-reload
    echo "Jenkins systemd configuration updated. Restart Jenkins: sudo systemctl restart jenkins"
fi

echo ""
echo "=== Android SDK Setup Complete ==="
echo ""
echo "Android SDK installed at: ${ANDROID_SDK_ROOT}"
echo ""
echo "Next steps:"
echo "1. If Jenkins is running as a service, restart it:"
echo "   sudo systemctl restart jenkins"
echo ""
echo "2. Or add these to Jenkins > Manage Jenkins > System > Global properties:"
echo "   ANDROID_HOME=${ANDROID_SDK_ROOT}"
echo "   ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT}"
echo ""
echo "3. Verify installation by running as jenkins user:"
echo "   sudo -u jenkins ${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager --list"
echo ""
