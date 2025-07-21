# HiveSnaps Share Extension

This document explains the share extension functionality implemented in HiveSnaps, allowing users to share content from other apps directly into HiveSnaps.

## Overview

The share extension feature enables users to:
- Share text from other apps into HiveSnaps compose screen
- Share URLs from browsers and other apps
- Share images from the photo gallery
- Share multiple images (first image shown, others as URLs in text)

## Architecture

### Components

1. **`useSharedContent` Hook** (`hooks/useSharedContent.ts`)
   - Manages shared content detection and processing
   - Uses `react-native-share-menu` to listen for shared data
   - Processes different content types (text, URL, image, multiple images)

2. **ShareContext** (`context/ShareContext.tsx`)
   - Provides global access to shared content state
   - Automatically navigates to compose screen when content is shared

3. **ComposeScreen** (`app/ComposeScreen.tsx`)
   - Dedicated screen for creating new posts
   - Handles pre-populated content from share extension
   - Supports text input, image upload, and posting to Hive blockchain

### Configuration

#### App Configuration (`app.json`)

The app is configured to handle share intents:

**Android:**
```json
"intentFilters": [
  {
    "action": "android.intent.action.SEND",
    "category": ["android.intent.category.DEFAULT"],
    "data": [
      { "mimeType": "text/plain" },
      { "mimeType": "image/*" }
    ]
  },
  {
    "action": "android.intent.action.SEND_MULTIPLE",
    "category": ["android.intent.category.DEFAULT"],
    "data": [{ "mimeType": "image/*" }]
  }
]
```

**iOS:**
```json
"infoPlist": {
  "CFBundleURLTypes": [
    {
      "CFBundleURLName": "hivesnaps",
      "CFBundleURLSchemes": ["hivesnaps"]
    }
  ]
}
```

#### Plugin Configuration

The `react-native-share-menu` plugin is included in the plugins array:

```json
"plugins": [
  "expo-router",
  "expo-secure-store",
  "react-native-share-menu"
]
```

## Usage Flow

1. **User shares content from another app** (e.g., selecting text in browser and choosing "Share")
2. **HiveSnaps appears in the share sheet** as an available target
3. **User selects HiveSnaps** from share options
4. **App opens (or comes to foreground)** and the ShareProvider detects incoming content
5. **Navigation occurs automatically** to ComposeScreen with pre-populated content
6. **User can edit and post** the shared content to Hive blockchain

## Content Type Handling

### Text Content
- Plain text is added to the compose text field
- URLs are detected and added as clickable links

### Images
- Single images are set as the main image attachment
- Multiple images: first image becomes attachment, others added as URLs in text

### URLs
- Web URLs are added to text field and will be linkified
- Special handling for social media URLs (Twitter/X, YouTube, etc.)

## Technical Details

### Dependencies
- `react-native-share-menu`: Core share extension functionality
- `expo-router`: Navigation between screens
- `@hiveio/dhive`: Posting to Hive blockchain

### Key Features
- **Cross-platform**: Works on both iOS and Android
- **Automatic navigation**: Seamlessly opens compose screen with shared content
- **Content processing**: Intelligently handles different data types
- **Error handling**: Graceful fallbacks for unsupported content
- **User experience**: Non-intrusive integration with existing app flow

## Testing

To test the share extension:

1. **Build and install the app** on a physical device (share extensions don't work in simulators)
2. **Open another app** (browser, photo gallery, notes app)
3. **Select content to share** (text, image, or URL)
4. **Tap the share button** and look for HiveSnaps in the share sheet
5. **Select HiveSnaps** - the app should open with content pre-populated in compose screen

## Future Enhancements

Potential improvements to the share extension:
- Support for video files
- Better handling of rich text formatting
- Share extension widget for quick posting without opening main app
- Bulk image sharing with album creation
- Integration with Hive communities/tags based on source app

## Troubleshooting

### Share option not appearing
- Ensure app is installed via development build or App Store (not Expo Go)
- Check that intent filters are properly configured in app.json
- Restart the device after installing the app

### Content not pre-populating
- Check console logs for ShareMenu errors
- Verify the useSharedContent hook is properly integrated
- Ensure ShareProvider wraps the app in _layout.tsx

### Navigation issues
- Verify ComposeScreen route is registered in Stack.Screen
- Check router.push() path matches screen component file name
