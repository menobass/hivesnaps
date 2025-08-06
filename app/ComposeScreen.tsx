import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  useColorScheme,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Pressable,
  FlatList,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome } from '@expo/vector-icons';
import { Client, PrivateKey } from '@hiveio/dhive';
import { uploadImageToCloudinaryFixed } from '@/utils/cloudinaryImageUploadFixed';
import { useSharedContent } from '@/hooks/useSharedContent';
import { useShare } from '@/context/ShareContext';
import { useNotifications } from '@/context/NotificationContext';
import ReactNativeModal from 'react-native-modal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export default function ComposeScreen() {
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams();

  // Share extension integration
  const { sharedContent, hasSharedContent, clearSharedContent } =
    useSharedContent();
  const shareContext = useShare();
  const notifications = useNotifications();

  // Component state
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Text selection state for markdown formatting
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const textInputRef = useRef<TextInput>(null);

  // Spoiler modal state
  const [spoilerModalVisible, setSpoilerModalVisible] = useState(false);
  const [spoilerButtonText, setSpoilerButtonText] = useState('');

  // GIF picker state
  const [gifs, setGifs] = useState<string[]>([]);
  const [gifModalVisible, setGifModalVisible] = useState(false);
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);

  const colors = {
    background: isDark ? '#15202B' : '#fff',
    text: isDark ? '#D7DBDC' : '#0F1419',
    inputBg: isDark ? '#22303C' : '#F7F9F9',
    inputBorder: isDark ? '#38444D' : '#CFD9DE',
    button: '#1DA1F2',
    buttonText: '#FFFFFF',
    buttonInactive: isDark ? '#22303C' : '#E1E8ED',
    info: isDark ? '#8899A6' : '#536471',
  };

  // Load user credentials and avatar
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const storedUsername = await SecureStore.getItemAsync('hive_username');
        setCurrentUsername(storedUsername);

        // Fetch user avatar
        if (storedUsername) {
          try {
            const accounts = await client.database.call('get_accounts', [
              [storedUsername],
            ]);
            if (accounts && accounts[0]) {
              let meta = accounts[0].posting_json_metadata;
              if (!meta || meta === '{}') {
                meta = accounts[0].json_metadata;
              }
              if (meta) {
                try {
                  const profile = JSON.parse(meta).profile;
                  if (profile && profile.profile_image) {
                    setAvatarUrl(profile.profile_image);
                  }
                } catch (e) {
                  console.warn('Error parsing profile metadata:', e);
                }
              }
            }
          } catch (e) {
            console.warn('Error fetching user profile:', e);
          }
        }
      } catch (e) {
        console.error('Error loading credentials:', e);
      }
    };
    loadCredentials();
  }, []);

  // Handle shared content when component mounts or shared content changes
  useEffect(() => {
    if (hasSharedContent && sharedContent) {
      console.log('📱 ComposeScreen received shared content:', sharedContent);

      switch (sharedContent.type) {
        case 'text':
          if (typeof sharedContent.data === 'string') {
            setText(prev =>
              prev
                ? `${prev}\n\n${sharedContent.data}`
                : (sharedContent.data as string)
            );
          }
          break;

        case 'url':
          if (typeof sharedContent.data === 'string') {
            setText(prev =>
              prev
                ? `${prev}\n\n${sharedContent.data}`
                : (sharedContent.data as string)
            );
          }
          break;

        case 'image':
          if (typeof sharedContent.data === 'string') {
            setImages(prev => [...prev, sharedContent.data as string]);
          }
          break;

        case 'images':
          // For multiple images, add all of them
          if (Array.isArray(sharedContent.data)) {
            setImages(prev => [...prev, ...sharedContent.data]);
          }
          break;
      }

      // Clear shared content after processing
      clearSharedContent();
    }
  }, [sharedContent, hasSharedContent, clearSharedContent]);

  // Handle resnap URL parameter
  useEffect(() => {
    if (params.resnapUrl) {
      const resnapUrl = Array.isArray(params.resnapUrl)
        ? params.resnapUrl[0]
        : params.resnapUrl;

      if (typeof resnapUrl === 'string') {
        setText(prev => (prev ? `${prev}\n\n${resnapUrl}` : resnapUrl));
      }
    }
  }, [params.resnapUrl]);

  const handleAddImage = async () => {
    try {
      let pickType: 'camera' | 'gallery' | 'cancel';

      if (Platform.OS === 'ios') {
        pickType = await new Promise<'camera' | 'gallery' | 'cancel'>(
          resolve => {
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
          }
        );
      } else {
        pickType = await new Promise<'camera' | 'gallery' | 'cancel'>(
          resolve => {
            Alert.alert(
              'Add Images',
              'Choose an option',
              [
                { text: 'Take Photo', onPress: () => resolve('camera') },
                {
                  text: 'Choose from Gallery',
                  onPress: () => resolve('gallery'),
                },
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => resolve('cancel'),
                },
              ],
              { cancelable: true }
            );
          }
        );
      }

      if (pickType === 'cancel') return;

      let result;
      if (pickType === 'camera') {
        const currentPermission = await ImagePicker.getCameraPermissionsAsync();
        let finalStatus = currentPermission.status;

        if (finalStatus !== 'granted') {
          const requestPermission =
            await ImagePicker.requestCameraPermissionsAsync();
          finalStatus = requestPermission.status;
        }

        if (finalStatus !== 'granted') {
          Alert.alert(
            'Camera Permission Required',
            'HiveSnaps needs camera access to take photos. Please enable camera permissions in your device settings.',
            [{ text: 'OK' }]
          );
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.8,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      } else {
        const currentPermission =
          await ImagePicker.getMediaLibraryPermissionsAsync();
        let finalStatus = currentPermission.status;

        if (finalStatus !== 'granted') {
          const requestPermission =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          finalStatus = requestPermission.status;
        }

        if (finalStatus !== 'granted') {
          Alert.alert(
            'Photo Library Permission Required',
            'HiveSnaps needs photo library access to select images. Please enable photo permissions in your device settings.',
            [{ text: 'OK' }]
          );
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false, // Allow multiple selection
          quality: 0.8,
          allowsMultipleSelection: true, // Enable multiple selection
          selectionLimit: 10, // Limit to 10 images
        });
      }

      if (
        !result ||
        result.canceled ||
        !result.assets ||
        result.assets.length === 0
      )
        return;

      setUploading(true);
      try {
        const uploadPromises = result.assets.map(async (asset, index) => {
          const fileToUpload = {
            uri: asset.uri,
            name: `compose-${Date.now()}-${index}.jpg`,
            type: 'image/jpeg',
          };
          return await uploadImageToCloudinaryFixed(fileToUpload);
        });

        const cloudinaryUrls = await Promise.all(uploadPromises);
        setImages(prev => [...prev, ...cloudinaryUrls]);
      } catch (err) {
        console.error('Image upload error:', err);
        Alert.alert(
          'Upload Failed',
          'Failed to upload one or more images. Please try again.'
        );
      } finally {
        setUploading(false);
      }
    } catch (err) {
      console.error('Image picker error:', err);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleClearAllImages = () => {
    setImages([]);
  };

  // GIF handlers
  const handleOpenGifPicker = () => {
    setGifModalVisible(true);
    // Load trending GIFs initially
    setGifResults([]);
    setGifSearchQuery('');
    // Load trending GIFs when modal opens
    handleSearchGifs('');
  };

  const handleCloseGifModal = () => {
    setGifModalVisible(false);
    setGifSearchQuery('');
    setGifResults([]);
  };

  const handleSearchGifs = async (query: string) => {
    console.log('[GIF Search Debug] Starting search with query:', query);
    setGifLoading(true);
    try {
      console.log('[GIF Search Debug] Importing tenor API...');
      const { searchGifs, getTrendingGifs } = await import('../utils/tenorApi');
      console.log('[GIF Search Debug] Tenor API imported successfully');

      const response = query.trim()
        ? await searchGifs(query, 20)
        : await getTrendingGifs(20);

      console.log('[GIF Search Debug] API response:', response);
      console.log(
        '[GIF Search Debug] Results count:',
        response?.results?.length || 0
      );
      setGifResults(response.results);
    } catch (error) {
      console.error('[GIF Search Debug] Error searching GIFs:', error);
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  };

  const handleSelectGif = (gifUrl: string) => {
    setGifs(prev => [...prev, gifUrl]);
    handleCloseGifModal();
  };

  const handleRemoveGif = (indexToRemove: number) => {
    setGifs(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async () => {
    if (!text.trim() && images.length === 0 && gifs.length === 0) {
      Alert.alert(
        'Empty Post',
        'Please add some text, images, or GIFs before posting.'
      );
      return;
    }

    if (!currentUsername) {
      Alert.alert('Not Logged In', 'Please log in to post to Hive.');
      return;
    }

    setPosting(true);

    try {
      // Get posting key from secure storage
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) {
        throw new Error('No posting key found. Please log in again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Compose body
      let body = text.trim();
      if (images.length > 0) {
        // Add all images to the body
        images.forEach((imageUrl, index) => {
          body += `\n![image${index + 1}](${imageUrl})`;
        });
      }
      if (gifs.length > 0) {
        // Add all GIFs to the body
        gifs.forEach((gifUrl, index) => {
          body += `\n![gif${index + 1}](${gifUrl})`;
        });
      }

      // Get latest @peak.snaps post (container) - Same as FeedScreen
      const discussions = await client.database.call(
        'get_discussions_by_blog',
        [{ tag: 'peak.snaps', limit: 1 }]
      );
      if (!discussions || discussions.length === 0) {
        throw new Error('No container post found.');
      }
      const container = discussions[0];

      // Generate permlink - Same format as FeedScreen
      const permlink = `snap-${Date.now()}`;

      // Compose metadata - Same format as FeedScreen
      const allMedia = [...images, ...gifs];
      const json_metadata = JSON.stringify({
        app: 'hivesnaps/1.0',
        image: allMedia, // Include all images and GIFs in metadata
        shared: hasSharedContent, // Additional flag for shared content
      });

      // Post to Hive blockchain as reply to container (same as FeedScreen)
      await client.broadcast.comment(
        {
          parent_author: container.author,
          parent_permlink: container.permlink,
          author: currentUsername,
          permlink,
          title: '',
          body,
          json_metadata,
        },
        postingKey
      );

      // Success - clear form and navigate back to feed
      setText('');
      setImages([]);
      setGifs([]);
      clearSharedContent(); // Clear any shared content

      Alert.alert(
        'Posted Successfully!',
        'Your snap has been published to the Hive blockchain.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.push('/FeedScreen');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error posting snap:', error);
      Alert.alert(
        'Post Failed',
        error.message || 'Failed to post snap. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setPosting(false);
    }
  };

  const handleCancel = () => {
    if (text.trim() || images.length > 0 || gifs.length > 0) {
      Alert.alert(
        'Discard Post?',
        'Are you sure you want to discard this post?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setText('');
              setImages([]);
              setGifs([]);
              router.back();
            },
          },
        ]
      );
    } else {
      router.back();
    }
  };

  // Markdown formatting functions
  const insertMarkdown = (
    before: string,
    after: string,
    placeholder: string
  ) => {
    const hasSelection = selectionStart !== selectionEnd;

    if (hasSelection) {
      // Wrap selected text
      const beforeText = text.substring(0, selectionStart);
      const selectedText = text.substring(selectionStart, selectionEnd);
      const afterText = text.substring(selectionEnd);

      const newText = beforeText + before + selectedText + after + afterText;
      setText(newText);

      // Position cursor after the formatted text
      const newCursorPosition =
        selectionStart + before.length + selectedText.length + after.length;
      setTimeout(() => {
        textInputRef.current?.setNativeProps({
          selection: { start: newCursorPosition, end: newCursorPosition },
        });
      }, 10);
    } else {
      // Insert with placeholder and select it
      const beforeText = text.substring(0, selectionStart);
      const afterText = text.substring(selectionStart);

      const newText = beforeText + before + placeholder + after + afterText;
      setText(newText);

      // Select the placeholder text for easy replacement
      const placeholderStart = selectionStart + before.length;
      const placeholderEnd = placeholderStart + placeholder.length;
      setTimeout(() => {
        textInputRef.current?.setNativeProps({
          selection: { start: placeholderStart, end: placeholderEnd },
        });
      }, 10);
    }
  };

  const handleBold = () => {
    insertMarkdown('**', '**', 'bold text');
  };

  const handleItalic = () => {
    insertMarkdown('*', '*', 'italic text');
  };

  const handleUnderline = () => {
    insertMarkdown('<u>', '</u>', 'underlined text');
  };

  const handleSpoiler = () => {
    setSpoilerButtonText('');
    setSpoilerModalVisible(true);
  };

  const handleSpoilerConfirm = () => {
    const buttonText = spoilerButtonText.trim() || 'button text';
    const spoilerSyntax = `>! [${buttonText}] spoiler content`;

    const beforeText = text.substring(0, selectionStart);
    const afterText = text.substring(selectionStart);
    const newText = beforeText + spoilerSyntax + afterText;
    setText(newText);

    // Position cursor after "spoiler content" and select it for easy replacement
    const contentStart = selectionStart + `>! [${buttonText}] `.length;
    const contentEnd = contentStart + 'spoiler content'.length;
    setTimeout(() => {
      textInputRef.current?.setNativeProps({
        selection: { start: contentStart, end: contentEnd },
      });
    }, 10);

    setSpoilerModalVisible(false);
    setSpoilerButtonText('');
  };

  const handleSelectionChange = (event: any) => {
    const { start, end } = event.nativeEvent.selection;
    setSelectionStart(start);
    setSelectionEnd(end);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View
          style={[styles.header, { borderBottomColor: colors.inputBorder }]}
        >
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, { color: colors.text }]}>
              Cancel
            </Text>
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: colors.text }]}>
            New Snap
          </Text>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={
              posting ||
              (!text.trim() && images.length === 0 && gifs.length === 0)
            }
            style={[
              styles.headerButton,
              styles.postButton,
              {
                backgroundColor:
                  posting ||
                  (!text.trim() && images.length === 0 && gifs.length === 0)
                    ? colors.buttonInactive
                    : colors.button,
              },
            ]}
          >
            {posting ? (
              <ActivityIndicator size='small' color={colors.buttonText} />
            ) : (
              <Text
                style={[styles.headerButtonText, { color: colors.buttonText }]}
              >
                Post
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* User info */}
          <View style={styles.userRow}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatar}
                onError={() => setAvatarUrl(null)}
              />
            ) : (
              <View
                style={[styles.avatar, { backgroundColor: colors.inputBg }]}
              >
                <FontAwesome name='user' size={20} color={colors.info} />
              </View>
            )}
            <Text style={[styles.username, { color: colors.text }]}>
              {currentUsername || 'Anonymous'}
            </Text>
          </View>

          {/* Test Share Function (Development Only) */}
          {__DEV__ && (
            <View style={styles.devSection}>
              <Text style={[styles.sectionTitle, { color: colors.info }]}>
                🧪 Test Share Functionality
              </Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.testButton,
                    { backgroundColor: colors.inputBg },
                  ]}
                  onPress={() =>
                    shareContext.simulateSharedContent?.({
                      type: 'text',
                      data: 'This is a test shared text! 🚀',
                    })
                  }
                >
                  <Text
                    style={[styles.testButtonText, { color: colors.button }]}
                  >
                    Share Text
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.testButton,
                    { backgroundColor: colors.inputBg },
                  ]}
                  onPress={() =>
                    shareContext.simulateSharedContent?.({
                      type: 'url',
                      data: 'https://hive.blog',
                    })
                  }
                >
                  <Text
                    style={[styles.testButtonText, { color: colors.button }]}
                  >
                    Share URL
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.testButton,
                    { backgroundColor: colors.inputBg },
                  ]}
                  onPress={() =>
                    shareContext.simulateSharedContent?.({
                      type: 'image',
                      data: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500',
                    })
                  }
                >
                  <Text
                    style={[styles.testButtonText, { color: colors.button }]}
                  >
                    Share Image
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.testButton,
                    { backgroundColor: colors.inputBg },
                  ]}
                  onPress={() =>
                    shareContext.simulateSharedContent?.({
                      type: 'images',
                      data: [
                        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500',
                        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500',
                      ],
                    })
                  }
                >
                  <Text
                    style={[styles.testButtonText, { color: colors.button }]}
                  >
                    Share Multiple
                  </Text>
                </TouchableOpacity>
              </View>

              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.info, marginTop: 20 },
                ]}
              >
                🔔 Test Notifications
              </Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.testButton,
                    { backgroundColor: colors.inputBg },
                  ]}
                  onPress={notifications.sendTestNotification}
                >
                  <Text
                    style={[styles.testButtonText, { color: colors.button }]}
                  >
                    Test Notification
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.testButton,
                    { backgroundColor: colors.inputBg },
                  ]}
                  onPress={notifications.clearAllNotifications}
                >
                  <Text
                    style={[styles.testButtonText, { color: colors.button }]}
                  >
                    Clear All
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.notificationStatus}>
                <Text style={[styles.testButtonText, { color: colors.text }]}>
                  🔔 Status: {notifications.isEnabled ? 'Enabled' : 'Disabled'}
                </Text>
                {notifications.currentUsername && (
                  <Text style={[styles.testButtonText, { color: colors.text }]}>
                    👤 User: @{notifications.currentUsername}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Text input */}
          <TextInput
            ref={textInputRef}
            style={[
              styles.textInput,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.inputBorder,
              },
            ]}
            value={text}
            onChangeText={setText}
            onSelectionChange={handleSelectionChange}
            placeholder="What's happening?"
            placeholderTextColor={colors.info}
            multiline
            textAlignVertical='top'
            maxLength={280}
          />

          {/* Character count */}
          <View style={styles.charCountRow}>
            <Text
              style={[
                styles.charCount,
                {
                  color:
                    text.length > 260
                      ? '#e74c3c'
                      : text.length > 240
                        ? '#f39c12'
                        : colors.info,
                },
              ]}
            >
              {text.length}/280
            </Text>
          </View>

          {/* Images preview */}
          {images.length > 0 && (
            <View style={styles.imagesContainer}>
              <View style={styles.imagesHeader}>
                <Text style={[styles.imagesCount, { color: colors.text }]}>
                  {images.length} image{images.length > 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.clearAllButton,
                    { backgroundColor: colors.buttonInactive },
                  ]}
                  onPress={handleClearAllImages}
                >
                  <Text style={[styles.clearAllText, { color: colors.text }]}>
                    Clear All
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imagesScrollView}
                contentContainerStyle={styles.imagesScrollContent}
              >
                {images.map((imageUrl, index) => (
                  <View
                    key={`${imageUrl}-${index}`}
                    style={styles.imageContainer}
                  >
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.imagePreview}
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => handleRemoveImage(index)}
                    >
                      <FontAwesome name='times' size={16} color='#fff' />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* GIF Previews */}
          {gifs.length > 0 && (
            <View style={styles.imagesContainer}>
              <View style={styles.imagesHeader}>
                <Text style={[styles.imagesCount, { color: colors.text }]}>
                  GIFs ({gifs.length})
                </Text>
                {gifs.length > 1 && (
                  <TouchableOpacity onPress={() => setGifs([])}>
                    <Text style={[styles.clearAllText, { color: colors.info }]}>
                      Clear All
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imagesScrollView}
                contentContainerStyle={styles.imagesScrollContent}
              >
                {gifs.map((gifUrl, index) => (
                  <View
                    key={`gif-${gifUrl}-${index}`}
                    style={styles.imageContainer}
                  >
                    <Image
                      source={{ uri: gifUrl }}
                      style={styles.imagePreview}
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => handleRemoveGif(index)}
                    >
                      <FontAwesome name='times' size={16} color='#fff' />
                    </TouchableOpacity>
                    {/* GIF badge */}
                    <View style={styles.gifBadge}>
                      <Text style={styles.gifBadgeText}>GIF</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actions}>
            {/* Markdown formatting toolbar */}
            <View style={styles.markdownToolbar}>
              <TouchableOpacity
                style={[
                  styles.markdownButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={handleBold}
              >
                <FontAwesome name='bold' size={16} color={colors.button} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.markdownButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={handleItalic}
              >
                <FontAwesome name='italic' size={16} color={colors.button} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.markdownButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={handleUnderline}
              >
                <FontAwesome name='underline' size={16} color={colors.button} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.markdownButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={handleSpoiler}
              >
                <FontAwesome name='eye-slash' size={16} color={colors.button} />
              </TouchableOpacity>
            </View>

            {/* Image and GIF buttons */}
            <View style={styles.mediaButtons}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={handleAddImage}
                disabled={uploading || images.length >= 10}
              >
                {uploading ? (
                  <ActivityIndicator size='small' color={colors.button} />
                ) : (
                  <>
                    <FontAwesome
                      name='image'
                      size={20}
                      color={images.length >= 10 ? colors.info : colors.button}
                    />
                    {images.length > 0 && (
                      <View
                        style={[
                          styles.imageBadge,
                          { backgroundColor: colors.button },
                        ]}
                      >
                        <Text style={styles.imageBadgeText}>
                          {images.length}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.inputBg, marginLeft: 12 },
                ]}
                onPress={handleOpenGifPicker}
                disabled={gifs.length >= 5}
              >
                <Text
                  style={{
                    fontSize: 18,
                    color: gifs.length >= 5 ? colors.info : colors.button,
                    fontWeight: 'bold',
                  }}
                >
                  GIF
                </Text>
                {gifs.length > 0 && (
                  <View
                    style={[
                      styles.imageBadge,
                      { backgroundColor: colors.button },
                    ]}
                  >
                    <Text style={styles.imageBadgeText}>{gifs.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {images.length >= 10 && (
              <Text style={[styles.limitText, { color: colors.info }]}>
                Maximum 10 images
              </Text>
            )}
            {gifs.length >= 5 && (
              <Text style={[styles.limitText, { color: colors.info }]}>
                Maximum 5 GIFs
              </Text>
            )}
          </View>

          {/* Shared content indicator */}
          {hasSharedContent && (
            <View
              style={[
                styles.sharedIndicator,
                { backgroundColor: colors.inputBg },
              ]}
            >
              <FontAwesome name='share' size={16} color={colors.button} />
              <Text style={[styles.sharedText, { color: colors.info }]}>
                Content shared from another app
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* GIF Picker Modal */}
      <ReactNativeModal
        isVisible={gifModalVisible}
        onBackdropPress={handleCloseGifModal}
        onBackButtonPress={handleCloseGifModal}
        style={{ margin: 0, justifyContent: 'flex-start' }}
        backdropOpacity={0.5}
        avoidKeyboard={true}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
            height: '85%',
            paddingTop: 60, // Account for status bar
            marginTop: Platform.OS === 'ios' ? 44 : 24,
          }}
        >
          {/* Modal Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingBottom: 15,
              borderBottomWidth: 1,
              borderBottomColor: colors.inputBorder,
            }}
          >
            <Text
              style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}
            >
              Choose a GIF
            </Text>
            <Pressable onPress={handleCloseGifModal}>
              <FontAwesome name='close' size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Search Bar */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 15,
            }}
          >
            <TextInput
              style={{
                backgroundColor: colors.inputBg,
                borderRadius: 20,
                paddingHorizontal: 15,
                paddingVertical: 10,
                fontSize: 16,
                color: colors.text,
              }}
              placeholder='Search for GIFs...'
              placeholderTextColor={colors.text + '80'}
              value={gifSearchQuery}
              onChangeText={setGifSearchQuery}
              returnKeyType='search'
              onSubmitEditing={() => {
                if (gifSearchQuery.trim()) {
                  handleSearchGifs(gifSearchQuery.trim());
                } else {
                  handleSearchGifs(''); // This will load trending GIFs
                }
              }}
            />
          </View>

          {/* GIF Results */}
          <View style={{ flex: 1, paddingHorizontal: 10, paddingBottom: 20 }}>
            {gifLoading ? (
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 200,
                }}
              >
                <ActivityIndicator size='large' color={colors.button} />
                <Text style={{ color: colors.text, marginTop: 10 }}>
                  Searching GIFs...
                </Text>
              </View>
            ) : gifResults.length > 0 ? (
              <FlatList
                data={gifResults}
                keyExtractor={(item, index) =>
                  `gif-${index}-${item?.id || Math.random()}`
                }
                numColumns={2}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  // Get the best GIF URL (preview size for picker)
                  const gifUrl =
                    item?.media_formats?.gif?.url ||
                    item?.media_formats?.tinygif?.url ||
                    item?.media_formats?.nanogif?.url;

                  if (!gifUrl) return null;

                  return (
                    <Pressable
                      onPress={() => handleSelectGif(gifUrl)}
                      style={{
                        flex: 1,
                        margin: 5,
                        borderRadius: 8,
                        overflow: 'hidden',
                        backgroundColor: colors.inputBg,
                      }}
                    >
                      <Image
                        source={{ uri: gifUrl }}
                        style={{
                          width: '100%',
                          aspectRatio: 1,
                          borderRadius: 8,
                        }}
                        resizeMode='cover'
                      />
                    </Pressable>
                  );
                }}
              />
            ) : (
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 200,
                }}
              >
                <FontAwesome
                  name='search'
                  size={48}
                  color={colors.inputBorder}
                />
                <Text
                  style={{
                    color: colors.text,
                    marginTop: 10,
                    textAlign: 'center',
                  }}
                >
                  {gifSearchQuery ? 'No GIFs found' : 'Search for GIFs above'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ReactNativeModal>

      {/* Spoiler Modal */}
      <Modal
        visible={spoilerModalVisible}
        transparent
        animationType='fade'
        onRequestClose={() => setSpoilerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.spoilerModal,
              {
                backgroundColor: colors.background,
                borderColor: colors.inputBorder,
              },
            ]}
          >
            <Text style={[styles.spoilerModalTitle, { color: colors.text }]}>
              Add Spoiler
            </Text>

            <Text
              style={[styles.spoilerModalDescription, { color: colors.info }]}
            >
              Enter the text that will appear on the spoiler button:
            </Text>

            <TextInput
              style={[
                styles.spoilerInput,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderColor: colors.inputBorder,
                },
              ]}
              value={spoilerButtonText}
              onChangeText={setSpoilerButtonText}
              placeholder='button text'
              placeholderTextColor={colors.info}
              maxLength={50}
              autoFocus
            />

            <View style={styles.spoilerModalButtons}>
              <TouchableOpacity
                style={[
                  styles.spoilerModalButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={() => setSpoilerModalVisible(false)}
              >
                <Text
                  style={[
                    styles.spoilerModalButtonText,
                    { color: colors.text },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.spoilerModalButton,
                  { backgroundColor: colors.button },
                ]}
                onPress={handleSpoilerConfirm}
              >
                <Text
                  style={[
                    styles.spoilerModalButtonText,
                    { color: colors.buttonText },
                  ]}
                >
                  Add Spoiler
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  postButton: {
    // Additional styles for post button
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  textInput: {
    fontSize: 18,
    lineHeight: 24,
    minHeight: 120,
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  charCount: {
    fontSize: 14,
  },
  imagesContainer: {
    marginBottom: 16,
  },
  imagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  imagesCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  clearAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '500',
  },
  imagesScrollView: {
    marginHorizontal: -8,
  },
  imagesScrollContent: {
    paddingHorizontal: 8,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 8,
    width: 120,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'column',
    marginBottom: 16,
  },
  markdownToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  markdownButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  mediaButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  imageBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  gifBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  gifBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  limitText: {
    fontSize: 12,
    marginLeft: 8,
  },
  sharedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  sharedText: {
    marginLeft: 8,
    fontSize: 14,
    fontStyle: 'italic',
  },
  devSection: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffa500',
    borderStyle: 'dashed',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  testButton: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  notificationStatus: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  // Spoiler modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spoilerModal: {
    width: '85%',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  spoilerModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  spoilerModalDescription: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  spoilerInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  spoilerModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  spoilerModalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  spoilerModalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
