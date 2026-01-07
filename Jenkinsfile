// Jenkinsfile for HiveSnaps Android builds
pipeline {
    agent any
    
    // Build parameters for manual control
    parameters {
        booleanParam(
            name: 'FORCE_RELEASE_SIGNING',
            defaultValue: false,
            description: 'Force release signing even on non-main branches (for testing)'
        )
        booleanParam(
            name: 'PUBLISH_TO_PLAYSTORE',
            defaultValue: false,
            description: 'Publish AAB to Google Play Store internal track (only works on main branch)'
        )
    }
    
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
        
        // Build flags
        IS_MAIN_BRANCH = "${env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main'}"
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
                
                // Fix: Expo prebuild regenerates android files - patch required settings
                echo "Patching Android configuration files..."
                sh '''
                    # 1. Ensure newArchEnabled is set (required by react-native-reanimated)
                    if ! grep -q "newArchEnabled=true" android/gradle.properties; then
                        echo "newArchEnabled=true" >> android/gradle.properties
                        echo "✓ Added newArchEnabled=true to gradle.properties"
                    else
                        echo "✓ newArchEnabled already set in gradle.properties"
                    fi
                    
                    # 2. Add hermesEnabled ext property to build.gradle
                    cd android/app
                    if ! grep -q "ext.hermesEnabled" build.gradle; then
                        # Create a temp file with the ext block and the rest of build.gradle
                        {
                            echo 'ext {'
                            echo '    hermesEnabled = (findProperty("hermesEnabled") ?: "true").toBoolean()'
                            echo '}'
                            echo ''
                            cat build.gradle
                        } > build.gradle.tmp
                        mv build.gradle.tmp build.gradle
                        echo "✓ Patched build.gradle - added hermesEnabled ext property"
                    else
                        echo "✓ build.gradle already has hermesEnabled ext property"
                    fi
                '''
                }
            }
        }

        // Stage 5: Setup Release Signing (Only for main branch or when explicitly requested)
        stage('Setup Release Signing') {
            when {
                expression { 
                    return env.IS_MAIN_BRANCH == 'true' || params.FORCE_RELEASE_SIGNING == true
                }
            }
            steps {
                script {
                    echo "=== Setting up release signing for production build ==="
                    // Use withCredentials for secure credential handling
                    // This prevents credentials from appearing in logs
                    withCredentials([
                        file(credentialsId: 'android-keystore-file', variable: 'KEYSTORE_FILE'),
                        string(credentialsId: 'android-keystore-password', variable: 'KEYSTORE_PASSWORD'),
                        string(credentialsId: 'android-key-alias', variable: 'KEY_ALIAS'),
                        string(credentialsId: 'android-key-password', variable: 'KEY_PASSWORD')
                    ]) {
                        sh '''
                            # Copy keystore to android/app directory
                            cp "$KEYSTORE_FILE" android/app/release.keystore
                            
                            # Create gradle.properties with signing configuration
                            # These properties are read by build.gradle
                            cat > android/gradle.properties << EOF
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true

# Release signing configuration
RELEASE_STORE_FILE=release.keystore
RELEASE_STORE_PASSWORD=$KEYSTORE_PASSWORD
RELEASE_KEY_ALIAS=$KEY_ALIAS
RELEASE_KEY_PASSWORD=$KEY_PASSWORD
EOF
                            
                            echo "✓ Release signing configured successfully"
                            echo "  - Keystore: release.keystore"
                            echo "  - Key alias: $KEY_ALIAS"
                        '''
                    }
                }
            }
        }

        // Stage 6: Build Android APK/AAB
        stage('Build Android') {
            steps {
                dir('android') {
                    script {
                        def buildType = env.IS_MAIN_BRANCH == 'true' ? 'release (signed)' : 'release (debug-signed)'
                        echo "Building Android ${buildType}..."
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
                            
                            # Verify signing
                            if [ -f "app/build/outputs/apk/release/app-release.apk" ]; then
                                echo "=== APK Signature Info ==="
                                $ANDROID_HOME/build-tools/34.0.0/apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk || true
                            fi
                            
                            if [ -f "app/build/outputs/bundle/release/app-release.aab" ]; then
                                echo "=== AAB Signature Info ==="
                                jarsigner -verify -verbose -certs app/build/outputs/bundle/release/app-release.aab || true
                            fi
                        '''
                    }
                }
            }
        }

        // Stage 7: Archive Artifacts
        stage('Archive Artifacts') {
            steps {
                script {
                    def timestamp = new Date().format('yyyyMMddHHmmss')
                    def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: 'unknown'
                    def buildType = env.IS_MAIN_BRANCH == 'true' ? 'release' : 'debug'
                    
                    // Archive APK with descriptive name
                    sh """
                        if [ -f android/app/build/outputs/apk/release/app-release.apk ]; then
                            cp android/app/build/outputs/apk/release/app-release.apk \
                               hivesnaps-${buildType}-${timestamp}.apk
                        fi
                    """
                    
                    // Archive AAB with descriptive name
                    sh """
                        if [ -f android/app/build/outputs/bundle/release/app-release.aab ]; then
                            cp android/app/build/outputs/bundle/release/app-release.aab \
                               hivesnaps-${buildType}-${timestamp}.aab
                        fi
                    """
                    
                    // Archive both
                    archiveArtifacts artifacts: '*.apk,*.aab', allowEmptyArchive: true, fingerprint: true
                    archiveArtifacts artifacts: 'android/app/build/outputs/**/*.apk', allowEmptyArchive: true
                    archiveArtifacts artifacts: 'android/app/build/outputs/**/*.aab', allowEmptyArchive: true
                }
            }
        }

        // Stage 8: Publish to Google Play Store (Optional - Only on main branch)
        // SETUP REQUIRED: See docs/JENKINS_PLAYSTORE_SETUP.md
        stage('Publish to Play Store') {
            when {
                expression { 
                    // Only publish on main branch AND if enabled
                    return env.IS_MAIN_BRANCH == 'true' && params.PUBLISH_TO_PLAYSTORE == true
                }
            }
            steps {
                script {
                    echo "=== Publishing to Google Play Store ==="
                    withCredentials([
                        file(credentialsId: 'google-play-service-account-json', variable: 'PLAY_SERVICE_ACCOUNT_JSON')
                    ]) {
                        dir('android') {
                            sh '''
                                # Copy service account JSON to expected location
                                mkdir -p app
                                cp "$PLAY_SERVICE_ACCOUNT_JSON" app/play-service-account.json
                                
                                # Publish AAB to Play Store internal track
                                # Using gradle-play-publisher plugin
                                ./gradlew publishReleaseBundle \
                                    --no-daemon \
                                    --stacktrace \
                                    --console=plain
                                
                                echo "✓ Published to Play Store internal track!"
                                echo "  → Go to Play Console to promote to production"
                            '''
                        }
                    }
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