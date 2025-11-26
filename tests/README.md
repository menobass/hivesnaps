# Test Scripts

This folder contains standalone test scripts for HiveSnaps features.

## Purpose
These are **manual test scripts** used for:
- Testing specific features in isolation
- Verifying bug fixes
- Testing external API integrations
- Quick feature validation during development

## Scripts

- `test-hashtag-fix.js` - Test hashtag parsing fixes
- `test-hashtag-hyphen.js` - Test hashtag handling with hyphens
- `test-hashtag-minimal-fix.js` - Minimal hashtag parsing test
- `test-image-detection.js` - Test image URL detection logic
- `test-image-fix.js` - Test image parsing fixes
- `test-ipfs-upload.js` - Test IPFS upload functionality
- `test-legacy-watch-url.js` - Test YouTube watch URL handling
- `test-notification-muting.js` - Test notification muting logic
- `test-spoiler.js` - Test spoiler tag parsing

## Usage
Run scripts with Node.js:
```bash
node tests/test-hashtag-fix.js
```

## Note
These are **not** Jest unit tests. For automated unit tests, see the `/test` directory.
These scripts are for manual testing and debugging during development.
