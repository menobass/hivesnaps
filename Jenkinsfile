pipeline {
    agent any  // Runs on your VPS
    stages {
        stage('Build') {
            steps {
                sh './gradlew assembleDebug'
            }
        }
        stage('Test') {
            steps {
                sh './gradlew test'
            }
        }
        stage('Deploy') {
            when { branch 'main' }
            steps {
                echo 'Deploying to Play Store...'  // Add Fastlane or plugin here
            }
        }
    }
}