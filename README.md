# HiveSnaps 📸

HiveSnaps is a cutting-edge React Native mobile app built with Expo and TypeScript that brings the power of the Hive blockchain to short-form social media content. Think Twitter meets Instagram, but decentralized and powered by Web3.

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![Expo](https://img.shields.io/badge/Expo-~53.0.12-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-~5.8.3-blue.svg)
![Hive](https://img.shields.io/badge/Blockchain-Hive-red.svg)

## ✨ Features

### 🔐 Blockchain Integration

- **Hive Blockchain Authentication** - Secure login with Hive posting keys
- **Decentralized Content** - All posts stored on-chain via @peak.snaps
- **Voting & Rewards** - Upvote posts with customizable weight (1-100%)
- **Real-time Reward Calculation** - See vote values in USD before voting
- **Voting Power Display** - Track your voting power with helpful tooltips

### 📱 Social Features

- **Multiple Feed Views** - Following, Newest, Trending, and My Snaps
- **Rich Text Support** - Markdown rendering with hashtag detection
- **User Profiles** - View any user's profile with post history
- **Threaded Conversations** - Full reply system with nested discussions
- **Mentions & Hashtags** - @username mentions and #hashtag discovery
- **Smart Caching** - 5-minute intelligent feed caching for performance

### 🎨 Rich Media Support

- **Image Uploads** - Camera capture or gallery selection with Cloudinary hosting
- **GIF Integration** - Powered by Tenor API with search functionality
- **Video Embedding** - YouTube, 3Speak, and IPFS video support
- **Twitter/X Embeds** - Native tweet rendering in posts
- **Image Galleries** - Full-screen image viewing with zoom

### 📝 Content Creation

- **Smart Composer** - Rich text editor with live previews
- **Media Attachments** - Images, GIFs, and video embeds
- **Edit Functionality** - Edit your posts and replies after publishing
- **Optimistic Updates** - Instant UI updates for better UX
- **Draft Support** - Auto-save functionality (coming soon)

### 🔔 User Experience

- **Notifications System** - Track mentions, votes, and replies
- **Dark/Light Theme** - Automatic theme switching
- **Pull-to-Refresh** - Intuitive feed updates
- **Infinite Scroll** - Smooth content loading
- **Offline Support** - Cached content available offline
- **Haptic Feedback** - Native mobile interactions

### 🎯 Discovery Features

- **Hashtag Explorer** - Discover content by topics
- **User Search** - Find and follow interesting accounts
- **Trending Algorithm** - Content ranked by blockchain rewards
- **External Link Handling** - Smart preview and opening

## 🛠 Technical Stack

### Frontend

- **React Native** (0.79.4) with Expo (53.0.12)
- **TypeScript** for type safety
- **Expo Router** for navigation
- **React Native Reanimated** for smooth animations
- **Expo AV** for video playback

### Blockchain

- **@hiveio/dhive** for Hive blockchain integration
- **Expo Secure Store** for private key management
- **Real-time API** connections to multiple Hive nodes

### Media & Storage

- **Cloudinary** for image hosting and optimization
- **Tenor API** for GIF search and integration
- **Expo Image Picker** for camera/gallery access
- **AsyncStorage** for local data persistence

### UI/UX

- **Safe Area Context** for notch/status bar handling
- **React Native Webview** for embedded content
- **React Native Markdown** for rich text rendering
- **Custom Icon System** with FontAwesome

## 🚀 Getting Started

1. **Clone the repository:**

   ```sh
   git clone https://github.com/menobass/hivesnaps.git
   cd hivesnaps
   ```

2. **Install dependencies:**

   ```sh
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file with your API keys:

   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   TENOR_API_KEY=your_tenor_key
   ```

4. **Start the development server:**

   ```sh
   npx expo start
   ```

5. **Run on device:**
   - Use Expo Go app for development
   - Or build development client: `npx expo run:android` / `npx expo run:ios`

## 📱 Platform Support

- **iOS** - Full feature support with native integrations
- **Android** - Complete Android experience with edge-to-edge UI
- **Web** - Progressive Web App capabilities (limited features)

## 🔧 Development

### Testing

```sh
npm test
```

### Building for Production

```sh
# Android
npx expo build:android

# iOS
npx expo build:ios
```

### Code Structure

```
app/
├── components/        # Reusable UI components
├── utils/            # Helper functions and utilities
├── hooks/            # Custom React hooks
├── assets/           # Images, fonts, and static files
└── screens/          # Main application screens
```

## 🎯 Roadmap

### v1.2.0 (Next Release)

- [ ] Push notifications for mentions and votes
- [ ] Advanced search functionality
- [ ] Post scheduling
- [ ] Multiple account support

### v1.3.0 (Future)

- [ ] Stories feature (24h expiring content)
- [ ] Live streaming integration
- [ ] Community creation tools
- [ ] Advanced analytics dashboard

### v2.0.0 (Long-term)

- [ ] Cross-chain support (other blockchains)
- [ ] NFT integration
- [ ] Decentralized messaging
- [ ] DAO governance features

## 🤝 Contributing

We welcome contributions! Please read our contributing guidelines and submit pull requests for any improvements.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Hive Blockchain** - For providing the decentralized infrastructure
- **Peak.d** - For the @peak.snaps container system
- **Expo Team** - For the amazing development platform
- **React Native Community** - For the open-source ecosystem

---

**HiveSnaps** - _What's snappening today?_ 🚀

Follow us: [@hivesnaps](https://hive.blog/@hivesnaps) | Join our community on [Discord](https://discord.gg/CgJP7t7nWy)
