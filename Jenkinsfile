// Jenkinsfile for HiveSnaps Android builds
pipeline {
    agent any
    
    // Trigger builds on GitHub push and PRs
    triggers {
        githubPush()
    }
    
    options {
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        // NPM cache
        NPM_CONFIG_CACHE = "${env.WORKSPACE}/.npm"
        
        // Android SDK paths - adjust these for your Jenkins server
        ANDROID_HOME = "${env.ANDROID_HOME ?: '/opt/android-sdk'}"
        ANDROID_SDK_ROOT = "${env.ANDROID_HOME ?: '/opt/android-sdk'}"
        
        // Java - Jenkins usually has this, but you can override
        JAVA_HOME = "${env.JAVA_HOME ?: '/usr/lib/jvm/java-21-openjdk-amd64'}"
        
        // Add Android tools to PATH
        PATH = "${env.ANDROID_HOME}/cmdline-tools/latest/bin:${env.ANDROID_HOME}/platform-tools:${env.ANDROID_HOME}/build-tools/34.0.0:${env.JAVA_HOME}/bin:${env.PATH}"
        
        // Node memory and Gradle optimization
        NODE_OPTIONS = "--max-old-space-size=4096"
        GRADLE_OPTS = "-Dorg.gradle.daemon=false -Dorg.gradle.jvmargs=\"-Xmx3072m -XX:MaxMetaspaceSize=768m\" -Dorg.gradle.parallel=true"
        
        // Discord webhook for notifications (configure in Jenkins or set here)
        DISCORD_WEBHOOK_URL = "${env.DISCORD_WEBHOOK_URL ?: ''}"
    }

    stages {
        // Stage 1: Environment Check & Setup
        stage('Environment Check') {
            steps {
                script {
                    echo "=== Environment Diagnostics ==="
                    echo "Building branch: ${env.BRANCH_NAME ?: env.GIT_BRANCH}"
                    echo "Build cause: ${currentBuild.getBuildCauses()}"
                    
                    // Check if this is a PR build
                    if (env.CHANGE_ID) {
                        echo "Building Pull Request #${env.CHANGE_ID}"
                        echo "PR Title: ${env.CHANGE_TITLE}"
                        echo "PR Author: ${env.CHANGE_AUTHOR}"
                        echo "Target Branch: ${env.CHANGE_TARGET}"
                    }
                    
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
                    sh 'npm ci --prefer-offline --no-audit'
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
                        rm -rf android/.gradle
                        
                        # Run expo prebuild for Android only
                        npx expo prebuild --platform android --clean
                        
                        # Verify android folder was generated
                        if [ ! -f "android/gradlew" ]; then
                            echo "ERROR: android/gradlew not found after prebuild!"
                            exit 1
                        fi
                        
                        # Make gradlew executable
                        chmod +x android/gradlew
                        
                        echo "✓ Prebuild completed successfully"
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
                            # Kill any existing Gradle daemons to prevent stale process issues
                            ./gradlew --stop || true
                            
                            # Build with no daemon (more resilient to Jenkins restarts)
                            # Use parallel builds and multiple workers for speed
                            ./gradlew assembleRelease bundleRelease \
                                --no-daemon \
                                --stacktrace \
                                --console=plain \
                                --build-cache \
                                --parallel \
                                --max-workers=4
                            
                            echo "✓ Build completed successfully"
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
            // Clean up build artifacts to save disk space, but keep node_modules for faster rebuilds
            cleanWs(
                deleteDirs: true,
                patterns: [
                    [pattern: 'android/app/build', type: 'INCLUDE'],
                    [pattern: 'android/build', type: 'INCLUDE'],
                    [pattern: 'android/.gradle', type: 'INCLUDE']
                ]
            )
        }
        success {
            echo "✓ Build completed successfully! Artifacts have been archived."
            echo "Download artifacts from the 'Build Artifacts' section above."
            
            script {
                if (env.CHANGE_ID) {
                    echo "✓ Pull Request #${env.CHANGE_ID} build passed!"
                }
                
                // Send Discord notification
                def duration = currentBuild.durationString.replace(' and counting', '')
                def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: 'unknown'
                def prInfo = env.CHANGE_ID ? "\\n**PR:** #${env.CHANGE_ID} - ${env.CHANGE_TITLE}" : ''
                
                sh """
                    curl -X POST \
                      -H "Content-Type: application/json" \
                      -d '{
                        "embeds": [{
                          "title": "✅ Build Successful!",
                          "description": "**Job:** ${env.JOB_NAME}\\n**Build:** #${env.BUILD_NUMBER}\\n**Branch:** ${branch}${prInfo}\\n**Duration:** ${duration}\\n**Artifacts:** APK & AAB ready\\n[View Build](${env.BUILD_URL})",
                          "color": 3066993,
                          "footer": {"text": "HiveSnaps Android CI"}
                        }]
                      }' \
                      ${env.DISCORD_WEBHOOK_URL}
                """
            }
        }
        failure {
            echo "✗ Build failed. Check the console output above for details."
            
            script {
                if (env.CHANGE_ID) {
                    echo "✗ Pull Request #${env.CHANGE_ID} build failed!"
                }
                
                // Send Discord notification
                def duration = currentBuild.durationString.replace(' and counting', '')
                def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: 'unknown'
                def prInfo = env.CHANGE_ID ? "\\n**PR:** #${env.CHANGE_ID} - ${env.CHANGE_TITLE}" : ''
                
                sh """
                    curl -X POST \
                      -H "Content-Type: application/json" \
                      -d '{
                        "embeds": [{
                          "title": "❌ Build Failed!",
                          "description": "**Job:** ${env.JOB_NAME}\\n**Build:** #${env.BUILD_NUMBER}\\n**Branch:** ${branch}${prInfo}\\n**Duration:** ${duration}\\n[View Console Output](${env.BUILD_URL}console)",
                          "color": 15158332,
                          "footer": {"text": "HiveSnaps Android CI"}
                        }]
                      }' \
                      ${env.DISCORD_WEBHOOK_URL}
                """
            }
        }
    }
}