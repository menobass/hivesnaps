# 🎯 HiveSnaps Image Upload Migration Guide

## Overview
Migration from **Cloudinary** to **images.hive.blog** for cost-effective, blockchain-native image hosting.

---

## 🔄 **Migration Benefits**

### Cost Analysis
| Provider | Cost per Image | Monthly (1000 images) | Yearly (12k images) |
|----------|----------------|----------------------|-------------------|
| **Cloudinary** | ~$0.001 | ~$1.00 | ~$12.00 |
| **Hive Images** | **$0.00** | **$0.00** | **$0.00** |

### Additional Benefits
- ✅ **Zero Cost** - No hosting fees
- ✅ **Blockchain Native** - Images stored on Hive infrastructure  
- ✅ **Decentralized** - No single point of failure
- ✅ **Community Owned** - Uses Hive ecosystem resources
- ✅ **Faster Integration** - Direct blockchain integration

---

## 🛠 **Implementation Details**

### New Files Created
1. **`utils/hiveImageUpload.ts`** - Core Hive upload functionality
2. **`utils/imageUploadService.ts`** - Unified service with fallback support
3. **This migration guide**

### Files Modified
- `hooks/useReply.ts` - Updated reply image uploads
- `hooks/useEdit.ts` - Updated edit image uploads  
- `app/ComposeScreen.tsx` - Updated composer image uploads
- `hooks/useAvatarManagement.ts` - Updated avatar uploads

---

## 🎛 **Smart Migration Strategy**

### Automatic Provider Selection
```typescript
// The service automatically chooses the best provider:

1. If user is logged in with Hive credentials → Use Hive Images (FREE)
2. If no Hive credentials available → Fallback to Cloudinary
3. If Hive upload fails → Graceful fallback to Cloudinary
```

### Usage Examples
```typescript
// Simple upload (auto-detects best provider)
const result = await uploadImageSmart(file, username);
console.log(`Uploaded via ${result.provider} (cost: $${result.cost})`);

// Manual provider selection
const result = await uploadImage(file, { 
  provider: 'hive',
  username: 'myuser',
  privateKey: 'posting_key_here'
});

// With fallback
const result = await uploadImage(file, { 
  provider: 'hive',
  fallbackToCloudinary: true
});
```

---

## 🔐 **Security Implementation**

### Hive Signature Process
1. **File Hash**: Creates SHA256 hash of file content
2. **Challenge Hash**: Combines "ImageSigningChallenge" + file hash
3. **Digital Signature**: Signs with user's private posting key
4. **Upload**: Sends to `https://images.hive.blog/{username}/{signature}`

### Credential Management
- Private keys fetched securely from `expo-secure-store`
- No keys stored in memory longer than necessary
- Automatic fallback if credentials unavailable

---

## 📊 **Migration Status**

### ✅ Completed
- [x] Core Hive upload utility
- [x] Unified service with fallback
- [x] Reply modal image uploads
- [x] Edit modal image uploads  
- [x] Composer screen image uploads
- [x] Avatar management uploads
- [x] Automatic provider detection
- [x] Cost tracking and logging

### 🔄 Gradual Rollout
The migration is **backward compatible**:
- Existing Cloudinary uploads continue working
- New uploads automatically use Hive when possible
- Seamless fallback for edge cases

### 📈 Expected Results
- **Immediate**: 0% cost increase (maintains Cloudinary fallback)
- **Short term**: 70-80% uploads via Hive (logged in users)
- **Long term**: 95%+ uploads via Hive (nearly zero cost)

---

## 🚀 **Next Steps**

### Phase 1: Monitoring (Current)
- Deploy and monitor upload success rates
- Track provider usage statistics
- Gather user feedback

### Phase 2: Optimization
- Fine-tune fallback logic
- Optimize upload performance
- Add upload analytics dashboard

### Phase 3: Full Migration
- Deprecate Cloudinary for new uploads
- Migrate existing images (optional)
- Remove Cloudinary dependency

---

## 🐛 **Troubleshooting**

### Common Issues
1. **"Failed to create image signature"**
   - Check private key format
   - Verify file can be read
   - Fallback: Uses Cloudinary

2. **"No URL returned from image upload"**
   - Hive service temporary issue
   - Fallback: Uses Cloudinary

3. **"Image upload failed: 403"**
   - Invalid signature
   - Wrong username/key combination
   - Fallback: Uses Cloudinary

### Debug Logging
All uploads include comprehensive logging:
```
[ImageUploadService] Starting upload with provider: auto
[ImageUploadService] Auto-selected provider: hive
[ImageUploadService] Uploading to Hive...
[useReply] Image uploaded via hive (cost: $0)
```

---

## 💡 **Best Practices**

### For Developers
- Always handle upload failures gracefully
- Log provider usage for monitoring
- Test both Hive and Cloudinary paths

### For Users
- Stay logged in for free uploads
- Images upload seamlessly regardless of provider
- No changes to user experience

---

## 📞 **Support**

### If Issues Arise
1. Check console logs for provider selection
2. Verify user authentication status
3. Test with small image first
4. Report persistent issues for investigation

The migration is designed to be **transparent, reliable, and cost-effective** while maintaining full backward compatibility.
