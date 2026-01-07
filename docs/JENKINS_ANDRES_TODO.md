# 🎯 FOR ANDRES: What to Do Right Now

## The Problem You Had

Your build failed because the Jenkinsfile was trying to:

1. Modify `build.gradle` during the build with sed/Python scripts ❌
2. Use insecure credential interpolation ❌
3. Access credentials that weren't properly configured ❌

## The Solution (Already Implemented)

I've fixed the Jenkinsfile to use **industry-standard practices**:

1. ✅ Static signing config in `build.gradle` (no runtime modification)
2. ✅ Secure credential handling with `withCredentials`
3. ✅ Proper separation: credentials live in Jenkins, not in code

## What YOU Need to Do (15 minutes)

### 1. Upload the Keystore to Jenkins (5 min)

**On Jenkins VPS:**

1. Open browser: `http://your-jenkins-server:8080`
2. Navigate: **Manage Jenkins** → **Credentials** → **(global)** → **Add Credentials**

**Add 4 credentials with these EXACT IDs:**

#### Credential 1: Keystore File

```
Kind: Secret file
ID: android-keystore-file
File: [Upload your .keystore or .jks file]
Description: HiveSnaps Release Keystore
```

#### Credential 2: Keystore Password

```
Kind: Secret text
ID: android-keystore-password
Secret: [Your keystore password]
Description: HiveSnaps Keystore Password
```

#### Credential 3: Key Alias

```
Kind: Secret text
ID: android-key-alias
Secret: [Your key alias, e.g., "hivesnaps"]
Description: HiveSnaps Key Alias
```

#### Credential 4: Key Password

```
Kind: Secret text
ID: android-key-password
Secret: [Your key password]
Description: HiveSnaps Key Password
```

### 2. Push the Fixed Code (2 min)

The code is already fixed on this branch. You need to:

```bash
# Pull the latest changes (I just made them)
git pull origin main

# Push to your branch or merge to main
git push origin HEAD:main
```

### 3. Trigger a Test Build (1 min)

In Jenkins:

1. Go to your HiveSnaps job
2. Click **Build Now**
3. Watch the console output

### 4. Verify Success (2 min)

The console should show:

```
=== Setting up release signing for production build ===
✓ Release signing configured successfully
  - Keystore: release.keystore
  - Key alias: [your alias]

=== APK Signature Info ===
Signer #1 certificate DN: CN=Your Name, ...

✓ Build completed successfully
✓ APK built successfully
✓ AAB built successfully (with release signing)
```

---

## If It Still Fails

### Error: "Credential not found"

**Cause:** Credential IDs don't match exactly
**Fix:** Check spelling and case - must be EXACTLY:

- `android-keystore-file`
- `android-keystore-password`
- `android-key-alias`
- `android-key-password`

### Error: "Permission denied" when copying keystore

**Cause:** Jenkins user can't write to android/app/
**Fix:** SSH to Jenkins server:

```bash
sudo chown -R jenkins:jenkins /var/lib/jenkins/workspace/hivesnaps
```

### Error: "Keystore was tampered with, or password was incorrect"

**Cause:** Wrong password or corrupted keystore
**Fix:** Test keystore locally:

```bash
keytool -list -v -keystore your-keystore.jks
# Enter password - should show certificate details
```

### Build Succeeds but AAB is Debug-Signed

**Cause:** Not on main branch
**Solution:** This is expected! Release signing ONLY happens on main branch.

- If testing on feature branch: Enable `FORCE_RELEASE_SIGNING` parameter

---

## Understanding the New Flow

### OLD (Broken) Approach:

```
Prebuild → Modify build.gradle with sed/Python → Build
          ↑ This was fragile and failed
```

### NEW (Professional) Approach:

```
Prebuild → Inject credentials to gradle.properties → Build reads gradle.properties → Success!
          ↑ Standard Android practice
```

The `build.gradle` now has a **static** release signing config that reads from `gradle.properties`. Jenkins injects the credentials into `gradle.properties` at build time.

---

## What About the Keystore File Location?

### ❌ OLD thinking: "Put keystore in repo"

**Problem:** Security risk, gets committed to Git

### ✅ NEW approach: "Store in Jenkins, inject at build time"

**Flow:**

1. You upload keystore to Jenkins UI (one time)
2. Jenkins stores it encrypted
3. During build: Jenkins copies it to `android/app/release.keystore`
4. Gradle reads it and signs the APK/AAB
5. After build: Workspace is cleaned, keystore is deleted
6. Next build: Repeat steps 3-5

**Result:** Keystore never exists in Git, only temporarily during builds

---

## Next Steps After First Successful Build

Once you verify it works:

### For Regular Development:

- Just push to main → auto-builds with release signing ✅
- Download AAB from Jenkins → upload to Play Store manually

### For Advanced Auto-Publishing (Optional):

1. Follow [JENKINS_COMPLETE_SETUP.md](JENKINS_COMPLETE_SETUP.md)
2. Set up Google Play service account
3. Enable `PUBLISH_TO_PLAYSTORE` parameter
4. Build → auto-publishes to Play Store internal track

---

## Testing Your Local Keystore

Before uploading to Jenkins, verify it works:

```bash
# Test keystore locally
cd android
./gradlew assembleRelease \
  -PRELEASE_STORE_FILE=/path/to/your/keystore.jks \
  -PRELEASE_STORE_PASSWORD=yourpassword \
  -PRELEASE_KEY_ALIAS=youralias \
  -PRELEASE_KEY_PASSWORD=yourkeypassword

# If successful, check signature:
jarsigner -verify -verbose app/build/outputs/apk/release/app-release.apk
```

If that works locally, it will work in Jenkins!

---

## Summary

1. ✅ Code is fixed (Jenkinsfile + build.gradle)
2. ⏳ **YOU DO:** Add 4 credentials to Jenkins (5 min)
3. ⏳ **YOU DO:** Push code and trigger build (2 min)
4. ✅ Profit! Automated builds with proper signing

**Total time needed from you:** ~15 minutes

---

## Questions?

Ping me if:

- Credentials are configured but build still fails
- You don't know where your keystore file is
- You need help setting up Play Store auto-publishing

**Pro tip:** Start simple - just get the basic signed AAB working first. Auto-publishing to Play Store can come later.

---

**Created:** January 6, 2026
**For:** Andres F. Mena
