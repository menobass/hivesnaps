// Jenkinsfile (full, npm-based for React Native + EAS)
pipeline {
    agent any // Runs on any available agent. Change to a specific label if needed.
    options {
        timeout(time: 15, unit: 'MINUTES') // Fail if stuck in queue for 15 minutes
    }

    environment {
        // Speed up npm
        NPM_CONFIG_CACHE = "${env.WORKSPACE}/.npm"
    }

    stages {
        // Stage 1: Checkout code & install deps with npm (cache for speed)
        stage('Checkout & Install') {
            steps {
                checkout scm

                // Cache node_modules between builds (add this if not present)
                cache(path: 'node_modules', key: "${env.JOB_NAME}-${env.BRANCH_NAME}-node-modules") {
                    sh 'npm ci'  // Install deps (replaces 'yarn install --frozen-lockfile')
                }
            }
        }

        // Stage 2: Android build with EAS (cloud-based)
        stage('EAS Android Build') {
            when { expression { return fileExists('app.json') } }  // Check for Expo project
            environment {
                EXPO_TOKEN = credentials('EXPO_TOKEN')  // Your secure token
            }
            steps {
                sh '''
                    # Login to Expo non-interactively
                    echo "$EXPO_TOKEN" | eas login --non-interactive

                    # Run EAS build for Android (AAB, production profile)
                    eas build --platform android --profile production --non-interactive
                '''
            }
            post {
                success {
                    archiveArtifacts artifacts: 'dist/*.aab', fingerprint: true  // Save build output
                }
            }
        }

        // Stage 3: iOS build with EAS (skips if no macOS agent)
        stage('EAS iOS Build') {
            when {
                allOf {
                    expression { return fileExists('app.json') }
                    expression { return env.AGENT_LABELS?.contains('macos') || true }  // Run only if Mac agent available
                }
            }
                agent { label 'macos' }  // Switch to Mac agent (add/rent one later)
            environment {
                EXPO_TOKEN = credentials('EXPO_TOKEN')
            }
            steps {
                sh '''
                    echo "$EXPO_TOKEN" | eas login --non-interactive
                    eas build --platform ios --profile production --non-interactive
                '''
            }
            post {
                success {
                    archiveArtifacts artifacts: 'dist/*.ipa', fingerprint: true
                }
            }
        }
    }

    post {
        always {
            cleanWs()  // Clean up workspace
        }
        success {
            echo "Build complete! Artifacts archived."
        }
        failure {
            echo "Build failed—check console for errors."
        }
    }
}