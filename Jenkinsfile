// Jenkinsfile (full, npm-based for React Native + EAS)
pipeline {
    agent any // Runs on any available agent. Change to a specific label if needed.
    options {
        timeout(time: 30, unit: 'MINUTES') // Fail if stuck in queue for 30 minutes
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

                // Install dependencies
                sh 'npm ci'  // Clean install for CI environments
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