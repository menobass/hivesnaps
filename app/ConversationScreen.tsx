import React, { useState } from 'react';
import { SafeAreaView as SafeAreaViewRN } from 'react-native';
import { SafeAreaView as SafeAreaViewSA, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, FlatList, useColorScheme, Image, Pressable } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinaryFixed } from '../utils/cloudinaryImageUploadFixed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Client, PrivateKey } from '@hiveio/dhive';
import Modal from 'react-native-modal';
import Markdown from 'react-native-markdown-display';
import { WebView } from 'react-native-webview';
import { extractVideoInfo, removeVideoUrls, extractYouTubeId } from '../utils/extractVideoInfo';
import * as SecureStore from 'expo-secure-store';
import Slider from '@react-native-community/slider';
import IPFSVideoPlayer from './components/IPFSVideoPlayer';
import { Image as ExpoImage } from 'expo-image';
import RenderHtml from 'react-native-render-html';
import { Dimensions } from 'react-native';

// Placeholder Snap data type
interface SnapData {
  author: string;
  avatarUrl?: string;
  body: string;
  created: string;
  voteCount?: number;
  replyCount?: number;
  payout?: number;
  permlink?: string;
  hasUpvoted?: boolean;
  active_votes?: any[]; // Add active_votes to store raw voting data
}

// Placeholder reply type
interface ReplyData extends SnapData {
  replies?: ReplyData[];
  active_votes?: any[]; // Add active_votes to store raw voting data
}

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

const ConversationScreen = () => {
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Use Expo Router's useLocalSearchParams to get navigation params
  const params = useLocalSearchParams();
  const author = params.author as string | undefined;
  const permlink = params.permlink as string | undefined;
  console.log('Expo Router params:', params); // Debug log
  if (!author || !permlink) {
    console.error('Missing navigation parameters: author and permlink');
    return (
      <SafeAreaViewRN style={[styles.safeArea, { backgroundColor: isDark ? '#15202B' : '#fff' }]}> 
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <Text style={{ color: isDark ? '#D7DBDC' : '#0F1419', fontSize: 16 }}>Error: Missing conversation parameters.</Text>
        </View>
      </SafeAreaViewRN>
    );
  }

  const [snap, setSnap] = useState<SnapData | null>(null);
  const [replies, setReplies] = useState<ReplyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyImage, setReplyImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  // Track which reply (by author/permlink) is being replied to
  const [replyTarget, setReplyTarget] = useState<{author: string, permlink: string} | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

  // Upvote modal state
  const [upvoteModalVisible, setUpvoteModalVisible] = useState(false);
  const [upvoteTarget, setUpvoteTarget] = useState<{ author: string; permlink: string } | null>(null);
  const [voteWeight, setVoteWeight] = useState(100);
  const [upvoteLoading, setUpvoteLoading] = useState(false);
  const [upvoteSuccess, setUpvoteSuccess] = useState(false);

  // Load user credentials on mount
  React.useEffect(() => {
    const loadCredentials = async () => {
      try {
        const storedUsername = await SecureStore.getItemAsync('hive_username');
        setCurrentUsername(storedUsername);
      } catch (e) {
        console.error('Error loading credentials:', e);
      }
    };
    loadCredentials();
  }, []);

  // Recursively fetch replies, ensuring each reply has full content (including payout info and avatar)
  async function fetchRepliesTreeWithContent(author: string, permlink: string, depth = 0, maxDepth = 3): Promise<any[]> {
    if (depth > maxDepth) return [];
    // Fetch shallow replies
    const res = await fetch('https://api.hive.blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'condenser_api.get_content_replies',
        params: [author, permlink],
        id: 1,
      }),
    });
    const data = await res.json();
    const shallowReplies = data.result || [];
    // For each reply, fetch full content and recurse
    const fullReplies: ReplyData[] = [];
    for (const reply of shallowReplies) {
      // Fetch full content for this reply
      let fullReply;
      try {
        fullReply = await client.database.call('get_content', [reply.author, reply.permlink]);
      } catch (e) {
        fullReply = reply; // fallback
      }
      // Fetch avatar for reply author
      let avatarUrl: string | undefined = undefined;
      try {
        const accounts = await client.database.call('get_accounts', [[fullReply.author]]);
        if (accounts && accounts[0]) {
          let meta = accounts[0].posting_json_metadata;
          if (!meta || meta === '{}') {
            meta = accounts[0].json_metadata;
          }
          if (meta) {
            let profile;
            try {
              profile = JSON.parse(meta).profile;
            } catch (e) {
              profile = undefined;
            }
            if (profile && profile.profile_image) {
              avatarUrl = profile.profile_image;
            }
          }
        }
      } catch (e) {
        // Avatar fetch fail fallback
      }
      // Parse payout
      const payout = parseFloat(fullReply.pending_payout_value ? fullReply.pending_payout_value.replace(' HBD', '') : '0');
      // Recursively fetch children
      const childrenReplies = await fetchRepliesTreeWithContent(reply.author, reply.permlink, depth + 1, maxDepth);
      // Build reply object
      fullReplies.push({
        author: fullReply.author,
        avatarUrl,
        body: fullReply.body,
        created: fullReply.created,
        voteCount: fullReply.net_votes,
        replyCount: fullReply.children,
        payout,
        permlink: fullReply.permlink,
        active_votes: fullReply.active_votes, // Keep the raw active_votes data
        replies: childrenReplies,
      });
    }
    return fullReplies;
  }

  // Fetch snap and replies (extracted for refresh)
  const fetchSnapAndReplies = async () => {
    setLoading(true);
    try {
      // Fetch the main post
      const post = await client.database.call('get_content', [author, permlink]);
      // Fetch avatar robustly from account profile
      let avatarUrl: string | undefined = undefined;
      try {
        let meta;
        const accounts = await client.database.call('get_accounts', [[post.author]]);
        if (accounts && accounts[0]) {
          meta = accounts[0].posting_json_metadata;
          if (!meta || meta === '{}') {
            meta = accounts[0].json_metadata;
          }
          if (meta) {
            let profile;
            try {
              profile = JSON.parse(meta).profile;
            } catch (e) {
              profile = undefined;
            }
            if (profile && profile.profile_image) {
              avatarUrl = profile.profile_image;
            }
          }
        }
      } catch (e) {
        // Avatar fetch fail fallback
      }
      setSnap({
        author: post.author,
        avatarUrl,
        body: post.body,
        created: post.created,
        voteCount: post.net_votes,
        replyCount: post.children,
        payout: parseFloat(post.pending_payout_value ? post.pending_payout_value.replace(' HBD', '') : '0'),
        permlink: post.permlink,
        active_votes: post.active_votes, // Keep the raw active_votes data
      });
      // Fetch replies tree with full content (including payout info)
      const tree = await fetchRepliesTreeWithContent(author, permlink);
      setReplies(tree);
    } catch (e) {
      console.error('Error fetching snap and replies:', e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (currentUsername) {
      fetchSnapAndReplies();
    }
  }, [author, permlink, currentUsername]);

  const colors = {
    background: isDark ? '#15202B' : '#fff',
    text: isDark ? '#D7DBDC' : '#0F1419',
    bubble: isDark ? '#22303C' : '#f7f9f9',
    border: isDark ? '#38444D' : '#eee',
    icon: '#1DA1F2',
    payout: '#17BF63',
    button: '#1DA1F2',
    buttonInactive: isDark ? '#22303C' : '#E1E8ED',
  };

  const handleRefresh = () => {
    fetchSnapAndReplies();
  };

  const handleAddImage = async () => {
    try {
      // Show action sheet to choose between camera and gallery
      let pickType: 'camera' | 'gallery' | 'cancel';
      
      if (Platform.OS === 'ios') {
        pickType = await new Promise<'camera' | 'gallery' | 'cancel'>(resolve => {
          import('react-native').then(({ ActionSheetIOS }) => {
            ActionSheetIOS.showActionSheetWithOptions(
              {
                options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
                cancelButtonIndex: 0,
              },
              buttonIndex => {
                if (buttonIndex === 0) pickType = 'cancel';
                else if (buttonIndex === 1) pickType = 'camera';
                else if (buttonIndex === 2) pickType = 'gallery';
                resolve(pickType);
              }
            );
          });
        });
      } else {
        pickType = await new Promise<'camera' | 'gallery' | 'cancel'>(resolve => {
          import('react-native').then(({ Alert }) => {
            Alert.alert(
              'Add Image',
              'Choose an option',
              [
                { text: 'Take Photo', onPress: () => resolve('camera') },
                { text: 'Choose from Gallery', onPress: () => resolve('gallery') },
                { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
              ],
              { cancelable: true }
            );
          });
        });
      }
      
      if (pickType === 'cancel') return;
      
      // Pick image
      let result;
      if (pickType === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          alert('Permission to access camera is required!');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          alert('Permission to access media library is required!');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'], // Fixed deprecation warning - use array of strings
          allowsEditing: true,
          quality: 0.8,
        });
      }
      
      if (!result || result.canceled || !result.assets || !result.assets[0]) return;
      const asset = result.assets[0];
      
      setUploading(true);
      try {
        const fileToUpload = {
          uri: asset.uri,
          name: `reply-${Date.now()}.jpg`,
          type: 'image/jpeg',
        };
        const cloudinaryUrl = await uploadImageToCloudinaryFixed(fileToUpload);
        setReplyImage(cloudinaryUrl);
      } catch (err) {
        alert('Image upload failed: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
      }
      setUploading(false);
    } catch (err) {
      alert('Failed to pick image: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
      setUploading(false);
    }
  };

  const handleOpenReplyModal = (author: string, permlink: string) => {
    setReplyTarget({ author, permlink });
    setReplyModalVisible(true);
  };
  const handleCloseReplyModal = () => {
    setReplyModalVisible(false);
    setReplyText('');
    setReplyImage(null);
    setReplyTarget(null);
  };

  const handleSubmitReply = async () => {
    if (!replyTarget || !replyText.trim() || !currentUsername) return;
    setPosting(true);
    setPostError(null);
    try {
      // Get posting key from secure storage
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) {
        throw new Error('No posting key found. Please log in again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      let body = replyText.trim();
      if (replyImage) {
        body += `\n![image](${replyImage})`;
      }
      const parent_author = replyTarget.author;
      const parent_permlink = replyTarget.permlink;
      const author = currentUsername;
      const permlink = `re-${parent_author}-${parent_permlink}-${Date.now()}`;
      const json_metadata: any = {
        app: 'hivesnaps/1.0',
        format: 'markdown',
        tags: ['hivesnaps', 'reply'],
      };
      if (replyImage) {
        json_metadata.image = [replyImage];
      }
      // Real posting to Hive blockchain
      await client.broadcast.comment({
        parent_author,
        parent_permlink,
        author,
        permlink,
        title: '',
        body,
        json_metadata: JSON.stringify(json_metadata),
      }, postingKey);
      
      setReplyModalVisible(false);
      setReplyText('');
      setReplyImage(null);
      setPosting(false);
      setReplyTarget(null);
      // Refresh after a delay to allow blockchain confirmation
      setTimeout(() => {
        handleRefresh();
      }, 3000);
    } catch (e: any) {
      setPostError(e.message || 'Failed to post reply.');
      setPosting(false);
    }
  };

  // --- Upvote handlers ---
  const handleUpvotePress = ({ author, permlink }: { author: string; permlink: string }) => {
    setUpvoteTarget({ author, permlink });
    setVoteWeight(100);
    setUpvoteModalVisible(true);
  };

  const handleUpvoteCancel = () => {
    setUpvoteModalVisible(false);
    setUpvoteTarget(null);
    setVoteWeight(100);
  };

  const handleUpvoteConfirm = async () => {
    if (!upvoteTarget || !currentUsername) return;
    setUpvoteLoading(true);
    setUpvoteSuccess(false);
    try {
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) throw new Error('No posting key found. Please log in again.');
      const postingKey = PrivateKey.fromString(postingKeyStr);
      let weight = Math.round(voteWeight * 100);
      if (weight > 10000) weight = 10000;
      if (weight < 1) weight = 1;
      await client.broadcast.vote(
        {
          voter: currentUsername,
          author: upvoteTarget.author,
          permlink: upvoteTarget.permlink,
          weight,
        },
        postingKey
      );
      // Optimistically update UI
      setSnap((prev) =>
        prev && prev.author === upvoteTarget.author && prev.permlink === upvoteTarget.permlink
          ? { 
              ...prev, 
              voteCount: (prev.voteCount || 0) + 1,
              active_votes: [
                ...(prev.active_votes || []),
                { voter: currentUsername, percent: weight }
              ]
            }
          : prev
      );
      setReplies((prevReplies) =>
        prevReplies.map((reply) =>
          updateReplyUpvoteOptimistic(reply, upvoteTarget, currentUsername, weight)
        )
      );
      setUpvoteLoading(false);
      setUpvoteSuccess(true);
      setTimeout(() => {
        setUpvoteModalVisible(false);
        setUpvoteSuccess(false);
        setUpvoteTarget(null);
        handleRefresh();
      }, 2000);
    } catch (err) {
      setUpvoteLoading(false);
      setUpvoteSuccess(false);
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      alert('Upvote failed: ' + errorMsg);
    }
  };

  // Helper to optimistically update hasUpvoted for replies (recursive)
  function updateReplyUpvoteOptimistic(reply: ReplyData, target: { author: string; permlink: string }, username: string, weight: number): ReplyData {
    let updated = { ...reply };
    if (reply.author === target.author && reply.permlink === target.permlink) {
      updated.voteCount = (reply.voteCount || 0) + 1;
      updated.active_votes = [
        ...(reply.active_votes || []),
        { voter: username, percent: weight }
      ];
    }
    if (reply.replies && reply.replies.length > 0) {
      updated.replies = reply.replies.map((r) => updateReplyUpvoteOptimistic(r, target, username, weight));
    }
    return updated;
  }

  // Render a single reply (flat, not threaded yet)
  const renderReply = ({ item }: { item: ReplyData }) => {
    console.log('Reply payout:', item.payout, 'for', item.author, item.permlink);
    return (
      <View style={[styles.replyBubble, { backgroundColor: colors.bubble }]}> 
        <Text style={[styles.replyAuthor, { color: colors.text }]}>{item.author}</Text>
        <Markdown
          style={{
            body: { color: colors.text, fontSize: 14, marginBottom: 4 },
            link: { color: colors.icon },
          }}
        >
          {item.body}
        </Markdown>
        <View style={styles.replyMeta}>
          <FontAwesome name="arrow-up" size={16} color={colors.icon} />
          <Text style={[styles.replyMetaText, { color: colors.text }]}>{item.voteCount || 0}</Text>
          <FontAwesome name="comment-o" size={16} color={colors.icon} style={{ marginLeft: 12 }} />
          <Text style={[styles.replyMetaText, { color: colors.payout, marginLeft: 12 }]}>{item.payout !== undefined ? `$${item.payout.toFixed(2)}` : ''}</Text>
        </View>
      </View>
    );
  };

  // Utility to remove all video URLs from text (updated for multiple platforms)
  function removeAllVideoUrls(text: string): string {
    return removeVideoUrls(text);
  }

  // Custom markdown rules with 'any' types to silence TS warnings
  const markdownRules = {
    image: (
      node: any,
      children: any,
      parent: any,
      styles: any
    ) => {
      const { src, alt } = node.attributes;
      return (
        <Pressable
          key={src || alt}
          onPress={() => {
            setModalImageUrl(src);
            setImageModalVisible(true);
          }}
        >
          <ExpoImage
            source={{ uri: src }}
            style={{
              width: '100%',
              aspectRatio: 1.2, // or 1.5 for landscape, adjust as needed
              maxHeight: 340,
              borderRadius: 14,
              marginVertical: 10,
              alignSelf: 'center',
              backgroundColor: isDark ? '#222' : '#eee',
            }}
            contentFit="cover"
            accessibilityLabel={alt || 'image'}
          />
        </Pressable>
      );
    },
    html: (
      node: any,
      children: any,
      parent: any,
      styles: any
    ) => {
      // Handle iframe tags for IPFS videos and other embedded content
      const htmlContent = node.content || '';
      const iframeMatch = htmlContent.match(/<iframe[^>]+src=["']([^"']*ipfs[^"']*\/ipfs\/([A-Za-z0-9]+))[^"']*["'][^>]*>/i);
      
      if (iframeMatch) {
        const ipfsUrl = iframeMatch[1];
        return (
          <View key={ipfsUrl} style={{ marginVertical: 10 }}>
            <IPFSVideoPlayer ipfsUrl={ipfsUrl} isDark={isDark} />
          </View>
        );
      }
      
      // Default HTML rendering (let markdown handle it)
      return null;
    },
    link: (
      node: any,
      children: any,
      parent: any,
      styles: any
    ) => {
      const { href } = node.attributes;
      // Enhanced video link detection (supports YouTube, 3speak, IPFS)
      const youtubeMatch = href && href.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      const threeSpeakMatch = href && href.match(/https:\/\/3speak\.tv\/watch\?v=([^\/\s]+)\/([a-zA-Z0-9_-]+)/);
      const ipfsMatch = href && href.match(/ipfs\/([A-Za-z0-9]+)/);
      
      if (youtubeMatch) {
        const videoId = youtubeMatch[1];
        return (
          <View key={href} style={{ width: '100%', aspectRatio: 16 / 9, marginVertical: 10, borderRadius: 10, overflow: 'hidden', backgroundColor: isDark ? '#222' : '#eee', position: 'relative' }}>
            <WebView
              source={{ uri: `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1` }}
              style={{ flex: 1 }}
              allowsFullscreenVideo
              javaScriptEnabled
              domStorageEnabled
              mediaPlaybackRequiresUserAction={true}
              allowsInlineMediaPlayback={true}
              originWhitelist={['*']}
            />
            <View style={{ 
              position: 'absolute', 
              top: 8, 
              right: 8, 
              backgroundColor: 'rgba(0,0,0,0.7)', 
              paddingHorizontal: 6, 
              paddingVertical: 2, 
              borderRadius: 4 
            }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>YOUTUBE</Text>
            </View>
          </View>
        );
      }
      
      if (threeSpeakMatch) {
        const username = threeSpeakMatch[1];
        const videoId = threeSpeakMatch[2];
        return (
          <View key={href} style={{ width: '100%', aspectRatio: 16 / 9, marginVertical: 10, borderRadius: 10, overflow: 'hidden', backgroundColor: isDark ? '#222' : '#eee', position: 'relative' }}>
            <WebView
              source={{ uri: `https://3speak.tv/embed?v=${username}/${videoId}&autoplay=0` }}
              style={{ flex: 1 }}
              allowsFullscreenVideo
              javaScriptEnabled
              domStorageEnabled
              mediaPlaybackRequiresUserAction={true}
              allowsInlineMediaPlayback={true}
              originWhitelist={['*']}
            />
            <View style={{ 
              position: 'absolute', 
              top: 8, 
              right: 8, 
              backgroundColor: 'rgba(0,0,0,0.7)', 
              paddingHorizontal: 6, 
              paddingVertical: 2, 
              borderRadius: 4 
            }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>3SPEAK</Text>
            </View>
          </View>
        );
      }
      
      if (ipfsMatch) {
        return (
          <View key={href} style={{ marginVertical: 10 }}>
            <IPFSVideoPlayer ipfsUrl={href} isDark={isDark} />
          </View>
        );
      }
      // Default link rendering
      return (
        <Text key={href} style={[{ color: colors.icon, textDecorationLine: 'underline' }]} onPress={() => {
          // Open link in browser
          if (href) {
            // Use Expo's Linking API
            import('expo-linking').then(Linking => Linking.openURL(href));
          }
        }}>
          {children}
        </Text>
      );
    },
  };

  // Add log for snap payout
  if (snap) {
    console.log('Snap payout:', snap.payout, 'for', snap.author, snap.permlink);
  }

  // Utility to check if a string contains HTML tags
  function containsHtml(str: string): boolean {
    return /<([a-z][\s\S]*?)>/i.test(str);
  }

  // Recursive threaded reply renderer
  const renderReplyTree = (reply: ReplyData, level = 0) => {
    const videoInfo = extractVideoInfo(reply.body);
    let textBody = reply.body;
    if (videoInfo) {
      textBody = removeAllVideoUrls(textBody);
    }
    const windowWidth = Dimensions.get('window').width;
    const isHtml = containsHtml(textBody);
    return (
      <View key={reply.author + reply.permlink + '-' + level} style={{ marginLeft: level * 18, marginBottom: 10 }}>
        <View style={[styles.replyBubble, { backgroundColor: colors.bubble }]}> 
          {/* Avatar, author, timestamp row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Pressable
              onPress={() => {
                console.log('Navigating to ProfileScreen for:', reply.author);
                router.push(`/ProfileScreen?username=${reply.author}` as any);
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center' }]}
              accessibilityRole="button"
              accessibilityLabel={`View ${reply.author}'s profile`}
            >
              {reply.avatarUrl ? (
                <ExpoImage source={{ uri: reply.avatarUrl }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, { backgroundColor: isDark ? '#22303C' : '#eee', justifyContent: 'center', alignItems: 'center' }]}> 
                  <FontAwesome name="user" size={22} color={isDark ? '#8899A6' : '#bbb'} />
                </View>
              )}
              <Text style={[styles.replyAuthor, { color: colors.text, marginLeft: 10 }]}>{reply.author}</Text>
            </Pressable>
            <Text style={[styles.snapTimestamp, { color: colors.text }]}>{reply.created ? new Date(reply.created).toLocaleString() : ''}</Text>
          </View>
          {/* Video Player (YouTube, 3speak, IPFS) - Click to play */}
          {videoInfo && (
            <View style={{ marginBottom: 8 }}>
              {videoInfo.type === 'ipfs' ? (
                <IPFSVideoPlayer ipfsUrl={videoInfo.embedUrl} isDark={isDark} />
              ) : (
                <View style={{ width: '100%', aspectRatio: 16/9, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                  <WebView
                    source={{ 
                      uri: videoInfo.type === 'youtube' 
                        ? `${videoInfo.embedUrl}?autoplay=0&rel=0&modestbranding=1`
                        : `${videoInfo.embedUrl}&autoplay=0`
                    }}
                    style={{ flex: 1, backgroundColor: '#000' }}
                    allowsFullscreenVideo
                    javaScriptEnabled
                    domStorageEnabled
                    mediaPlaybackRequiresUserAction={true}
                    allowsInlineMediaPlayback={true}
                  />
                  {/* Video type indicator */}
                  <View style={{ 
                    position: 'absolute', 
                    top: 8, 
                    right: 8, 
                    backgroundColor: 'rgba(0,0,0,0.7)', 
                    paddingHorizontal: 6, 
                    paddingVertical: 2, 
                    borderRadius: 4 
                  }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                      {videoInfo.type.toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
          {isHtml ? (
            <RenderHtml
              contentWidth={windowWidth - (level * 18) - 32}
              source={{ html: textBody }}
              baseStyle={{ color: colors.text, fontSize: 14, marginBottom: 4 }}
              enableExperimentalMarginCollapsing
              tagsStyles={{ a: { color: colors.icon } }}
            />
          ) : (
            <Markdown
              style={{
                body: { color: colors.text, fontSize: 14, marginBottom: 4 },
                link: { color: colors.icon },
              }}
              rules={markdownRules}
            >
              {textBody}
            </Markdown>
          )}
          <View style={styles.replyMeta}>
            <TouchableOpacity
              style={[styles.replyButton, { backgroundColor: 'transparent' }]}
              onPress={() => handleUpvotePress({ author: reply.author, permlink: reply.permlink! })}
              disabled={Array.isArray(reply.active_votes) && reply.active_votes.some((v: any) => v.voter === currentUsername && v.percent > 0)}
            >
              <FontAwesome name="arrow-up" size={16} color={Array.isArray(reply.active_votes) && reply.active_votes.some((v: any) => v.voter === currentUsername && v.percent > 0) ? '#8e44ad' : colors.icon} />
            </TouchableOpacity>
            <Text style={[styles.replyMetaText, { color: colors.text }]}>{reply.voteCount || 0}</Text>
            <FontAwesome name="comment-o" size={16} color={colors.icon} style={{ marginLeft: 12 }} />
            <Text style={[styles.replyMetaText, { color: colors.payout, marginLeft: 12 }]}>{reply.payout !== undefined ? `$${reply.payout.toFixed(2)}` : ''}</Text>
            <TouchableOpacity style={styles.replyButton} onPress={() => handleOpenReplyModal(reply.author, reply.permlink!)}>
              <FontAwesome name="reply" size={16} color={colors.icon} />
              <Text style={[styles.replyButtonText, { color: colors.icon }]}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Render children recursively */}
        {reply.replies && reply.replies.length > 0 && reply.replies.map((child, idx) => renderReplyTree(child, level + 1))}
      </View>
    );
  };

  // Render the snap as a header for the replies list
  const renderSnapHeader = () => {
    if (!snap) return null;
    const videoInfo = extractVideoInfo(snap.body);
    let textBody = snap.body;
    if (videoInfo) {
      textBody = removeAllVideoUrls(textBody);
    }
    const windowWidth = Dimensions.get('window').width;
    const isHtml = containsHtml(textBody);
    return (
      <View style={[styles.snapPost, { borderColor: colors.border, backgroundColor: colors.background }]}> 
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Pressable
            onPress={() => {
              console.log('Navigating to ProfileScreen for:', snap.author);
              router.push(`/ProfileScreen?username=${snap.author}` as any);
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center' }]}
            accessibilityRole="button"
            accessibilityLabel={`View ${snap.author}'s profile`}
          >
            {snap.avatarUrl ? (
              <ExpoImage source={{ uri: snap.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, { backgroundColor: isDark ? '#22303C' : '#eee', justifyContent: 'center', alignItems: 'center' }]}> 
                <FontAwesome name="user" size={22} color={isDark ? '#8899A6' : '#bbb'} />
              </View>
            )}
            <Text style={[styles.snapAuthor, { color: colors.text, marginLeft: 10 }]}>{snap.author}</Text>
          </Pressable>
          <Text style={[styles.snapTimestamp, { color: colors.text }]}>{snap.created ? new Date(snap.created).toLocaleString() : ''}</Text>
        </View>
        {/* Video Player (YouTube, 3speak, IPFS) - Click to play */}
        {videoInfo && (
          <View style={{ marginBottom: 8 }}>
            {videoInfo.type === 'ipfs' ? (
              <IPFSVideoPlayer ipfsUrl={videoInfo.embedUrl} isDark={isDark} />
            ) : (
              <View style={{ width: '100%', aspectRatio: 16/9, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                <WebView
                  source={{ 
                    uri: videoInfo.type === 'youtube' 
                      ? `${videoInfo.embedUrl}?autoplay=0&rel=0&modestbranding=1`
                      : `${videoInfo.embedUrl}&autoplay=0`
                  }}
                  style={{ flex: 1, backgroundColor: '#000' }}
                  allowsFullscreenVideo
                  javaScriptEnabled
                  domStorageEnabled
                  mediaPlaybackRequiresUserAction={true}
                  allowsInlineMediaPlayback={true}
                />
                {/* Video type indicator */}
                <View style={{ 
                  position: 'absolute', 
                  top: 8, 
                  right: 8, 
                  backgroundColor: 'rgba(0,0,0,0.7)', 
                  paddingHorizontal: 6, 
                  paddingVertical: 2, 
                  borderRadius: 4 
                }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                    {videoInfo.type.toUpperCase()}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
        {isHtml ? (
          <RenderHtml
            contentWidth={windowWidth - 32}
            source={{ html: textBody }}
            baseStyle={{ color: colors.text, fontSize: 15, marginBottom: 8 }}
            enableExperimentalMarginCollapsing
            tagsStyles={{ a: { color: colors.icon } }}
          />
        ) : (
          <Markdown
            style={{
              body: { color: colors.text, fontSize: 15, marginBottom: 8 },
              link: { color: colors.icon },
            }}
            rules={markdownRules}
          >
            {textBody}
          </Markdown>
        )}
        <View style={[styles.snapMeta, { alignItems: 'center' }]}> 
          <TouchableOpacity
            style={[styles.replyButton, { backgroundColor: 'transparent' }]}
            onPress={() => handleUpvotePress({ author: snap.author, permlink: snap.permlink! })}
            disabled={Array.isArray(snap.active_votes) && snap.active_votes.some((v: any) => v.voter === currentUsername && v.percent > 0)}
          >
            <FontAwesome name="arrow-up" size={18} color={Array.isArray(snap.active_votes) && snap.active_votes.some((v: any) => v.voter === currentUsername && v.percent > 0) ? '#8e44ad' : colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.snapMetaText, { color: colors.text }]}>{snap.voteCount || 0}</Text>
          <FontAwesome name="comment-o" size={18} color={colors.icon} style={{ marginLeft: 12 }} />
          <Text style={[styles.snapMetaText, { color: colors.text }]}>{snap.replyCount || 0}</Text>
          <Text style={[styles.snapMetaText, { color: colors.payout, marginLeft: 12 }]}>{snap.payout ? `$${snap.payout.toFixed(2)}` : ''}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.replyButton} onPress={() => handleOpenReplyModal(snap.author, snap.permlink!)}>
            <FontAwesome name="reply" size={18} color={colors.icon} />
            <Text style={[styles.replyButtonText, { color: colors.icon }]}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaViewSA style={[styles.safeArea, { backgroundColor: isDark ? '#15202B' : '#fff' }]}> 
      {/* Fullscreen Image Modal */}
      <Modal
        isVisible={imageModalVisible}
        onBackdropPress={() => setImageModalVisible(false)}
        onBackButtonPress={() => setImageModalVisible(false)}
        style={{ margin: 0, justifyContent: 'center', alignItems: 'center' }}
      >
        {/* Debug: log modalImageUrl in useEffect instead of inline */}
        <View style={{ backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 40, right: 20, zIndex: 2 }}
            onPress={() => setImageModalVisible(false)}
            accessibilityLabel="Close image"
          >
            <FontAwesome name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {/* Try hardcoded fallback image if modalImageUrl is not valid */}
          {modalImageUrl ? (
            <ExpoImage
              key={modalImageUrl}
              source={{ uri: modalImageUrl }}
              style={{ width: '96%', height: '80%', borderRadius: 16, backgroundColor: '#222' }}
              contentFit="contain"
            />
          ) : (
            <ExpoImage
              source={{ uri: 'https://placekitten.com/800/800' }}
              style={{ width: '96%', height: '80%', borderRadius: 16, backgroundColor: '#222' }}
              contentFit="contain"
            />
          )}
        </View>
      </Modal>
      {/* Conversation list (snap as header, replies as data) */}
      {loading ? (
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <FontAwesome name="hourglass-half" size={48} color={colors.icon} style={{ marginBottom: 12 }} />
          <Text style={{ color: colors.text, fontSize: 16 }}>Loading conversation...</Text>
        </View>
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <>
              {renderSnapHeader()}
              <View style={styles.repliesList}>
                {replies.map(reply => renderReplyTree(reply))}
              </View>
            </>
          }
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          refreshing={loading}
          onRefresh={handleRefresh}
        />
      )}
      {/* Reply modal composer */}
      <Modal
        isVisible={replyModalVisible}
        onBackdropPress={posting ? undefined : handleCloseReplyModal}
        onBackButtonPress={posting ? undefined : handleCloseReplyModal}
        style={{ justifyContent: 'flex-end', margin: 0 }}
        useNativeDriver
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ backgroundColor: colors.background, padding: 16, borderTopLeftRadius: 18, borderTopRightRadius: 18 }}
        >
          <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
            Reply to {replyTarget?.author}
          </Text>
          <TextInput
            style={{
              minHeight: 60,
              color: colors.text,
              backgroundColor: colors.bubble,
              borderRadius: 10,
              padding: 10,
              fontSize: 15,
              marginBottom: 10,
            }}
            placeholder="Write your reply..."
            placeholderTextColor={isDark ? '#8899A6' : '#888'}
            multiline
            value={replyText}
            onChangeText={setReplyText}
            editable={!uploading && !posting}
          />
          {replyImage ? (
            <View style={{ marginBottom: 10 }}>
              <ExpoImage source={{ uri: replyImage }} style={{ width: 120, height: 120, borderRadius: 10 }} contentFit="cover" />
              <TouchableOpacity onPress={() => setReplyImage(null)} style={{ position: 'absolute', top: 4, right: 4 }} disabled={posting}>
                <FontAwesome name="close" size={20} color={colors.icon} />
              </TouchableOpacity>
            </View>
          ) : null}
          {postError ? (
            <Text style={{ color: 'red', marginBottom: 8 }}>{postError}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <TouchableOpacity onPress={handleAddImage} disabled={uploading || posting} style={{ marginRight: 16 }}>
              <FontAwesome name="image" size={22} color={colors.icon} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={handleSubmitReply}
              disabled={uploading || posting || !replyText.trim() || !currentUsername}
              style={{
                backgroundColor: colors.icon,
                borderRadius: 20,
                paddingHorizontal: 18,
                paddingVertical: 8,
                opacity: uploading || posting || !replyText.trim() || !currentUsername ? 0.6 : 1,
              }}
            >
              {posting ? (
                <FontAwesome name="spinner" size={16} color="#fff" style={{ marginRight: 8 }} />
              ) : null}
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{posting ? 'Posting...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Upvote Modal */}
      <Modal
        isVisible={upvoteModalVisible}
        onBackdropPress={handleUpvoteCancel}
        onBackButtonPress={handleUpvoteCancel}
        style={{ justifyContent: 'center', alignItems: 'center', margin: 0 }}
        useNativeDriver
      >
        <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 24, width: '85%', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Upvote</Text>
          <Text style={{ color: colors.text, fontSize: 15, marginBottom: 16 }}>Vote Weight: {voteWeight}%</Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={1}
            maximumValue={100}
            step={1}
            value={voteWeight}
            onValueChange={setVoteWeight}
            minimumTrackTintColor={colors.icon}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.icon}
          />
          {upvoteLoading ? (
            <View style={{ marginTop: 24, alignItems: 'center' }}>
              <FontAwesome name="hourglass-half" size={32} color={colors.icon} />
              <Text style={{ color: colors.text, marginTop: 8 }}>Submitting vote...</Text>
            </View>
          ) : upvoteSuccess ? (
            <View style={{ marginTop: 24, alignItems: 'center' }}>
              <FontAwesome name="check-circle" size={32} color={colors.icon} />
              <Text style={{ color: colors.text, marginTop: 8 }}>Upvote successful!</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', marginTop: 24 }}>
              <Pressable
                style={{ flex: 1, marginRight: 8, backgroundColor: colors.border, borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={handleUpvoteCancel}
                disabled={upvoteLoading}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={{ flex: 1, marginLeft: 8, backgroundColor: colors.icon, borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={handleUpvoteConfirm}
                disabled={upvoteLoading}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Confirm</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaViewSA>
  );
};

export default ConversationScreen;

export const options = { headerShown: false };

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  topBarButton: { padding: 6 },
  snapPost: { padding: 16, borderBottomWidth: 1 },
  snapAuthor: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  snapBody: { fontSize: 15, marginBottom: 8 },
  snapMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  snapMetaText: { marginLeft: 4, fontSize: 14 },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'auto',
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  replyButtonText: {
    marginLeft: 6,
    fontWeight: 'bold',
    fontSize: 15,
  },
  repliesList: { padding: 12 },
  replyBubble: { borderRadius: 12, padding: 10, marginBottom: 10 },
  replyAuthor: { fontWeight: 'bold', fontSize: 14, marginBottom: 2 },
  replyBody: { fontSize: 14, marginBottom: 4 },
  replyMeta: { flexDirection: 'row', alignItems: 'center' },
  replyMetaText: { marginLeft: 4, fontSize: 13 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  snapTimestamp: { fontSize: 12, color: '#8899A6', marginLeft: 8 },
});
