// Jenkinsfile for HiveSnaps Android builds
pipeline {
    agent any
    
    options {
        timeout(time: 45, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    environment {
        // NPM cache
        NPM_CONFIG_CACHE = "${env.WORKSPACE}/.npm"
        
        // Android SDK paths - adjust these for your Jenkins server
        ANDROID_HOME = "${env.ANDROID_HOME ?: '/opt/android-sdk'}"
        ANDROID_SDK_ROOT = "${env.ANDROID_HOME ?: '/opt/android-sdk'}"
        
        // Java - Jenkins usually has this, but you can override
        JAVA_HOME = "${env.JAVA_HOME ?: '/usr/lib/jvm/java-17-openjdk-amd64'}"
        
        // Add Android tools to PATH
        PATH = "${env.ANDROID_HOME}/cmdline-tools/latest/bin:${env.ANDROID_HOME}/platform-tools:${env.ANDROID_HOME}/build-tools/34.0.0:${env.PATH}"
        
        // Node version check
        NODE_OPTIONS = "--max-old-space-size=4096"
    }

    stages {
        // Stage 1: Environment Check & Setup
        stage('Environment Check') {
            steps {
                script {
                    echo "=== Environment Diagnostics ==="
                    sh '''
                        echo "Node version: $(node --version)"
                        echo "NPM version: $(npm --version)"
                        echo "Java version: $(java -version 2>&1 | head -n 1)"
                        echo "ANDROID_HOME: ${ANDROID_HOME}"
                        echo "Workspace: ${WORKSPACE}"
                        
                        # Check if Android SDK exists
                        if [ -d "${ANDROID_HOME}" ]; then
                            echo "✓ Android SDK found at ${ANDROID_HOME}"
                        else
                            echo "✗ Android SDK NOT found at ${ANDROID_HOME}"
                            echo "Will attempt to install Android SDK..."
                        fi
                    '''
                }
            }
        }

        // Stage 2: Install Android SDK if needed
        stage('Setup Android SDK') {
            when {
                expression { !fileExists("${env.ANDROID_HOME}/cmdline-tools") }
            }
            steps {
                script {
                    echo "Installing Android SDK command-line tools..."
                    sh '''
                        # Create Android SDK directory
                        mkdir -p ${ANDROID_HOME}/cmdline-tools
                        cd ${ANDROID_HOME}/cmdline-tools
                        
                        # Download command-line tools (Linux x86_64)
                        wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
                        unzip -q commandlinetools-linux-11076708_latest.zip
                        mv cmdline-tools latest
                        rm commandlinetools-linux-11076708_latest.zip
                        
                        # Accept licenses
                        yes | ${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager --licenses || true
                        
                        # Install required SDK components
                        ${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager \
                            "platform-tools" \
                            "platforms;android-34" \
                            "build-tools;34.0.0" \
                            "ndk;26.1.10909125"
                    '''
                }
            }
        }

        // Stage 3: Checkout & Install Dependencies
        stage('Checkout & Install') {
            steps {
                checkout scm
                
                script {
                    echo "Installing Node dependencies..."
                    sh 'npm ci'
                }
            }
        }

        // Stage 4: Expo Prebuild (Generate Native Code)
        stage('Expo Prebuild') {
            steps {
                script {
                    echo "Running Expo prebuild to generate/update native Android code..."
                    sh '''
                        # Clean previous builds
                        rm -rf android/app/build
                        rm -rf android/build
                        
                        # Run expo prebuild for Android only
                        npx expo prebuild --platform android --clean
                        
                        # Verify android folder was generated
                        if [ ! -f "android/gradlew" ]; then
                            echo "ERROR: android/gradlew not found after prebuild!"
                            exit 1
                        fi
                        
                        # Make gradlew executable
                        chmod +x android/gradlew
                    '''
                }
            }
        }

        // Stage 5: Build Android APK/AAB
        stage('Build Android') {
            steps {
                dir('android') {
                    script {
                        echo "Building Android release..."
                        sh '''
                            # Clean build
                            ./gradlew clean
                            
                            # Build AAB (for Play Store)
                            ./gradlew bundleRelease
                            
                            # Also build APK (for testing)
                            ./gradlew assembleRelease
                        '''
                    }
                }
            }
        }

        // Stage 6: Archive Artifacts
        stage('Archive Artifacts') {
            steps {
                script {
                    def timestamp = new Date().format('yyyyMMddHHmmss')
                    
                    // Archive APK
                    sh """
                        if [ -f android/app/build/outputs/apk/release/app-release.apk ]; then
                            cp android/app/build/outputs/apk/release/app-release.apk \
                               hivesnaps-${timestamp}.apk
                        fi
                    """
                    
                    // Archive AAB
                    sh """
                        if [ -f android/app/build/outputs/bundle/release/app-release.aab ]; then
                            cp android/app/build/outputs/bundle/release/app-release.aab \
                               hivesnaps-${timestamp}.aab
                        fi
                    """
                    
                    // Archive both
                    archiveArtifacts artifacts: '*.apk,*.aab', allowEmptyArchive: true, fingerprint: true
                    archiveArtifacts artifacts: 'android/app/build/outputs/**/*.apk', allowEmptyArchive: true
                    archiveArtifacts artifacts: 'android/app/build/outputs/**/*.aab', allowEmptyArchive: true
                }
            }
        }
    }

    post {
        always {
            script {
                echo "=== Build Summary ==="
                sh '''
                    if [ -f android/app/build/outputs/apk/release/app-release.apk ]; then
                        echo "✓ APK built successfully"
                        ls -lh android/app/build/outputs/apk/release/app-release.apk
                    else
                        echo "✗ APK not found"
                    fi
                    
                    if [ -f android/app/build/outputs/bundle/release/app-release.aab ]; then
                        echo "✓ AAB built successfully"
                        ls -lh android/app/build/outputs/bundle/release/app-release.aab
                    else
                        echo "✗ AAB not found"
                    fi
                '''
            }
            cleanWs(deleteDirs: true, patterns: [[pattern: 'android/app/build', type: 'INCLUDE']])
        }
        success {
            echo "✓ Build completed successfully! Artifacts have been archived."
        }
        failure {
            echo "✗ Build failed. Check the console output above for details."
        }
    }
}