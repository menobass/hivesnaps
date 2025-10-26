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


        // Stage 2: Android local build with Gradle
        stage('Android Local Build') {
            when { expression { return fileExists('android/gradlew') } }
            steps {
                dir('android') {
                    sh './gradlew assembleRelease'
                }
                // Archive the generated APK/AAB (adjust path as needed)
                archiveArtifacts artifacts: 'android/app/build/outputs/**/*.apk', fingerprint: true
                archiveArtifacts artifacts: 'android/app/build/outputs/**/*.aab', fingerprint: true
            }
        }

        // Stage 3: iOS local build (uncomment if you have a Mac agent and want to build for iOS)
        // stage('iOS Local Build') {
        //     when {
        //         allOf {
        //             expression { return fileExists('ios/Podfile') }
        //             expression { return env.AGENT_LABELS?.contains('macos') }
        //         }
        //     }
        //     agent { label 'macos' }
        //     steps {
        //         dir('ios') {
        //             sh 'pod install'
        //             sh 'xcodebuild -workspace YourApp.xcworkspace -scheme YourApp -configuration Release -sdk iphoneos'
        //         }
        //         // Archive the generated IPA (adjust path as needed)
        //         archiveArtifacts artifacts: 'ios/build/**/*.ipa', fingerprint: true
        //     }
        // }
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