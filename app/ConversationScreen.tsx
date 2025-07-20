import React, { useState } from 'react';
import { SafeAreaView as SafeAreaViewRN } from 'react-native';
import { SafeAreaView as SafeAreaViewSA, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, FlatList, useColorScheme, Image, Pressable, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinaryFixed } from '../utils/cloudinaryImageUploadFixed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Client, PrivateKey } from '@hiveio/dhive';
import Modal from 'react-native-modal';
import Markdown from 'react-native-markdown-display';
import { WebView } from 'react-native-webview';
import { extractVideoInfo, removeVideoUrls, removeTwitterUrls, removeEmbedUrls, extractYouTubeId } from '../utils/extractVideoInfo';
import * as SecureStore from 'expo-secure-store';
import Slider from '@react-native-community/slider';
import { useVoteWeightMemory } from '../hooks/useVoteWeightMemory';
import { calculateVoteValue } from '../utils/calculateVoteValue';
import { getHivePriceUSD } from '../utils/getHivePrice';
import IPFSVideoPlayer from './components/IPFSVideoPlayer';
import { Image as ExpoImage } from 'expo-image';
import RenderHtml, { defaultHTMLElementModels, HTMLContentModel } from 'react-native-render-html';
import { Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { extractImageUrls } from '../utils/extractImageUrls';
import ImageView from 'react-native-image-viewing';
import genericAvatar from '../assets/images/generic-avatar.png';

// Utility to remove image markdown/html from text
function stripImageTags(text: string): string {
  // Remove markdown images
  let out = text.replace(/!\[[^\]]*\]\([^\)]+\)/g, '');
  // Remove html <img ...>
  out = out.replace(/<img[^>]+src=["'][^"'>]+["'][^>]*>/g, '');
  return out;
}

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
  json_metadata?: string; // Add json_metadata for edit tracking
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
  const [modalImages, setModalImages] = useState<Array<{uri: string}>>([]);
  const [modalImageIndex, setModalImageIndex] = useState(0);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editText, setEditText] = useState('');
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editUploading, setEditUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<{author: string, permlink: string, type: 'snap' | 'reply'} | null>(null);

  // Upvote modal state
  const [upvoteModalVisible, setUpvoteModalVisible] = useState(false);
  const [upvoteTarget, setUpvoteTarget] = useState<{ author: string; permlink: string } | null>(null);
  const { voteWeight, setVoteWeight, persistVoteWeight, loading: voteWeightLoading } = useVoteWeightMemory(100);
  const [upvoteLoading, setUpvoteLoading] = useState(false);
  const [upvoteSuccess, setUpvoteSuccess] = useState(false);
  const [voteValue, setVoteValue] = useState<{ hbd: string, usd: string } | null>(null);
  const [globalProps, setGlobalProps] = useState<any | null>(null);
  const [rewardFund, setRewardFund] = useState<any | null>(null);
  const [hivePrice, setHivePrice] = useState<number>(1);

  // Fetch Hive global props, reward fund, and price on mount
  React.useEffect(() => {
    const fetchProps = async () => {
      try {
        const props = await client.database.getDynamicGlobalProperties();
        setGlobalProps(props);
        const fund = await client.database.call('get_reward_fund', ['post']);
        setRewardFund(fund);
      } catch (err) {
        setGlobalProps(null);
        setRewardFund(null);
      }
    };
    fetchProps();
    getHivePriceUSD().then(setHivePrice);
  }, []);

  // Update vote value estimate when modal opens or voteWeight changes
  React.useEffect(() => {
    const updateValue = async () => {
      if (!currentUsername || !upvoteModalVisible) return;
      try {
        const accounts = await client.database.getAccounts([currentUsername]);
        const accountObj = accounts && accounts[0] ? accounts[0] : null;
        if (accountObj && globalProps && rewardFund) {
          const calcValue = calculateVoteValue(accountObj, globalProps, rewardFund, voteWeight, hivePrice);
          setVoteValue(calcValue);
        } else {
          setVoteValue(null);
        }
      } catch {
        setVoteValue(null);
      }
    };
    updateValue();
  }, [voteWeight, upvoteModalVisible, currentUsername, globalProps, rewardFund, hivePrice]);

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

  // In-memory avatar/profile cache for this session
  const avatarProfileCache: Record<string, string | undefined> = {};

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

    // Batch fetch full content for all replies in parallel
    const fullContentArr = await Promise.all(
      shallowReplies.map((reply: { author: string; permlink: string }) =>
        client.database.call('get_content', [reply.author, reply.permlink])
          .catch(() => reply)
      )
    );

    // Collect all unique authors for avatar batch fetch, skipping those already cached
    const authorsToFetch = Array.from(new Set(fullContentArr.map(r => r.author))).filter(a => !(a in avatarProfileCache));
    let accountsArr: any[] = [];
    if (authorsToFetch.length > 0) {
      try {
        accountsArr = await client.database.call('get_accounts', [authorsToFetch]);
      } catch (e) {
        accountsArr = [];
      }
      // Update cache with fetched avatars
      for (const acc of accountsArr) {
        let meta = acc.posting_json_metadata;
        if (!meta || meta === '{}') {
          meta = acc.json_metadata;
        }
        if (meta) {
          let profile;
          try {
            profile = JSON.parse(meta).profile;
          } catch (e) {
            profile = undefined;
          }
          if (profile && profile.profile_image) {
            avatarProfileCache[acc.name] = profile.profile_image;
          } else {
            avatarProfileCache[acc.name] = undefined;
          }
        } else {
          avatarProfileCache[acc.name] = undefined;
        }
      }
    }

    // Build replies with avatar and recurse
    const fullReplies: ReplyData[] = await Promise.all(fullContentArr.map(async (fullReply) => {
      const avatarUrl = avatarProfileCache[fullReply.author];
      const payout = parseFloat(fullReply.pending_payout_value ? fullReply.pending_payout_value.replace(' HBD', '') : '0');
      const childrenReplies = await fetchRepliesTreeWithContent(fullReply.author, fullReply.permlink, depth + 1, maxDepth);
      return {
        author: fullReply.author,
        avatarUrl,
        body: fullReply.body,
        created: fullReply.created,
        voteCount: fullReply.net_votes,
        replyCount: fullReply.children,
        payout,
        permlink: fullReply.permlink,
        active_votes: fullReply.active_votes, // Keep the raw active_votes data
        json_metadata: fullReply.json_metadata, // Include metadata for edit tracking
        replies: childrenReplies,
      };
    }));
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
        json_metadata: post.json_metadata, // Include metadata for edit tracking
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

  const handleAddImage = async (mode: 'reply' | 'edit' = 'reply') => {
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
                if (buttonIndex === 0) resolve('cancel');
                else if (buttonIndex === 1) resolve('camera');
                else if (buttonIndex === 2) resolve('gallery');
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
      
      // Enhanced permission handling with better error messages
      let result;
      if (pickType === 'camera') {
        // Check current permission status first
        const currentPermission = await ImagePicker.getCameraPermissionsAsync();
        let finalStatus = currentPermission.status;
        
        if (finalStatus !== 'granted') {
          // Request permission if not granted
          const requestPermission = await ImagePicker.requestCameraPermissionsAsync();
          finalStatus = requestPermission.status;
        }
        
        if (finalStatus !== 'granted') {
          import('react-native').then(({ Alert }) => {
            Alert.alert(
              'Camera Permission Required',
              'HiveSnaps needs camera access to take photos. Please enable camera permissions in your device settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => {
                  if (Platform.OS === 'ios') {
                    import('expo-linking').then(({ default: Linking }) => {
                      Linking.openURL('app-settings:');
                    });
                  } else {
                    import('expo-intent-launcher').then(({ default: IntentLauncher }) => {
                      IntentLauncher.startActivityAsync(
                        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
                        { data: 'package:com.anonymous.hivesnaps' }
                      );
                    }).catch(() => {
                      // Fallback for older Android versions
                      import('expo-linking').then(({ default: Linking }) => {
                        Linking.openURL('app-settings:');
                      });
                    });
                  }
                }}
              ]
            );
          });
          return;
        }
        
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.8,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      } else {
        // Media library permission handling
        const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
        let finalStatus = currentPermission.status;
        
        if (finalStatus !== 'granted') {
          const requestPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          finalStatus = requestPermission.status;
        }
        
        if (finalStatus !== 'granted') {
          import('react-native').then(({ Alert }) => {
            Alert.alert(
              'Photo Library Permission Required',
              'HiveSnaps needs photo library access to select images. Please enable photo permissions in your device settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => {
                  if (Platform.OS === 'ios') {
                    import('expo-linking').then(({ default: Linking }) => {
                      Linking.openURL('app-settings:');
                    });
                  } else {
                    import('expo-intent-launcher').then(({ default: IntentLauncher }) => {
                      IntentLauncher.startActivityAsync(
                        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
                        { data: 'package:com.anonymous.hivesnaps' }
                      );
                    }).catch(() => {
                      // Fallback for older Android versions
                      import('expo-linking').then(({ default: Linking }) => {
                        Linking.openURL('app-settings:');
                      });
                    });
                  }
                }}
              ]
            );
          });
          return;
        }
        
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
      }
      
      if (!result || result.canceled || !result.assets || !result.assets[0]) return;
      const asset = result.assets[0];
      
      // Set appropriate loading state based on mode
      if (mode === 'edit') {
        setEditUploading(true);
      } else {
        setUploading(true);
      }
      
      try {
        const fileToUpload = {
          uri: asset.uri,
          name: `${mode}-${Date.now()}.jpg`,
          type: 'image/jpeg',
        };
        const cloudinaryUrl = await uploadImageToCloudinaryFixed(fileToUpload);
        
        // Set appropriate image state based on mode
        if (mode === 'edit') {
          setEditImage(cloudinaryUrl);
        } else {
          setReplyImage(cloudinaryUrl);
        }
      } catch (err) {
        console.error('Image upload error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown upload error';
        import('react-native').then(({ Alert }) => {
          Alert.alert(
            'Upload Failed',
            `Image upload failed: ${errorMessage}`,
            [{ text: 'OK' }]
          );
        });
      } finally {
        if (mode === 'edit') {
          setEditUploading(false);
        } else {
          setUploading(false);
        }
      }
    } catch (err) {
      console.error('Image picker error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      import('react-native').then(({ Alert }) => {
        Alert.alert(
          'Error',
          `Failed to pick image: ${errorMessage}`,
          [{ text: 'OK' }]
        );
      });
      
      if (mode === 'edit') {
        setEditUploading(false);
      } else {
        setUploading(false);
      }
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

  // Edit handlers
  const handleOpenEditModal = (content?: { author: string; permlink: string; body: string }, type: 'snap' | 'reply' = 'snap') => {
    if (type === 'snap') {
      if (!snap) return;
      // Pre-populate with current snap content
      const textBody = stripImageTags(snap.body);
      setEditText(textBody);
      setEditTarget({ author: snap.author, permlink: snap.permlink!, type: 'snap' });
    } else {
      // Reply editing
      if (!content) return;
      const textBody = stripImageTags(content.body);
      setEditText(textBody);
      setEditTarget({ author: content.author, permlink: content.permlink, type: 'reply' });
    }
    setEditImage(null); // Keep it simple - no image editing for now
    setEditModalVisible(true);
  };

  const handleCloseEditModal = () => {
    setEditModalVisible(false);
    setEditText('');
    setEditImage(null);
    setEditError(null);
    setEditTarget(null);
  };

  const handleSubmitEdit = async () => {
    if (!editTarget || !editText.trim() || !currentUsername) return;
    setEditing(true);
    setEditError(null);
    
    try {
      // Get posting key from secure storage
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) {
        throw new Error('No posting key found. Please log in again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      let body = editText.trim();
      if (editImage) {
        body += `\n![image](${editImage})`;
      }

      // Get the original post to preserve parent relationships
      const originalPost = await client.database.call('get_content', [editTarget.author, editTarget.permlink]);
      
      // Parse existing metadata and add edited flag
      let existingMetadata: any = {};
      try {
        if (originalPost.json_metadata) {
          existingMetadata = JSON.parse(originalPost.json_metadata);
        }
      } catch (e) {
        // Invalid JSON, start fresh
      }

      const json_metadata = {
        ...existingMetadata,
        app: 'hivesnaps/1.0',
        format: 'markdown',
        edited: true,
        edit_timestamp: new Date().toISOString(),
      };

      if (editImage && !json_metadata.image) {
        json_metadata.image = [editImage];
      }

      // Edit the post/reply using same author/permlink with new content
      await client.broadcast.comment({
        parent_author: originalPost.parent_author, // Keep original parent
        parent_permlink: originalPost.parent_permlink, // Keep original parent permlink
        author: currentUsername,
        permlink: editTarget.permlink,
        title: originalPost.title || '', // Keep original title
        body,
        json_metadata: JSON.stringify(json_metadata),
      }, postingKey);

      // Update local state optimistically based on edit type
      if (editTarget.type === 'snap') {
        setSnap(prev => prev ? {
          ...prev,
          body,
          json_metadata: JSON.stringify(json_metadata)
        } : null);
      } else {
        // Update the specific reply in the replies tree
        setReplies(prevReplies => 
          updateReplyInTree(prevReplies, editTarget.author, editTarget.permlink, body, JSON.stringify(json_metadata))
        );
      }

      setEditModalVisible(false);
      setEditText('');
      setEditImage(null);
      setEditing(false);
      setEditTarget(null);

      // Refresh after a delay to get updated content from blockchain
      setTimeout(() => {
        handleRefresh();
      }, 3000);
      
    } catch (e: any) {
      setEditError(e.message || 'Failed to edit post.');
      setEditing(false);
    }
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
      
      // Sanitize parent_author for use in permlink - remove invalid characters like dots and convert to lowercase
      const sanitizedParentAuthor = parent_author.toLowerCase().replace(/[^a-z0-9-]/g, '');
      const permlink = `re-${sanitizedParentAuthor}-${parent_permlink}-${Date.now()}`;
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
    setUpvoteModalVisible(true);
  };

  const handleUpvoteCancel = () => {
    setUpvoteModalVisible(false);
    setUpvoteTarget(null);
    setVoteValue(null);
    // Do not reset voteWeight, keep last used value
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
      persistVoteWeight();
      // Optimistically update UI - add payout calculation
      const estimatedValueIncrease = voteValue ? parseFloat(voteValue.hbd) : 0;
      setSnap((prev) =>
        prev && prev.author === upvoteTarget.author && prev.permlink === upvoteTarget.permlink
          ? { 
              ...prev, 
              voteCount: (prev.voteCount || 0) + 1,
              payout: (prev.payout || 0) + estimatedValueIncrease,
              active_votes: [
                ...(prev.active_votes || []),
                { voter: currentUsername, percent: weight }
              ]
            }
          : prev
      );
      setReplies((prevReplies) =>
        prevReplies.map((reply: ReplyData) =>
          updateReplyUpvoteOptimistic(reply, upvoteTarget, currentUsername, weight, estimatedValueIncrease)
        )
      );
      setUpvoteLoading(false);
      setUpvoteSuccess(true);
      // Close modal without refresh - maintain scroll position!
      setTimeout(() => {
        setUpvoteModalVisible(false);
        setUpvoteSuccess(false);
        setUpvoteTarget(null);
        setVoteValue(null);
      }, 1500);
    } catch (err) {
      setUpvoteLoading(false);
      setUpvoteSuccess(false);
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      alert('Upvote failed: ' + errorMsg);
    }
  };

  // Helper to optimistically update hasUpvoted for replies (recursive)
  function updateReplyUpvoteOptimistic(reply: ReplyData, target: { author: string; permlink: string }, username: string, weight: number, estimatedValue: number = 0): ReplyData {
    let updated = { ...reply };
    if (reply.author === target.author && reply.permlink === target.permlink) {
      updated.voteCount = (reply.voteCount || 0) + 1;
      updated.payout = (reply.payout || 0) + estimatedValue;
      updated.active_votes = [
        ...(reply.active_votes || []),
        { voter: username, percent: weight }
      ];
    }
    if (reply.replies && reply.replies.length > 0) {
      updated.replies = reply.replies.map((r) => updateReplyUpvoteOptimistic(r, target, username, weight, estimatedValue));
    }
    return updated;
  }

  // Helper to update a reply in the nested tree structure
  function updateReplyInTree(replies: ReplyData[], targetAuthor: string, targetPermlink: string, newBody: string, newMetadata: string): ReplyData[] {
    return replies.map(reply => {
      if (reply.author === targetAuthor && reply.permlink === targetPermlink) {
        return {
          ...reply,
          body: newBody,
          json_metadata: newMetadata
        };
      }
      if (reply.replies && reply.replies.length > 0) {
        return {
          ...reply,
          replies: updateReplyInTree(reply.replies, targetAuthor, targetPermlink, newBody, newMetadata)
        };
      }
      return reply;
    });
  }

  // Image modal handler
  const handleImagePress = (imageUrl: string) => {
    setModalImages([{ uri: imageUrl }]);
    setModalImageIndex(0);
    setImageModalVisible(true);
  };

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

  // Helper: Render mp4 video using expo-av Video
  const renderMp4Video = (uri: string, key?: string | number) => (
    <View key={key || uri} style={{ width: '100%', aspectRatio: 16 / 9, marginVertical: 10, borderRadius: 12, overflow: 'hidden', backgroundColor: isDark ? '#222' : '#eee' }}>
      <Video
        source={{ uri }}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        style={{ width: '100%', height: '100%' }}
        shouldPlay={false}
        isLooping={false}
      />
    </View>
  );

  // Utility to remove all video URLs from text (updated for multiple platforms)
  function removeAllVideoUrls(text: string): string {
    return removeVideoUrls(text);
  }

  // Utility to extract Twitter/X URLs from text
  function extractTwitterUrl(text: string): string | null {
    console.log('🔍 extractTwitterUrl called with text:', text.substring(0, 200));
    const twitterMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/i);
    console.log('🔍 Twitter regex match result:', twitterMatch);
    const result = twitterMatch ? twitterMatch[0] : null;
    console.log('🔍 Returning Twitter URL:', result);
    return result;
  }

  // Utility to remove all embed URLs (videos and social media) from text
  function removeAllEmbedUrls(text: string): string {
    return removeEmbedUrls(text);
  }

  // Utility: Preprocess raw URLs to clickable markdown links (if not already linked)
  function linkifyUrls(text: string): string {
    // Regex for URLs (http/https) - includes @ character for Hive frontend URLs
    return text.replace(/(https?:\/\/[\w.-]+(?:\/[\w\-./?%&=+#@]*)?)/gi, (url) => {
      // If already inside a markdown or html link, skip
      if (/\]\([^)]+\)$/.test(url) || /href=/.test(url)) return url;
      
      // Skip URLs that should be handled as embedded media (YouTube, 3Speak, IPFS, MP4, Twitter/X)
      const youtubeMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      const threeSpeakMatch = url.match(/https:\/\/3speak\.tv\/watch\?v=([^\/\s]+)\/([a-zA-Z0-9_-]+)/);
      const ipfsMatch = url.match(/ipfs\/([A-Za-z0-9]+)/);
      const mp4Match = url.match(/\.mp4($|\?)/i);
      const twitterMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/i);
      
      if (youtubeMatch || threeSpeakMatch || ipfsMatch || mp4Match || twitterMatch) {
        return url; // Don't linkify, let markdown rules handle embedding
      }
      
      // Use full URL as display text (no shortening in conversation view)
      return `[${url}](${url})`;
    });
  }

  // Utility: Preprocess @username mentions to clickable profile links
  function linkifyMentions(text: string): string {
    // Only match @username if not preceded by a '/' or inside a markdown link
    // Hive usernames: 3-16 chars, a-z, 0-9, dash, dot (no @ in username)
    // Avoid emails and already-linked mentions
    return text.replace(/(^|[^\w/@])@([a-z0-9\-\.]{3,16})(?![a-z0-9\-\.])/gi, (match, pre, username, offset, string) => {
      // Don't process if we're inside a markdown link [text](url)
      const beforeMatch = string.substring(0, offset);
      const afterMatch = string.substring(offset + match.length);
      
      // Check if we're inside a markdown link by looking for unmatched brackets
      const openBrackets = (beforeMatch.match(/\[/g) || []).length;
      const closeBrackets = (beforeMatch.match(/\]/g) || []).length;
      const isInsideMarkdownLink = openBrackets > closeBrackets && afterMatch.includes('](');
      
      if (isInsideMarkdownLink) {
        return match; // Don't modify if inside a markdown link
      }
      
      return `${pre}[**@${username}**](profile://${username})`;
    });
  }

  // Utility: Preprocess #hashtags to clickable links
  function linkifyHashtags(text: string): string {
    // Match hashtags (# followed by alphanumeric characters and underscores)
    // Avoid matching hashtags that are already inside markdown links
    return text.replace(/(^|[^\w/#])#(\w+)(?![a-z0-9\-\.])/gi, (match, pre, hashtag, offset, string) => {
      // Don't process if we're inside a markdown link [text](url)
      const beforeMatch = string.substring(0, offset);
      const afterMatch = string.substring(offset + match.length);
      
      // Check if we're inside a markdown link by looking for unmatched brackets
      const openBrackets = (beforeMatch.match(/\[/g) || []).length;
      const closeBrackets = (beforeMatch.match(/\]/g) || []).length;
      const isInsideMarkdownLink = openBrackets > closeBrackets && afterMatch.includes('](');
      
      if (isInsideMarkdownLink) {
        return match; // Don't modify if inside a markdown link
      }
      
      return `${pre}[**#${hashtag}**](hashtag://${hashtag})`;
    });
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
      const uniqueKey = `${src || alt}-${Math.random().toString(36).substr(2, 9)}`;
      return (
        <Pressable
          key={uniqueKey}
          onPress={() => handleImagePress(src)}
        >
          <Image
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
            resizeMode="cover"
            accessibilityLabel={alt || 'image'}
          />
        </Pressable>
      );
    },
    video: (
      node: any,
      children: any,
      parent: any,
      styles: any
    ) => {
      // Handle <video src="...mp4"> or <video><source src="...mp4"></video>
      let src = node.attributes?.src;
      if (!src && node.children && node.children.length > 0) {
        const sourceNode = node.children.find((c: any) => c.name === 'source');
        if (sourceNode) src = sourceNode.attributes?.src;
      }
      if (src && src.endsWith('.mp4')) {
        return renderMp4Video(src);
      }
      return null;
    },
    html: (
      node: any,
      children: any,
      parent: any,
      styles: any
    ) => {
      // Handle <video> tags for mp4
      const htmlContent = node.content || '';
      const videoTagMatch = htmlContent.match(/<video[^>]*src=["']([^"']+\.mp4)["'][^>]*>(.*?)<\/video>/i);
      if (videoTagMatch) {
        const mp4Url = videoTagMatch[1];
        return renderMp4Video(mp4Url);
      }
      // Handle iframe tags for IPFS videos and other embedded content
      const htmlContent2 = node.content || '';
      const iframeMatch = htmlContent2.match(/<iframe[^>]+src=["']([^"']*ipfs[^"']*\/ipfs\/([A-Za-z0-9]+))[^"']*["'][^>]*>/i);
      
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
      // Handle profile:// links for mentions
      if (href && href.startsWith('profile://')) {
        const username = href.replace('profile://', '');
        const uniqueKey = `${href}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <Text
            key={uniqueKey}
            style={{ color: colors.icon, fontWeight: 'bold', textDecorationLine: 'underline' }}
            onPress={() => router.push(`/ProfileScreen?username=${username}` as any)}
            accessibilityRole="link"
            accessibilityLabel={`View @${username}'s profile`}
          >
            {children}
          </Text>
        );
      }
      // Handle hashtag:// links for hashtags
      if (href && href.startsWith('hashtag://')) {
        const tag = href.replace('hashtag://', '');
        const uniqueKey = `${href}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <Text
            key={uniqueKey}
            style={{ color: colors.icon, fontWeight: 'bold', textDecorationLine: 'underline' }}
            onPress={() => router.push({ pathname: '/DiscoveryScreen', params: { hashtag: tag } })}
            accessibilityRole="link"
            accessibilityLabel={`View #${tag} hashtag`}
          >
            {children}
          </Text>
        );
      }
      // Enhanced video link detection (supports YouTube, 3speak, IPFS, mp4)
      const youtubeMatch = href && href.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      const threeSpeakMatch = href && href.match(/https:\/\/3speak\.tv\/watch\?v=([^\/\s]+)\/([a-zA-Z0-9_-]+)/);
      const ipfsMatch = href && href.match(/ipfs\/([A-Za-z0-9]+)/);
      const mp4Match = href && href.match(/\.mp4($|\?)/i);
      
      // Twitter/X post detection - matches various Twitter/X URL formats
      const twitterMatch = href && href.match(/(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/i);

      if (youtubeMatch) {
        const videoId = youtubeMatch[1];
        const uniqueKey = `${href}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <View key={uniqueKey} style={{ width: '100%', aspectRatio: 16 / 9, marginVertical: 10, borderRadius: 10, overflow: 'hidden', backgroundColor: isDark ? '#222' : '#eee', position: 'relative' }}>
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
        const uniqueKey = `${href}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <View key={uniqueKey} style={{ width: '100%', aspectRatio: 16 / 9, marginVertical: 10, borderRadius: 10, overflow: 'hidden', backgroundColor: isDark ? '#222' : '#eee', position: 'relative' }}>
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
      
      if (twitterMatch) {
        const domain = twitterMatch[1]; // twitter.com or x.com
        const username = twitterMatch[2];
        const tweetId = twitterMatch[3];
        const uniqueKey = `${href}-${Math.random().toString(36).substr(2, 9)}`;
        
        return (
          <View key={uniqueKey} style={{ 
            width: '100%', 
            minHeight: 400, 
            maxHeight: 600, 
            marginVertical: 10, 
            borderRadius: 12, 
            overflow: 'hidden', 
            backgroundColor: isDark ? '#222' : '#eee', 
            position: 'relative' 
          }}>
            <WebView
              source={{ 
                html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                  <style>
                    * {
                      margin: 0;
                      padding: 0;
                      box-sizing: border-box;
                    }
                    html, body {
                      height: 100%;
                      background-color: ${isDark ? '#222' : '#fff'};
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    }
                    body {
                      padding: 10px;
                      display: flex;
                      flex-direction: column;
                      justify-content: flex-start;
                      align-items: center;
                    }
                    .loading {
                      text-align: center;
                      padding: 40px 20px;
                      color: ${isDark ? '#D7DBDC' : '#0F1419'};
                      font-size: 14px;
                    }
                    .loading-emoji {
                      font-size: 28px;
                      margin-bottom: 10px;
                      display: block;
                    }
                    .twitter-tweet-rendered {
                      margin: 10px auto !important;
                      max-width: 100% !important;
                    }
                    .error {
                      text-align: center;
                      padding: 40px 20px;
                      color: ${isDark ? '#ff6b6b' : '#e74c3c'};
                      font-size: 14px;
                    }
                  </style>
                </head>
                <body>
                  <div class="loading" id="loading">
                    <span class="loading-emoji">🐦</span>
                    <div>Loading ${domain === 'x.com' ? 'X' : 'Twitter'} post...</div>
                  </div>
                  
                  <div id="error" class="error" style="display: none;">
                    <span class="loading-emoji">❌</span>
                    <div>Failed to load tweet</div>
                  </div>

                  <blockquote class="twitter-tweet" data-lang="en" data-theme="${isDark ? 'dark' : 'light'}" data-dnt="true">
                    <a href="${href}" style="color: #1DA1F2; text-decoration: none;">
                      <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 16px; margin-bottom: 8px;">🐦</div>
                        <div>Tap to load tweet</div>
                      </div>
                    </a>
                  </blockquote>

                  <script>
                    // Timeout handler
                    let loadTimeout = setTimeout(() => {
                      document.getElementById('loading').style.display = 'none';
                      document.getElementById('error').style.display = 'block';
                      console.log('Tweet loading timed out');
                    }, 10000);

                    // Twitter widget loader with error handling
                    (function(d, s, id) {
                      var js, fjs = d.getElementsByTagName(s)[0];
                      if (d.getElementById(id)) return;
                      js = d.createElement(s); js.id = id;
                      js.onload = function() {
                        console.log('Twitter widgets script loaded');
                        if (window.twttr && window.twttr.widgets) {
                          window.twttr.widgets.load().then(function() {
                            console.log('Twitter widgets rendered');
                            clearTimeout(loadTimeout);
                            document.getElementById('loading').style.display = 'none';
                          }).catch(function(error) {
                            console.log('Twitter widgets error:', error);
                            clearTimeout(loadTimeout);
                            document.getElementById('loading').style.display = 'none';
                            document.getElementById('error').style.display = 'block';
                          });
                        }
                      };
                      js.onerror = function() {
                        console.log('Failed to load Twitter widgets script');
                        clearTimeout(loadTimeout);
                        document.getElementById('loading').style.display = 'none';
                        document.getElementById('error').style.display = 'block';
                      };
                      js.src = 'https://platform.twitter.com/widgets.js';
                      js.charset = 'utf-8';
                      js.async = true;
                      fjs.parentNode.insertBefore(js, fjs);
                    }(document, 'script', 'twitter-wjs'));
                  </script>
                </body>
                </html>
                `
              }}
              style={{ flex: 1 }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              originWhitelist={['*']}
              allowsLinkPreview={false}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              bounces={false}
              scrollEnabled={true}
              startInLoadingState={false}
              onLoadStart={() => console.log('WebView loading started')}
              onLoad={() => console.log('WebView loaded')}
              onError={(error) => console.log('WebView error:', error)}
              onHttpError={(error) => console.log('WebView HTTP error:', error)}
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
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                {domain === 'x.com' ? 'X' : 'TWITTER'}
              </Text>
            </View>
          </View>
        );
      }
      
      if (ipfsMatch) {
        const uniqueKey = `${href}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <View key={uniqueKey} style={{ marginVertical: 10 }}>
            <IPFSVideoPlayer ipfsUrl={href} isDark={isDark} />
          </View>
        );
      }
      if (mp4Match) {
        return renderMp4Video(href, href);
      }
      // Default link rendering
      const uniqueKey = href ? `${href}-${Math.random().toString(36).substr(2, 9)}` : Math.random().toString(36).substr(2, 9);
      return (
        <Text key={uniqueKey} style={[{ color: colors.icon, textDecorationLine: 'underline' }]} onPress={() => {
          // Open link in browser
          if (href) {
            Linking.openURL(href);
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
    console.log('📱 Rendering reply tree for reply:', reply.author, reply.permlink);
    const videoInfo = extractVideoInfo(reply.body);
    const twitterUrl = extractTwitterUrl(reply.body);
    console.log('📱 Reply twitterUrl:', twitterUrl);
    const imageUrls = extractImageUrls(reply.body);
    let textBody = reply.body;
    if (videoInfo || twitterUrl) {
      textBody = removeAllEmbedUrls(textBody);
    }
    // Remove image tags from text body
    textBody = stripImageTags(textBody);
    // Process URLs first, then mentions, then hashtags (order matters!)
    textBody = linkifyUrls(textBody);
    textBody = linkifyMentions(textBody);
    textBody = linkifyHashtags(textBody);
    const windowWidth = Dimensions.get('window').width;
    const isHtml = containsHtml(textBody);
    
    // Cap visual nesting level to prevent bubbles from going off-screen
    // Maximum visual level is 3 (54px = 3 * 18px indentation)
    const maxVisualLevel = 3;
    const visualLevel = Math.min(level, maxVisualLevel);
    
    return (
      <View key={reply.author + reply.permlink + '-' + level} style={{ marginLeft: visualLevel * 18, marginBottom: 10 }}>
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
                <ExpoImage
                  source={reply.avatarUrl ? { uri: reply.avatarUrl } : genericAvatar}
                  style={styles.avatar}
                  contentFit="cover"
                  onError={() => {}}
                />
              ) : (
                <ExpoImage
                  source={genericAvatar}
                  style={styles.avatar}
                  contentFit="cover"
                />
              )}
              <Text style={[styles.replyAuthor, { color: colors.text, marginLeft: 10 }]}>{reply.author}</Text>
              <Text style={[styles.snapTimestamp, { color: colors.text }]}>{reply.created ? new Date(reply.created + 'Z').toLocaleString() : ''}</Text>
              {/* Edited indicator */}
              {reply.json_metadata && (() => {
                try {
                  const metadata = JSON.parse(reply.json_metadata);
                  return metadata.edited ? (
                    <Text style={[styles.snapTimestamp, { color: colors.icon, fontStyle: 'italic', marginLeft: 8 }]}>
                      • edited
                    </Text>
                  ) : null;
                } catch {
                  return null;
                }
              })()}
            </Pressable>
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
          {/* Twitter/X Post Embed */}
          {twitterUrl && (
            <View style={{ marginBottom: 8 }}>
              <View style={{ 
                width: '100%', 
                minHeight: 400, 
                maxHeight: 600, 
                borderRadius: 12, 
                overflow: 'hidden', 
                backgroundColor: isDark ? '#222' : '#eee', 
                position: 'relative' 
              }}>
                <WebView
                  source={{ 
                    html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta charset="utf-8">
                      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                      <style>
                        * {
                          margin: 0;
                          padding: 0;
                          box-sizing: border-box;
                        }
                        html, body {
                          height: 100%;
                          background-color: ${isDark ? '#222' : '#fff'};
                          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                        }
                        body {
                          padding: 10px;
                          display: flex;
                          flex-direction: column;
                          justify-content: flex-start;
                          align-items: center;
                        }
                        .loading {
                          text-align: center;
                          padding: 40px 20px;
                          color: ${isDark ? '#D7DBDC' : '#0F1419'};
                          font-size: 14px;
                        }
                        .loading-emoji {
                          font-size: 28px;
                          margin-bottom: 10px;
                          display: block;
                        }
                        .twitter-tweet-rendered {
                          margin: 10px auto !important;
                          max-width: 100% !important;
                        }
                        .error {
                          text-align: center;
                          padding: 40px 20px;
                          color: ${isDark ? '#ff6b6b' : '#e74c3c'};
                          font-size: 14px;
                        }
                      </style>
                    </head>
                    <body>
                      <div class="loading" id="loading">
                        <span class="loading-emoji">🐦</span>
                        <div>Loading ${twitterUrl.includes('x.com') ? 'X' : 'Twitter'} post...</div>
                      </div>
                      
                      <div id="error" class="error" style="display: none;">
                        <span class="loading-emoji">❌</span>
                        <div>Failed to load tweet</div>
                      </div>

                  <blockquote class="twitter-tweet" data-lang="en" data-theme="${isDark ? 'dark' : 'light'}" data-dnt="true">
                    <a href="${twitterUrl}" style="color: #1DA1F2; text-decoration: none;">
                      <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 16px; margin-bottom: 8px;">🐦</div>
                        <div>Tap to load tweet</div>
                      </div>
                    </a>
                  </blockquote>                      <script>
                        // Timeout handler
                        let loadTimeout = setTimeout(() => {
                          document.getElementById('loading').style.display = 'none';
                          document.getElementById('error').style.display = 'block';
                          console.log('Tweet loading timed out');
                        }, 10000);

                        // Twitter widget loader with error handling
                        (function(d, s, id) {
                          var js, fjs = d.getElementsByTagName(s)[0];
                          if (d.getElementById(id)) return;
                          js = d.createElement(s); js.id = id;
                          js.onload = function() {
                            console.log('Twitter widgets script loaded');
                            if (window.twttr && window.twttr.widgets) {
                              window.twttr.widgets.load().then(function() {
                                console.log('Twitter widgets rendered');
                                clearTimeout(loadTimeout);
                                document.getElementById('loading').style.display = 'none';
                              }).catch(function(error) {
                                console.log('Twitter widgets error:', error);
                                clearTimeout(loadTimeout);
                                document.getElementById('loading').style.display = 'none';
                                document.getElementById('error').style.display = 'block';
                              });
                            }
                          };
                          js.onerror = function() {
                            console.log('Failed to load Twitter widgets script');
                            clearTimeout(loadTimeout);
                            document.getElementById('loading').style.display = 'none';
                            document.getElementById('error').style.display = 'block';
                          };
                          js.src = 'https://platform.twitter.com/widgets.js';
                          js.charset = 'utf-8';
                          js.async = true;
                          fjs.parentNode.insertBefore(js, fjs);
                        }(document, 'script', 'twitter-wjs'));
                      </script>
                    </body>
                    </html>
                    `
                  }}
                  style={{ flex: 1 }}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  originWhitelist={['*']}
                  allowsLinkPreview={false}
                  showsVerticalScrollIndicator={false}
                  showsHorizontalScrollIndicator={false}
                  bounces={false}
                  scrollEnabled={true}
                  startInLoadingState={false}
                  onLoadStart={() => console.log('Reply Twitter WebView loading started')}
                  onLoad={() => console.log('Reply Twitter WebView loaded')}
                  onError={(error) => console.log('Reply Twitter WebView error:', error)}
                  onHttpError={(error) => console.log('Reply Twitter WebView HTTP error:', error)}
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
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                    {twitterUrl.includes('x.com') ? 'X' : 'TWITTER'}
                  </Text>
                </View>
              </View>
            </View>
          )}
          {/* Images from markdown/html */}
          {imageUrls.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              {imageUrls.map((url, idx) => (
                <Pressable key={url + idx} onPress={() => handleImagePress(url)}>
                  <ExpoImage
                    source={{ uri: url }}
                    style={{ width: '100%', height: 200, borderRadius: 12, marginBottom: 6, backgroundColor: '#eee' }}
                    contentFit="cover"
                  />
                </Pressable>
              ))}
            </View>
          )}
          {isHtml ? (
            <RenderHtml
              contentWidth={windowWidth - (visualLevel * 18) - 32}
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
            <View style={{ flex: 1 }} />
            {/* Edit button - only show for own replies */}
            {reply.author === currentUsername && (
              <TouchableOpacity 
                style={styles.replyButton} 
                onPress={() => handleOpenEditModal({ 
                  author: reply.author, 
                  permlink: reply.permlink!, 
                  body: reply.body 
                }, 'reply')}
              >
                <FontAwesome name="edit" size={14} color={colors.icon} />
                <Text style={[styles.replyButtonText, { color: colors.icon, fontSize: 12 }]}>Edit</Text>
              </TouchableOpacity>
            )}
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
    console.log('🎯 Rendering snap header for:', snap.author, snap.permlink);
    const videoInfo = extractVideoInfo(snap.body);
    const twitterUrl = extractTwitterUrl(snap.body);
    console.log('🎯 Snap twitterUrl:', twitterUrl);
    const imageUrls = extractImageUrls(snap.body);
    let textBody = snap.body;
    if (videoInfo || twitterUrl) {
      textBody = removeAllEmbedUrls(textBody);
    }
    // Remove image tags from text body
    textBody = stripImageTags(textBody);
    // Process URLs first, then mentions, then hashtags (order matters!)
    textBody = linkifyUrls(textBody);
    textBody = linkifyMentions(textBody);
    textBody = linkifyHashtags(textBody);
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
              <ExpoImage
                source={snap.avatarUrl ? { uri: snap.avatarUrl } : genericAvatar}
                style={styles.avatar}
                contentFit="cover"
                onError={() => {}}
              />
            ) : (
              <ExpoImage
                source={genericAvatar}
                style={styles.avatar}
                contentFit="cover"
              />
            )}
            <Text style={[styles.snapAuthor, { color: colors.text, marginLeft: 10 }]}>{snap.author}</Text>
            <Text style={[styles.snapTimestamp, { color: colors.text }]}>{snap.created ? new Date(snap.created + 'Z').toLocaleString() : ''}</Text>
            {/* Edited indicator */}
            {snap.json_metadata && (() => {
              try {
                const metadata = JSON.parse(snap.json_metadata);
                return metadata.edited ? (
                  <Text style={[styles.snapTimestamp, { color: colors.icon, fontStyle: 'italic', marginLeft: 8 }]}>
                    • edited
                  </Text>
                ) : null;
              } catch {
                return null;
              }
            })()}
          </Pressable>
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
        {/* Twitter/X Post Embed */}
        {twitterUrl && (
          <View style={{ marginBottom: 8 }}>
            <View style={{ 
              width: '100%', 
              minHeight: 400, 
              maxHeight: 600, 
              borderRadius: 12, 
              overflow: 'hidden', 
              backgroundColor: isDark ? '#222' : '#eee', 
              position: 'relative' 
            }}>
              <WebView
                source={{ 
                  html: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                    <style>
                      * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                      }
                      html, body {
                        height: 100%;
                        background-color: ${isDark ? '#222' : '#fff'};
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                      }
                      body {
                        padding: 10px;
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-start;
                        align-items: center;
                      }
                      .loading {
                        text-align: center;
                        padding: 40px 20px;
                        color: ${isDark ? '#D7DBDC' : '#0F1419'};
                        font-size: 14px;
                      }
                      .loading-emoji {
                        font-size: 28px;
                        margin-bottom: 10px;
                        display: block;
                      }
                      .twitter-tweet-rendered {
                        margin: 10px auto !important;
                        max-width: 100% !important;
                      }
                      .error {
                        text-align: center;
                        padding: 40px 20px;
                        color: ${isDark ? '#ff6b6b' : '#e74c3c'};
                        font-size: 14px;
                      }
                    </style>
                  </head>
                  <body>
                    <div class="loading" id="loading">
                      <span class="loading-emoji">🐦</span>
                      <div>Loading ${twitterUrl.includes('x.com') ? 'X' : 'Twitter'} post...</div>
                    </div>
                    
                    <div id="error" class="error" style="display: none;">
                      <span class="loading-emoji">❌</span>
                      <div>Failed to load tweet</div>
                    </div>

                    <blockquote class="twitter-tweet" data-lang="en" data-theme="${isDark ? 'dark' : 'light'}" data-dnt="true">
                      <a href="${twitterUrl}" style="color: #1DA1F2; text-decoration: none;">
                        <div style="text-align: center; padding: 20px;">
                          <div style="font-size: 16px; margin-bottom: 8px;">🐦</div>
                          <div>Tap to load tweet</div>
                        </div>
                      </a>
                    </blockquote>

                    <script>
                      // Timeout handler
                      let loadTimeout = setTimeout(() => {
                        document.getElementById('loading').style.display = 'none';
                        document.getElementById('error').style.display = 'block';
                        console.log('Tweet loading timed out');
                      }, 10000);

                      // Twitter widget loader with error handling
                      (function(d, s, id) {
                        var js, fjs = d.getElementsByTagName(s)[0];
                        if (d.getElementById(id)) return;
                        js = d.createElement(s); js.id = id;
                        js.onload = function() {
                          console.log('Twitter widgets script loaded');
                          if (window.twttr && window.twttr.widgets) {
                            window.twttr.widgets.load().then(function() {
                              console.log('Twitter widgets rendered');
                              clearTimeout(loadTimeout);
                              document.getElementById('loading').style.display = 'none';
                            }).catch(function(error) {
                              console.log('Twitter widgets error:', error);
                              clearTimeout(loadTimeout);
                              document.getElementById('loading').style.display = 'none';
                              document.getElementById('error').style.display = 'block';
                            });
                          }
                        };
                        js.onerror = function() {
                          console.log('Failed to load Twitter widgets script');
                          clearTimeout(loadTimeout);
                          document.getElementById('loading').style.display = 'none';
                          document.getElementById('error').style.display = 'block';
                        };
                        js.src = 'https://platform.twitter.com/widgets.js';
                        js.charset = 'utf-8';
                        js.async = true;
                        fjs.parentNode.insertBefore(js, fjs);
                      }(document, 'script', 'twitter-wjs'));
                    </script>
                  </body>
                  </html>
                  `
                }}
                style={{ flex: 1 }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                originWhitelist={['*']}
                allowsLinkPreview={false}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                bounces={false}
                scrollEnabled={true}
                startInLoadingState={false}
                onLoadStart={() => console.log('Snap Twitter WebView loading started')}
                onLoad={() => console.log('Snap Twitter WebView loaded')}
                onError={(error) => console.log('Snap Twitter WebView error:', error)}
                onHttpError={(error) => console.log('Snap Twitter WebView HTTP error:', error)}
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
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                  {twitterUrl.includes('x.com') ? 'X' : 'TWITTER'}
                </Text>
              </View>
            </View>
          </View>
        )}
        {/* Images from markdown/html */}
        {imageUrls.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            {imageUrls.map((url, idx) => (
              <Pressable key={url + idx} onPress={() => handleImagePress(url)}>
                <ExpoImage
                  source={{ uri: url }}
                  style={{ width: '100%', height: 200, borderRadius: 12, marginBottom: 6, backgroundColor: '#eee' }}
                  contentFit="cover"
                />
              </Pressable>
            ))}
          </View>
        )}
        {isHtml ? (
          <RenderHtml
            contentWidth={windowWidth - 32}
            source={{ html: textBody }}
            baseStyle={{ color: colors.text, fontSize: 15, marginBottom: 8 }}
            enableExperimentalMarginCollapsing
            tagsStyles={{ a: { color: colors.icon } }}
            customHTMLElementModels={{
              video: defaultHTMLElementModels.video.extend({
                contentModel: HTMLContentModel.mixed,
              }),
            }}
            renderers={{
              video: ({ tnode }: any) => {
                const src = tnode?.attributes?.src;
                if (src && src.endsWith('.mp4')) {
                  return renderMp4Video(src);
                }
                return null;
              },
            }}
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
          {/* Edit button - only show for own content */}
          {snap.author === currentUsername && (
            <TouchableOpacity style={styles.replyButton} onPress={() => handleOpenEditModal(undefined, 'snap')}>
              <FontAwesome name="edit" size={16} color={colors.icon} />
              <Text style={[styles.replyButtonText, { color: colors.icon }]}>Edit</Text>
            </TouchableOpacity>
          )}
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
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        enabled
      >
        {/* Image Modal with react-native-image-viewing */}
        <ImageView
          images={modalImages}
          imageIndex={modalImageIndex}
          visible={imageModalVisible}
        onRequestClose={() => {
          setImageModalVisible(false);
          // Force status bar refresh after modal closes
          setTimeout(() => {
            // This helps prevent white stripe issues
          }, 100);
        }}
        backgroundColor="rgba(0, 0, 0, 0.95)"
        swipeToCloseEnabled={true}
        doubleTapToZoomEnabled={true}
        presentationStyle="fullScreen"
        HeaderComponent={() => (
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 50,
              right: 20,
              zIndex: 1000,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderRadius: 20,
              width: 40,
              height: 40,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setImageModalVisible(false)}
            accessibilityLabel="Close image"
          >
            <FontAwesome name="close" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      />
      {/* Conversation list (snap as header, replies as data) */}
      {loading ? (
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <FontAwesome name="hourglass-half" size={48} color={colors.icon} style={{ marginBottom: 12 }} />
          <Text style={{ color: colors.text, fontSize: 16 }}>Loading conversation...</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
          {renderSnapHeader()}
          <View style={styles.repliesList}>
            {replies.map(reply => renderReplyTree(reply))}
          </View>
        </ScrollView>
      )}
      {/* Reply modal composer and upvote modal remain unchanged */}
      <Modal
        isVisible={replyModalVisible}
        onBackdropPress={posting ? undefined : handleCloseReplyModal}
        onBackButtonPress={posting ? undefined : handleCloseReplyModal}
        style={{ justifyContent: 'flex-end', margin: 0 }}
        useNativeDriver
      >
        <View style={{ 
          backgroundColor: colors.background, 
          padding: 16, 
          borderTopLeftRadius: 18, 
          borderTopRightRadius: 18 
        }}>
          <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
            Reply to {replyTarget?.author}
          </Text>
          
          {/* Reply image preview */}
          {replyImage ? (
            <View style={{ marginBottom: 10 }}>
              <ExpoImage source={{ uri: replyImage }} style={{ width: 120, height: 120, borderRadius: 10 }} contentFit="cover" />
              <TouchableOpacity onPress={() => setReplyImage(null)} style={{ position: 'absolute', top: 4, right: 4 }} disabled={posting}>
                <FontAwesome name="close" size={20} color={colors.icon} />
              </TouchableOpacity>
            </View>
          ) : null}
          
          {/* Error message */}
          {postError ? (
            <Text style={{ color: 'red', marginBottom: 8 }}>{postError}</Text>
          ) : null}
          
          {/* Reply input row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <TouchableOpacity onPress={() => handleAddImage('reply')} disabled={uploading || posting} style={{ marginRight: 16 }}>
              <FontAwesome name="image" size={22} color={colors.icon} />
            </TouchableOpacity>
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              style={{
                flex: 1,
                minHeight: 60,
                color: colors.text,
                backgroundColor: colors.bubble,
                borderRadius: 10,
                padding: 10,
                marginRight: 10,
              }}
              placeholder="Write your reply..."
              placeholderTextColor={isDark ? '#8899A6' : '#888'}
              multiline
            />
            {uploading ? (
              <FontAwesome name="spinner" size={16} color="#fff" style={{ marginRight: 8 }} />
            ) : null}
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
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{posting ? 'Posting...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Edit Modal */}
      <Modal
        isVisible={editModalVisible}
        onBackdropPress={editing ? undefined : handleCloseEditModal}
        onBackButtonPress={editing ? undefined : handleCloseEditModal}
        style={{ justifyContent: 'flex-end', margin: 0 }}
        useNativeDriver
      >
        <View style={{ 
          backgroundColor: colors.background, 
          padding: 16, 
          borderTopLeftRadius: 18, 
          borderTopRightRadius: 18 
        }}>
          <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
            Edit {editTarget?.type === 'reply' ? 'Reply' : 'Snap'}
          </Text>
          
          {/* Edit image preview */}
          {editImage ? (
            <View style={{ marginBottom: 10 }}>
              <ExpoImage source={{ uri: editImage }} style={{ width: 120, height: 120, borderRadius: 10 }} contentFit="cover" />
              <TouchableOpacity onPress={() => setEditImage(null)} style={{ position: 'absolute', top: 4, right: 4 }} disabled={editing}>
                <FontAwesome name="close" size={20} color={colors.icon} />
              </TouchableOpacity>
            </View>
          ) : null}
          
          {/* Error message */}
          {editError ? (
            <Text style={{ color: 'red', marginBottom: 8 }}>{editError}</Text>
          ) : null}
          
          {/* Edit input row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <TouchableOpacity onPress={() => handleAddImage('edit')} disabled={editUploading || editing} style={{ marginRight: 16 }}>
              <FontAwesome name="image" size={22} color={colors.icon} />
            </TouchableOpacity>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              style={{
                flex: 1,
                minHeight: 80,
                color: colors.text,
                backgroundColor: colors.bubble,
                borderRadius: 10,
                padding: 10,
                marginRight: 10,
              }}
              placeholder={`Edit your ${editTarget?.type === 'reply' ? 'reply' : 'snap'}...`}
              placeholderTextColor={isDark ? '#8899A6' : '#888'}
              multiline
            />
            {editUploading ? (
              <FontAwesome name="spinner" size={16} color="#fff" style={{ marginRight: 8 }} />
            ) : null}
            <TouchableOpacity
              onPress={handleSubmitEdit}
              disabled={editUploading || editing || !editText.trim() || !currentUsername}
              style={{
                backgroundColor: colors.icon,
                borderRadius: 20,
                paddingHorizontal: 18,
                paddingVertical: 8,
                opacity: editUploading || editing || !editText.trim() || !currentUsername ? 0.6 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{editing ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
          {voteWeightLoading ? (
            <ActivityIndicator size="small" color={colors.icon} style={{ marginVertical: 16 }} />
          ) : (
            <>
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
              {voteValue && (
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginTop: 12 }}>
                  ${voteValue.usd} USD
                </Text>
              )}
            </>
          )}
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
      </KeyboardAvoidingView>
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
