# 🚀 Quick Setup Checklist for Jenkins

## One-Time Setup (Do this once on Jenkins server)

### Step 1: Add Signing Credentials to Jenkins

Go to: **Jenkins → Manage Jenkins → Credentials → (global) → Add Credentials**

Add these 4 credentials (exact IDs required):

- [ ] **`android-keystore-file`** (Secret file)
  - Upload your `.keystore` or `.jks` file
- [ ] **`android-keystore-password`** (Secret text)
  - The password you used when creating the keystore
- [ ] **`android-key-alias`** (Secret text)
  - The alias name (e.g., `hivesnaps`, `upload`, etc.)
- [ ] **`android-key-password`** (Secret text)
  - The key password (often same as keystore password)

### Step 2: Verify Jenkins Environment

SSH into Jenkins server and verify:

```bash
# Check Java
java -version  # Should be Java 11+

# Check Android SDK
ls -la /opt/android-sdk  # Or wherever ANDROID_HOME points

# If Android SDK missing, Jenkins will auto-install on first build
```

### Step 3: Test the Build

1. **Push this updated Jenkinsfile to main branch**
2. **Trigger a build** (auto-triggers on push to main)
3. **Check console output** for:
   - ✓ "Release signing configured successfully"
   - ✓ "Build completed successfully"
   - ✓ AAB/APK signature verification

## Expected Build Flow

### Feature Branch Build:

```
Checkout → Install deps → Expo prebuild → Build (debug-signed) → Archive
```

**Result:** Debug-signed APK/AAB (good for testing)

### Main Branch Build:

```
Checkout → Install deps → Expo prebuild → Setup Release Signing → Build (release-signed) → Archive
```

**Result:** Production-signed APK/AAB (ready for Play Store)

## Troubleshooting

### "Credential not found" Error

**Fix:** Make sure credential IDs match EXACTLY (case-sensitive):

- `android-keystore-file` (not `androidKeystoreFile` or `android_keystore_file`)

### Build Succeeds but APK is Debug-Signed

**Reason:** This is expected on non-main branches!

- Only main branch uses release signing
- To force release signing on feature branch: Enable `FORCE_RELEASE_SIGNING` parameter

### Build Fails at "Setup Release Signing" Stage

**Possible causes:**

1. Credentials not configured in Jenkins
2. Wrong credential IDs
3. Corrupted keystore file
4. Wrong password

**How to verify:**

```bash
# On your local machine, test keystore:
keytool -list -v -keystore your-keystore.jks -alias your-alias
# Enter password - should show certificate info
```

### Build Timeout After 60 Minutes

**Fix:** Increase timeout in Jenkinsfile:

```groovy
timeout(time: 90, unit: 'MINUTES')  // Change from 60 to 90
```

## Where Are the Keys?

```
┌─────────────────────┐
│  Your Computer      │  ← Keys generated here
│  (Local repo)       │  ← Keys in .gitignore (NOT pushed to GitHub)
└─────────────────────┘
         │
         │ Manual upload via Jenkins UI (one time)
         ↓
┌─────────────────────┐
│  Jenkins Server     │  ← Keys stored securely as "Jenkins Credentials"
│  (VPS)              │  ← Encrypted at rest
└─────────────────────┘
         │
         │ During build: Temporarily copied to workspace
         ↓
┌─────────────────────┐
│  Build Workspace    │  ← android/app/release.keystore (temporary)
│  (Temp directory)   │  ← Deleted after build
└─────────────────────┘
```

**Keys are NEVER in Git!** They only exist on:

1. Your local machine (secure location, backed up)
2. Jenkins server (as encrypted credentials)

## Quick Commands

### Check if build succeeded:

```bash
# On Jenkins server, check latest build
ls -lh /var/lib/jenkins/jobs/hivesnaps/builds/lastSuccessfulBuild/archive/
```

### Verify AAB signing locally:

```bash
jarsigner -verify -verbose -certs hivesnaps-release-*.aab
```

### Verify APK signing locally:

```bash
apksigner verify --print-certs hivesnaps-release-*.apk
```

## Play Store Publishing (Optional)

To enable auto-publish to Play Store:

1. Follow [JENKINS_COMPLETE_SETUP.md](JENKINS_COMPLETE_SETUP.md) → "Auto-Publish" section
2. Add `google-play-service-account-json` credential to Jenkins
3. Enable `PUBLISH_TO_PLAYSTORE` parameter when building

## Support

- Full documentation: [docs/JENKINS_COMPLETE_SETUP.md](JENKINS_COMPLETE_SETUP.md)
- Keystore setup: [docs/JENKINS_KEYSTORE_SETUP.md](JENKINS_KEYSTORE_SETUP.md)
- Existing Jenkins docs: [docs/JENKINS_KEYSTORE_SETUP.md](JENKINS_KEYSTORE_SETUP.md)

---

**Last Updated:** January 6, 2026
