# Jenkins Setup Guide for HiveSnaps Android Builds

This guide explains how to configure Jenkins to build and optionally publish HiveSnaps to the Google Play Store.

## 🔑 Required Jenkins Credentials

You need to configure these credentials in Jenkins **once**. They will be securely stored and referenced by the Jenkinsfile.

### 1. Navigate to Jenkins Credentials

1. Go to: **Jenkins Dashboard → Manage Jenkins → Credentials**
2. Click on **(global)** domain
3. Click **Add Credentials**

### 2. Add Android Signing Credentials

You need to add **4 credentials**:

#### a) Android Keystore File

- **Kind:** Secret file
- **Scope:** Global
- **File:** Upload your `hivesnaps-release.keystore` (or whatever your keystore file is named)
- **ID:** `android-keystore-file`
- **Description:** HiveSnaps Android Release Keystore

#### b) Keystore Password

- **Kind:** Secret text
- **Scope:** Global
- **Secret:** Your keystore password
- **ID:** `android-keystore-password`
- **Description:** HiveSnaps Keystore Password

#### c) Key Alias

- **Kind:** Secret text
- **Scope:** Global
- **Secret:** Your key alias (e.g., `hivesnaps`)
- **ID:** `android-key-alias`
- **Description:** HiveSnaps Key Alias

#### d) Key Password

- **Kind:** Secret text
- **Scope:** Global
- **Secret:** Your key password (often same as keystore password)
- **ID:** `android-key-password`
- **Description:** HiveSnaps Key Password

---

## 📦 How the Build Process Works

### For Feature Branches (Any branch except main):

1. Jenkins pulls code
2. Installs dependencies
3. Runs Expo prebuild
4. **Builds with DEBUG signing** (android/app/debug.keystore)
5. Archives APK/AAB as artifacts

### For Main Branch:

1. Jenkins pulls code
2. Installs dependencies
3. Runs Expo prebuild
4. **Injects RELEASE signing credentials** (your production keystore)
5. Builds with **proper release signing**
6. Archives signed APK/AAB
7. _Optionally publishes to Play Store_ (if enabled)

---

## 🎯 Build Parameters

When you manually trigger a build, you have these options:

### `FORCE_RELEASE_SIGNING`

- **Default:** false
- **Use case:** Test release signing on a feature branch
- **Example:** You want to verify signing works before merging to main

### `PUBLISH_TO_PLAYSTORE`

- **Default:** false
- **Use case:** Automatically publish to Play Store internal track
- **Requirements:**
  - Must be on main branch
  - Must set up Google Play service account (see below)

---

## 🚀 Optional: Auto-Publish to Google Play Store

To enable automatic publishing to Play Store, follow these steps:

### 1. Create Google Play Service Account

1. Go to [Google Play Console](https://play.google.com/console/)
2. Navigate to: **Setup → API access**
3. Click **Create new service account**
4. Follow the wizard to create a service account
5. **Download the JSON key file** (e.g., `play-service-account.json`)
6. Grant the service account the **"Release manager"** role in Play Console

### 2. Add Service Account to Jenkins

1. Go to: **Jenkins → Manage Jenkins → Credentials**
2. Add new credential:
   - **Kind:** Secret file
   - **Scope:** Global
   - **File:** Upload your `play-service-account.json`
   - **ID:** `google-play-service-account-json`
   - **Description:** Google Play Service Account JSON

### 3. Configure Gradle Play Publisher

Add to [android/app/build.gradle](../android/app/build.gradle):

```gradle
plugins {
    id 'com.android.application'
    id 'kotlin-android'
    id 'com.facebook.react'
    id 'com.github.triplet.play' version '3.9.0'  // Add this
}

// ... existing config ...

// Add at the end of the file
play {
    serviceAccountCredentials.set(file("play-service-account.json"))
    track.set("internal") // or "alpha", "beta", "production"
    defaultToAppBundles.set(true)
    releaseStatus.set(com.github.triplet.gradle.androidpublisher.ReleaseStatus.DRAFT)
}
```

Add to [android/build.gradle](../android/build.gradle):

```gradle
buildscript {
    dependencies {
        classpath 'com.github.triplet.gradle:play-publisher:3.9.0'  // Add this
    }
}
```

### 4. Test Publishing

1. Push to main branch
2. In Jenkins, click **Build with Parameters**
3. Enable **PUBLISH_TO_PLAYSTORE**
4. Click **Build**
5. Check Play Console → Testing → Internal testing

---

## 🔒 Security Best Practices

### ✅ DO:

- Store keystores and credentials in Jenkins only
- Use `withCredentials` in Jenkinsfile (prevents credential leaks)
- Keep keystores in `.gitignore`
- Regularly rotate service account keys
- Use least-privilege permissions (e.g., "Release manager" not "Owner")

### ❌ DON'T:

- Commit keystores to Git (already in .gitignore)
- Hardcode passwords in Jenkinsfile
- Share keystore files via email/Slack
- Use production credentials for testing

---

## 🐛 Troubleshooting

### Build fails with "Credentials not found"

**Solution:** Ensure credential IDs match exactly:

- `android-keystore-file`
- `android-keystore-password`
- `android-key-alias`
- `android-key-password`

### AAB is built but not signed properly

**Symptom:** `jarsigner -verify` fails
**Solution:**

1. Check that release signing stage ran (should only run on main branch)
2. Verify credential passwords are correct
3. Check Jenkins console output for signing errors

### Play Store publish fails

**Common causes:**

1. Service account doesn't have "Release manager" role
2. Service account JSON is expired or revoked
3. App version code already exists in Play Console
4. AAB is not properly signed

### Build succeeds but artifacts are debug-signed

**Solution:** This is expected on feature branches! Only main branch uses release signing.

- To test release signing on a feature branch, enable `FORCE_RELEASE_SIGNING` parameter

---

## 📊 Verifying Signing

After a successful build, check the console output:

```bash
=== APK Signature Info ===
Signer #1 certificate DN: CN=Your Name, OU=Your Company
Signer #1 certificate SHA-256 digest: abcd1234...
```

For production builds on main branch, this should show YOUR release key, not the Android debug key.

---

## 🎉 Typical Workflow

### For Developers (Feature Branches):

1. Push code to feature branch
2. Jenkins auto-builds with debug signing
3. Download APK from Jenkins for testing
4. Merge to main when ready

### For Release (Main Branch):

1. Merge PR to main
2. Jenkins auto-builds with **release signing**
3. Download AAB from Jenkins
4. Manually upload to Play Console → Production
   - OR enable auto-publish for internal testing

### For Play Store Release:

**Option A (Manual - Recommended initially):**

1. Build on main branch (auto-triggers)
2. Download AAB from Jenkins
3. Go to Play Console
4. Upload AAB to production track
5. Submit for review

**Option B (Automated):**

1. Build on main branch with `PUBLISH_TO_PLAYSTORE` enabled
2. Jenkins publishes to internal track automatically
3. Go to Play Console → Promote to production
4. Submit for review

---

## 📞 Need Help?

If you encounter issues:

1. Check Jenkins console output for detailed error messages
2. Verify all credentials are configured correctly
3. Test signing locally first: `cd android && ./gradlew assembleRelease`
4. Check [docs/JENKINS_KEYSTORE_SETUP.md](JENKINS_KEYSTORE_SETUP.md) for keystore generation

---

## ⚙️ Advanced Configuration

### Custom Build Flavors

If you add product flavors (e.g., `free` and `paid`):

```gradle
productFlavors {
    free { ... }
    paid { ... }
}
```

Update Jenkinsfile to build specific flavor:

```bash
./gradlew assembleFreeRelease bundleFreeRelease
```

### Multiple Keystores

For different signing configs per flavor, extend the signing stage:

```groovy
withCredentials([
    file(credentialsId: 'android-keystore-free', variable: 'KEYSTORE_FREE'),
    file(credentialsId: 'android-keystore-paid', variable: 'KEYSTORE_PAID'),
    // ...
]) {
    // Copy both keystores and configure gradle.properties accordingly
}
```

---

**Last Updated:** January 6, 2026
**Maintainer:** HiveSnaps Team
