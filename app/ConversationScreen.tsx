import React, { useState, useRef, useCallback } from 'react';
import { SafeAreaView as SafeAreaViewRN } from 'react-native';
import { SafeAreaView as SafeAreaViewSA, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, FlatList, useColorScheme, Image, Pressable, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { ConversationScreenStyles } from '../styles/ConversationScreenStyles';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
import { 
  extractHivePostUrls, 
  fetchMultipleHivePostInfos, 
  removeHivePostUrls, 
  HivePostInfo 
} from '../utils/extractHivePostInfo';
import { ContextHivePostPreviewRenderer } from '../components/ContextHivePostPreviewRenderer';
import { HivePostPreview } from '../components/HivePostPreview';
import { convertSpoilerSyntax, SpoilerData } from '../utils/spoilerParser';
import SpoilerText from './components/SpoilerText';

// Custom hooks for business logic
import { useUserAuth } from '../hooks/useUserAuth';
import { useConversationData, SnapData, ReplyData } from '../hooks/useConversationData';
import { useUpvote } from '../hooks/useUpvote';
import { useHiveData } from '../hooks/useHiveData';
import { useReply, ReplyTarget } from '../hooks/useReply';
import { useEdit, EditTarget } from '../hooks/useEdit';
import { useGifPicker, GifMode } from '../hooks/useGifPicker';

const ConversationScreenRefactored = () => {
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Get navigation params
  const params = useLocalSearchParams();
  const author = params.author as string | undefined;
  const permlink = params.permlink as string | undefined;

  // Custom hooks for business logic
  const { username: currentUsername } = useUserAuth();
  
  const {
    snap,
    replies,
    loading,
    error: conversationError,
    refreshConversation,
    checkForNewContent
  } = useConversationData(author, permlink, currentUsername);

  const {
    hivePrice,
    globalProps,
    rewardFund
  } = useHiveData();

  const {
    upvoteModalVisible,
    upvoteTarget,
    voteWeight,
    voteValue,
    upvoteLoading,
    upvoteSuccess,
    voteWeightLoading,
    openUpvoteModal,
    closeUpvoteModal,
    setVoteWeight,
    confirmUpvote,
    updateSnapsOptimistically
  } = useUpvote(currentUsername, globalProps, rewardFund, hivePrice);

  // Content detection functions for polling
  const [replySubmissionTime, setReplySubmissionTime] = useState<number | null>(null);
  const [editSubmissionTime, setEditSubmissionTime] = useState<number | null>(null);

  // Submission start callbacks
  const handleReplySubmissionStart = useCallback(() => {
    console.log(`Reply submission started at ${Date.now()}`);
    setReplySubmissionTime(Date.now());
  }, []);

  const handleEditSubmissionStart = useCallback(() => {
    console.log(`Edit submission started at ${Date.now()}`);
    setEditSubmissionTime(Date.now());
  }, []);

  const {
    replyModalVisible,
    replyText,
    replyImage,
    replyGif,
    replyTarget,
    posting,
    uploading,
    processing: replyProcessing,
    error: replyError,
    openReplyModal,
    closeReplyModal,
    setReplyText,
    setReplyImage,
    setReplyGif,
    submitReply,
    addImage: addReplyImage,
    addGif: addReplyGif
  } = useReply(currentUsername, checkForNewContent, handleReplySubmissionStart);

  const {
    editModalVisible,
    editText,
    editImage,
    editGif,
    editTarget,
    editing,
    uploading: editUploading,
    processing: editProcessing,
    error: editError,
    openEditModal,
    closeEditModal,
    setEditText,
    setEditImage,
    setEditGif,
    submitEdit,
    addImage: addEditImage,
    addGif: addEditGif
  } = useEdit(currentUsername, checkForNewContent, handleEditSubmissionStart);

  const {
    gifModalVisible,
    gifSearchQuery,
    gifResults,
    gifLoading,
    gifMode,
    openGifPicker,
    closeGifModal,
    setGifSearchQuery,
    searchGifs,
    selectGif
  } = useGifPicker();

  // Local UI state
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [modalImages, setModalImages] = useState<Array<{uri: string}>>([]);
  const [modalImageIndex, setModalImageIndex] = useState(0);

  // Error handling
  if (!author || !permlink) {
    return (
      <SafeAreaViewRN style={[ConversationScreenStyles.safeArea, { backgroundColor: isDark ? '#15202B' : '#fff' }]}> 
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <Text style={{ color: isDark ? '#D7DBDC' : '#0F1419', fontSize: 16 }}>Error: Missing conversation parameters.</Text>
        </View>
      </SafeAreaViewRN>
    );
  }

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

  // Event handlers
  const handleRefresh = () => {
    refreshConversation();
  };

  const handleGoToParentSnap = () => {
    if (!snap?.parent_author || !snap?.parent_permlink) {
      console.log('No parent snap available');
      return;
    }
    
    router.push({ 
      pathname: '/ConversationScreen', 
      params: { 
        author: snap.parent_author, 
        permlink: snap.parent_permlink 
      } 
    });
  };

  const isTopLevelSnap = () => {
    return !snap?.parent_author || snap.parent_author === '' || snap.parent_author === 'peak.snaps';
  };

  const handleUpvotePress = ({ author, permlink }: { author: string; permlink: string }) => {
    openUpvoteModal({ author, permlink });
  };

  const handleOpenReplyModal = (author: string, permlink: string) => {
    openReplyModal({ author, permlink });
  };

  const handleOpenEditModal = (content?: { author: string; permlink: string; body: string }, type: 'snap' | 'reply' = 'snap') => {
    if (type === 'snap') {
      if (!snap) return;
      openEditModal({ author: snap.author, permlink: snap.permlink!, type: 'snap' }, snap.body);
    } else {
      if (!content) return;
      openEditModal({ author: content.author, permlink: content.permlink, type: 'reply' }, content.body);
    }
  };

  const handleImagePress = (imageUrl: string) => {
    setModalImages([{ uri: imageUrl }]);
    setModalImageIndex(0);
    setImageModalVisible(true);
  };

  const handleOpenGifPicker = (mode: GifMode) => {
    openGifPicker(mode);
  };

  const handleSelectGif = (gifUrl: string) => {
    if (gifMode === 'edit') {
      addEditGif(gifUrl);
    } else {
      addReplyGif(gifUrl);
    }
    closeGifModal();
  };

  // Utility functions (simplified versions)
  const stripImageTags = (text: string): string => {
    let out = text.replace(/!\[[^\]]*\]\([^\)]+\)/g, '');
    out = out.replace(/<img[^>]+src=["'][^"'>]+["'][^>]*>/g, '');
    return out;
  };

  const preserveParagraphSpacing = (text: string): string => {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n\n+/g, '\n\n')
      .replace(/\n\n/g, '\n\n');
  };

  const linkifyUrls = (text: string): string => {
    return text.replace(/(https?:\/\/[\w.-]+(?:\/[\w\-./?%&=+#@]*)?)/gi, (url) => {
      if (/\]\([^)]+\)$/.test(url) || /href=/.test(url)) return url;
      
      const youtubeMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      const threeSpeakMatch = url.match(/https:\/\/3speak\.tv\/watch\?v=([^\/\s]+)\/([a-zA-Z0-9_-]+)/);
      const ipfsMatch = url.match(/ipfs\/([A-Za-z0-9]+)/);
      const mp4Match = url.match(/\.mp4($|\?)/i);
      const twitterMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/i);
      
      if (youtubeMatch || threeSpeakMatch || ipfsMatch || mp4Match || twitterMatch) {
        return url;
      }
      
      return `[${url}](${url})`;
    });
  };

  const linkifyMentions = (text: string): string => {
    return text.replace(/(^|[^\w/@])@([a-z0-9\-\.]{3,16})(?![a-z0-9\-\.])/gi, (match, pre, username, offset, string) => {
      const beforeMatch = string.substring(0, offset);
      const afterMatch = string.substring(offset + match.length);
      
      const openBrackets = (beforeMatch.match(/\[/g) || []).length;
      const closeBrackets = (beforeMatch.match(/\]/g) || []).length;
      const isInsideMarkdownLink = openBrackets > closeBrackets && afterMatch.includes('](');
      
      if (isInsideMarkdownLink) {
        return match;
      }
      
      return `${pre}[**@${username}**](profile://${username})`;
    });
  };

  const linkifyHashtags = (text: string): string => {
    return text.replace(/(^|[^\w/#])#(\w+)(?![a-z0-9\-\.])/gi, (match, pre, hashtag, offset, string) => {
      const beforeMatch = string.substring(0, offset);
      const afterMatch = string.substring(offset + match.length);
      
      const openBrackets = (beforeMatch.match(/\[/g) || []).length;
      const closeBrackets = (beforeMatch.match(/\]/g) || []).length;
      const isInsideMarkdownLink = openBrackets > closeBrackets && afterMatch.includes('](');
      
      if (isInsideMarkdownLink) {
        return match;
      }
      
      return `${pre}[**#${hashtag}**](hashtag://${hashtag})`;
    });
  };

  const containsHtml = (str: string): boolean => {
    return /<([a-z][\s\S]*?)>/i.test(str);
  };

  // Render functions (simplified)
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

  // Custom markdown rules (simplified)
  const markdownRules = {
    image: (node: any, children: any, parent: any, styles: any) => {
      const { src, alt } = node.attributes;
      const uniqueKey = `${src || alt}-${Math.random().toString(36).substr(2, 9)}`;
      return (
        <Pressable key={uniqueKey} onPress={() => handleImagePress(src)}>
          <Image
            source={{ uri: src }}
            style={{
              width: '100%',
              aspectRatio: 1.2,
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
    link: (node: any, children: any, parent: any, styles: any) => {
      const { href } = node.attributes;
      
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
      
      const uniqueKey = href ? `${href}-${Math.random().toString(36).substr(2, 9)}` : Math.random().toString(36).substr(2, 9);
      return (
        <Text key={uniqueKey} style={[{ color: colors.icon, textDecorationLine: 'underline' }]} onPress={() => {
          if (href) {
            Linking.openURL(href);
          }
        }}>
          {children}
        </Text>
      );
    },
  };

  // Component to render Hive post previews
  const HivePostPreviewRenderer: React.FC<{ postUrls: string[] }> = React.memo(({ postUrls }) => {
    return <ContextHivePostPreviewRenderer text={postUrls.join(' ')} colors={colors} />;
  });

  // Recursive threaded reply renderer (simplified)
  const renderReplyTree = (reply: ReplyData, level = 0) => {
    const videoInfo = extractVideoInfo(reply.body);
    const imageUrls = extractImageUrls(reply.body);
    const hivePostUrls = extractHivePostUrls(reply.body);
    
    let textBody = reply.body;
    if (videoInfo || hivePostUrls.length > 0) {
      textBody = removeEmbedUrls(textBody);
    }
    textBody = stripImageTags(textBody);
    
    // Process spoiler syntax
    const spoilerData = convertSpoilerSyntax(textBody);
    textBody = spoilerData.processedText;
    
    textBody = preserveParagraphSpacing(textBody);
    textBody = linkifyUrls(textBody);
    textBody = linkifyMentions(textBody);
    textBody = linkifyHashtags(textBody);
    
    const windowWidth = Dimensions.get('window').width;
    const isHtml = containsHtml(textBody);
    const maxVisualLevel = 3;
    const visualLevel = Math.min(level, maxVisualLevel);
    
    return (
      <View key={reply.author + reply.permlink + '-' + level} style={{ marginLeft: visualLevel * 18, marginBottom: 10 }}>
        <View style={[ConversationScreenStyles.replyBubble, { backgroundColor: colors.bubble }]}> 
          {/* Avatar, author, timestamp row */}
          <View style={ConversationScreenStyles.authorRow}>
            <Pressable
              onPress={() => router.push(`/ProfileScreen?username=${reply.author}` as any)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center' }]}
              accessibilityRole="button"
              accessibilityLabel={`View ${reply.author}'s profile`}
            >
              {reply.avatarUrl ? (
                <ExpoImage
                  source={reply.avatarUrl ? { uri: reply.avatarUrl } : genericAvatar}
                  style={ConversationScreenStyles.avatar}
                  contentFit="cover"
                  onError={() => {}}
                />
              ) : (
                <ExpoImage
                  source={genericAvatar}
                  style={ConversationScreenStyles.avatar}
                  contentFit="cover"
                />
              )}
              <Text style={[ConversationScreenStyles.replyAuthor, { color: colors.text, marginLeft: 10 }]}>{reply.author}</Text>
              <Text style={[ConversationScreenStyles.snapTimestamp, { color: colors.text }]}>{reply.created ? new Date(reply.created + 'Z').toLocaleString() : ''}</Text>
            </Pressable>
          </View>
          
          {/* Images */}
          {imageUrls.length > 0 && (
            <View style={ConversationScreenStyles.imageContainer}>
              {imageUrls.map((url, idx) => (
                <Pressable key={url + idx} onPress={() => handleImagePress(url)}>
                  <ExpoImage
                    source={{ uri: url }}
                    style={ConversationScreenStyles.imageStyle}
                    contentFit="cover"
                  />
                </Pressable>
              ))}
            </View>
          )}
          
          {/* Hive Post Previews */}
          <HivePostPreviewRenderer postUrls={hivePostUrls} />
          
          {/* Spoiler Components */}
          {spoilerData.spoilers.map((spoiler: SpoilerData, index: number) => (
            <SpoilerText key={`reply-spoiler-${index}`} buttonText={spoiler.buttonText}>
              {spoiler.content}
            </SpoilerText>
          ))}
          
          {/* Text Content */}
          {textBody.trim().length > 0 && (
            <View style={{ marginTop: (videoInfo || imageUrls.length > 0 || hivePostUrls.length > 0) ? 8 : 0 }}>
              {isHtml ? (
                <RenderHtml
                  contentWidth={windowWidth - (visualLevel * 18) - 32}
                  source={{ html: textBody }}
                  baseStyle={{ color: colors.text, fontSize: 14, marginBottom: 4, lineHeight: 20 }}
                  enableExperimentalMarginCollapsing
                  tagsStyles={{ 
                    a: { color: colors.icon },
                    p: { marginBottom: 12, lineHeight: 20 }
                  }}
                />
              ) : (
                <Markdown
                  style={{
                    body: { color: colors.text, fontSize: 14, marginBottom: 4 },
                    paragraph: { color: colors.text, fontSize: 14, marginBottom: 12, lineHeight: 20 },
                    link: { color: colors.icon },
                  }}
                  rules={markdownRules}
                >
                  {textBody}
                </Markdown>
              )}
            </View>
          )}
          
          <View style={ConversationScreenStyles.replyMeta}>
            <TouchableOpacity
              style={[ConversationScreenStyles.replyButton, ConversationScreenStyles.upvoteButton]}
              onPress={() => handleUpvotePress({ author: reply.author, permlink: reply.permlink! })}
              disabled={Array.isArray(reply.active_votes) && reply.active_votes.some((v: any) => v.voter === currentUsername && v.percent > 0)}
            >
              <FontAwesome name="arrow-up" size={16} color={Array.isArray(reply.active_votes) && reply.active_votes.some((v: any) => v.voter === currentUsername && v.percent > 0) ? '#8e44ad' : colors.icon} />
            </TouchableOpacity>
            <Text style={[ConversationScreenStyles.replyMetaText, { color: colors.text }]}>{reply.voteCount || 0}</Text>
            <FontAwesome name="comment-o" size={16} color={colors.icon} style={{ marginLeft: 12 }} />
            <Text style={[ConversationScreenStyles.replyMetaText, { color: colors.payout, marginLeft: 12 }]}>{reply.payout !== undefined ? `$${reply.payout.toFixed(2)}` : ''}</Text>
            <View style={{ flex: 1 }} />
            
            {/* Edit button - only show for own replies */}
            {reply.author === currentUsername && (
              <TouchableOpacity 
                style={ConversationScreenStyles.replyButton} 
                onPress={() => handleOpenEditModal({ 
                  author: reply.author, 
                  permlink: reply.permlink!, 
                  body: reply.body 
                }, 'reply')}
              >
                <FontAwesome name="edit" size={14} color={colors.icon} />
                <Text style={[ConversationScreenStyles.replyButtonText, { color: colors.icon, fontSize: 12 }]}>Edit</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={ConversationScreenStyles.replyButton} onPress={() => handleOpenReplyModal(reply.author, reply.permlink!)}>
              <FontAwesome name="reply" size={16} color={colors.icon} />
              <Text style={[ConversationScreenStyles.replyButtonText, { color: colors.icon }]}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Render children recursively */}
        {reply.replies && reply.replies.length > 0 && reply.replies.map((child, idx) => renderReplyTree(child, level + 1))}
      </View>
    );
  };

  // Render the snap as a header for the replies list (simplified)
  const renderSnapHeader = () => {
    if (!snap) return null;
    
    const videoInfo = extractVideoInfo(snap.body);
    const imageUrls = extractImageUrls(snap.body);
    const hivePostUrls = extractHivePostUrls(snap.body);
    
    let textBody = snap.body;
    if (videoInfo || hivePostUrls.length > 0) {
      textBody = removeEmbedUrls(textBody);
    }
    textBody = stripImageTags(textBody);
    
    // Process spoiler syntax
    const spoilerData = convertSpoilerSyntax(textBody);
    textBody = spoilerData.processedText;
    
    textBody = preserveParagraphSpacing(textBody);
    textBody = linkifyUrls(textBody);
    textBody = linkifyMentions(textBody);
    textBody = linkifyHashtags(textBody);
    
    const windowWidth = Dimensions.get('window').width;
    const isHtml = containsHtml(textBody);
    
    return (
      <View style={[ConversationScreenStyles.snapPost, { borderColor: colors.border, backgroundColor: colors.background }]}> 
        <View style={ConversationScreenStyles.authorRow}>
          <Pressable
            onPress={() => router.push(`/ProfileScreen?username=${snap.author}` as any)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center' }]}
            accessibilityRole="button"
            accessibilityLabel={`View ${snap.author}'s profile`}
          >
            {snap.avatarUrl ? (
              <ExpoImage
                source={snap.avatarUrl ? { uri: snap.avatarUrl } : genericAvatar}
                style={ConversationScreenStyles.avatar}
                contentFit="cover"
                onError={() => {}}
              />
            ) : (
              <ExpoImage
                source={genericAvatar}
                style={ConversationScreenStyles.avatar}
                contentFit="cover"
              />
            )}
            <Text style={[ConversationScreenStyles.snapAuthor, { color: colors.text, marginLeft: 10 }]}>{snap.author}</Text>
            <Text style={[ConversationScreenStyles.snapTimestamp, { color: colors.text }]}>{snap.created ? new Date(snap.created + 'Z').toLocaleString() : ''}</Text>
          </Pressable>
        </View>
        
        {/* Images */}
        {imageUrls.length > 0 && (
          <View style={ConversationScreenStyles.imageContainer}>
            {imageUrls.map((url, idx) => (
              <Pressable key={url + idx} onPress={() => handleImagePress(url)}>
                <ExpoImage
                  source={{ uri: url }}
                  style={ConversationScreenStyles.imageStyle}
                  contentFit="cover"
                />
              </Pressable>
            ))}
          </View>
        )}
        
        {/* Hive Post Previews */}
        <HivePostPreviewRenderer postUrls={hivePostUrls} />
        
        {/* Spoiler Components */}
        {spoilerData.spoilers.map((spoiler: SpoilerData, index: number) => (
          <SpoilerText key={`spoiler-${index}`} buttonText={spoiler.buttonText}>
            {spoiler.content}
          </SpoilerText>
        ))}
        
        {/* Text Content */}
        {textBody.trim().length > 0 && (
          <View style={{ marginTop: (videoInfo || imageUrls.length > 0 || hivePostUrls.length > 0) ? 8 : 0 }}>
            {isHtml ? (
              <RenderHtml
                contentWidth={windowWidth - 32}
                source={{ html: textBody }}
                baseStyle={{ color: colors.text, fontSize: 15, marginBottom: 8, lineHeight: 22 }}
                enableExperimentalMarginCollapsing
                tagsStyles={{ 
                  a: { color: colors.icon },
                  p: { marginBottom: 16, lineHeight: 22 }
                }}
              />
            ) : (
              <Markdown
                style={{
                  body: { color: colors.text, fontSize: 15, marginBottom: 8 },
                  paragraph: { color: colors.text, fontSize: 15, marginBottom: 16, lineHeight: 22 },
                  link: { color: colors.icon },
                }}
                rules={markdownRules}
              >
                {textBody}
              </Markdown>
            )}
          </View>
        )}
        
        <View style={[ConversationScreenStyles.snapMeta, { alignItems: 'center' }]}> 
          <TouchableOpacity
            style={[ConversationScreenStyles.replyButton, ConversationScreenStyles.upvoteButton]}
            onPress={() => handleUpvotePress({ author: snap.author, permlink: snap.permlink! })}
            disabled={Array.isArray(snap.active_votes) && snap.active_votes.some((v: any) => v.voter === currentUsername && v.percent > 0)}
          >
            <FontAwesome name="arrow-up" size={18} color={Array.isArray(snap.active_votes) && snap.active_votes.some((v: any) => v.voter === currentUsername && v.percent > 0) ? '#8e44ad' : colors.icon} />
          </TouchableOpacity>
          <Text style={[ConversationScreenStyles.snapMetaText, { color: colors.text }]}>{snap.voteCount || 0}</Text>
          <FontAwesome name="comment-o" size={18} color={colors.icon} style={{ marginLeft: 12 }} />
          <Text style={[ConversationScreenStyles.snapMetaText, { color: colors.text }]}>{snap.replyCount || 0}</Text>
          <Text style={[ConversationScreenStyles.snapMetaText, { color: colors.payout, marginLeft: 12 }]}>{snap.payout ? `$${snap.payout.toFixed(2)}` : ''}</Text>
          <View style={{ flex: 1 }} />
          
          {/* Edit button - only show for own content */}
          {snap.author === currentUsername && (
            <TouchableOpacity style={ConversationScreenStyles.replyButton} onPress={() => handleOpenEditModal(undefined, 'snap')}>
              <FontAwesome name="edit" size={16} color={colors.icon} />
              <Text style={[ConversationScreenStyles.replyButtonText, { color: colors.icon }]}>Edit</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={ConversationScreenStyles.replyButton} onPress={() => handleOpenReplyModal(snap.author, snap.permlink!)}>
            <FontAwesome name="reply" size={18} color={colors.icon} />
            <Text style={[ConversationScreenStyles.replyButtonText, { color: colors.icon }]}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaViewSA style={[ConversationScreenStyles.safeArea, { backgroundColor: isDark ? '#15202B' : '#fff' }]}> 
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        enabled
      >
        {/* Image Modal */}
        <ImageView
          images={modalImages}
          imageIndex={modalImageIndex}
          visible={imageModalVisible}
          onRequestClose={() => setImageModalVisible(false)}
          backgroundColor="rgba(0, 0, 0, 0.95)"
          swipeToCloseEnabled={true}
          doubleTapToZoomEnabled={true}
          presentationStyle="fullScreen"
          HeaderComponent={() => (
            <TouchableOpacity
              style={ConversationScreenStyles.modalHeader}
              onPress={() => setImageModalVisible(false)}
              accessibilityLabel="Close image"
            >
              <FontAwesome name="close" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        />
        
        {/* Header with back arrow */}
        <View style={[ConversationScreenStyles.header, { borderBottomColor: colors.border }]}>
          <View style={ConversationScreenStyles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()}>
              <FontAwesome name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          {/* Parent snap navigation - only show if not a top-level snap */}
          {!isTopLevelSnap() && (
            <View style={ConversationScreenStyles.headerRight}>
              <TouchableOpacity 
                onPress={handleGoToParentSnap} 
                style={ConversationScreenStyles.parentButton}
                accessibilityLabel="Go to parent snap"
              >
                <Text style={[ConversationScreenStyles.parentButtonText, { color: colors.text }]}>Parent Snap</Text>
                <FontAwesome name="arrow-up" size={16} color={colors.text} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Conversation list */}
        {loading ? (
          <View style={ConversationScreenStyles.loadingContainer}>
            <FontAwesome name="hourglass-half" size={48} color={colors.icon} style={{ marginBottom: 12 }} />
            <Text style={[ConversationScreenStyles.loadingText, { color: colors.text }]}>Loading conversation...</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
            {/* Blockchain Processing Indicator */}
            {(replyProcessing || editProcessing) && (
              <View style={{
                backgroundColor: colors.bubble,
                margin: 16,
                padding: 12,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                borderLeftWidth: 4,
                borderLeftColor: colors.icon,
              }}>
                <FontAwesome name="cog" size={16} color={colors.icon} style={{ marginRight: 8 }} />
                <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>
                  {replyProcessing ? 'Checking for new reply...' : 'Checking for updated content...'}
                </Text>
                <ActivityIndicator size="small" color={colors.icon} />
              </View>
            )}
            
            {renderSnapHeader()}
            <View style={ConversationScreenStyles.repliesList}>
              {replies.map(reply => renderReplyTree(reply))}
            </View>
          </ScrollView>
        )}

        {/* Modals would go here - simplified for brevity */}
        {/* Upvote Modal, Reply Modal, Edit Modal, GIF Picker Modal */}
        
        {/* Reply Modal */}
        <Modal
          isVisible={replyModalVisible}
          onBackdropPress={posting ? undefined : closeReplyModal}
          onBackButtonPress={posting ? undefined : closeReplyModal}
          style={{
            justifyContent: 'flex-end',
            margin: 0,
            ...(Platform.OS === 'ios' && {
              paddingBottom: insets.bottom,
            })
          }}
          useNativeDriver
          avoidKeyboard={true}
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

            {/* Reply GIF preview */}
            {replyGif ? (
              <View style={{ marginBottom: 10 }}>
                <ExpoImage source={{ uri: replyGif }} style={{ width: 120, height: 120, borderRadius: 10 }} contentFit="cover" />
                <TouchableOpacity onPress={() => setReplyGif(null)} style={{ position: 'absolute', top: 4, right: 4 }} disabled={posting}>
                  <FontAwesome name="close" size={20} color={colors.icon} />
                </TouchableOpacity>
                <View style={{ position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>GIF</Text>
                </View>
              </View>
            ) : null}
            
            {/* Error message */}
            {replyError ? (
              <Text style={{ color: 'red', marginBottom: 8 }}>{replyError}</Text>
            ) : null}
            
            {/* Reply input row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <TouchableOpacity onPress={() => addReplyImage('reply')} disabled={uploading || posting || replyProcessing} style={{ marginRight: 16 }}>
                <FontAwesome name="image" size={22} color={colors.icon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleOpenGifPicker('reply')} disabled={uploading || posting || replyProcessing} style={{ marginRight: 16 }}>
                <Text style={{ fontSize: 18, color: colors.icon }}>GIF</Text>
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
                onPress={submitReply}
                disabled={uploading || posting || replyProcessing || (!replyText.trim() && !replyImage && !replyGif) || !currentUsername}
                style={{
                  backgroundColor: colors.icon,
                  borderRadius: 20,
                  paddingHorizontal: 18,
                  paddingVertical: 8,
                  opacity: uploading || posting || replyProcessing || (!replyText.trim() && !replyImage && !replyGif) || !currentUsername ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>
                  {posting ? 'Posting...' : replyProcessing ? 'Checking...' : 'Send'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isVisible={editModalVisible}
          onBackdropPress={editing ? undefined : closeEditModal}
          onBackButtonPress={editing ? undefined : closeEditModal}
          style={{ justifyContent: 'flex-end', margin: 0 }}
          useNativeDriver
          avoidKeyboard={true}
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

            {/* Edit GIF preview */}
            {editGif ? (
              <View style={{ marginBottom: 10 }}>
                <ExpoImage source={{ uri: editGif }} style={{ width: 120, height: 120, borderRadius: 10 }} contentFit="cover" />
                <TouchableOpacity onPress={() => setEditGif(null)} style={{ position: 'absolute', top: 4, right: 4 }} disabled={editing}>
                  <FontAwesome name="close" size={20} color={colors.icon} />
                </TouchableOpacity>
                <View style={{ position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>GIF</Text>
                </View>
              </View>
            ) : null}
            
            {/* Error message */}
            {editError ? (
              <Text style={{ color: 'red', marginBottom: 8 }}>{editError}</Text>
            ) : null}
            
            {/* Edit input row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <TouchableOpacity onPress={() => addEditImage('edit')} disabled={editUploading || editing || editProcessing} style={{ marginRight: 16 }}>
                <FontAwesome name="image" size={22} color={colors.icon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleOpenGifPicker('edit')} disabled={editUploading || editing || editProcessing} style={{ marginRight: 16 }}>
                <Text style={{ fontSize: 18, color: colors.icon }}>GIF</Text>
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
                onPress={submitEdit}
                disabled={editUploading || editing || editProcessing || (!editText.trim() && !editImage && !editGif) || !currentUsername}
                style={{
                  backgroundColor: colors.icon,
                  borderRadius: 20,
                  paddingHorizontal: 18,
                  paddingVertical: 8,
                  opacity: editUploading || editing || editProcessing || (!editText.trim() && !editImage && !editGif) || !currentUsername ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>
                  {editing ? 'Saving...' : editProcessing ? 'Checking...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Upvote Modal */}
        <Modal
          isVisible={upvoteModalVisible}
          onBackdropPress={closeUpvoteModal}
          onBackButtonPress={closeUpvoteModal}
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
                  onPress={closeUpvoteModal}
                  disabled={upvoteLoading}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={{ flex: 1, marginLeft: 8, backgroundColor: colors.icon, borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={confirmUpvote}
                  disabled={upvoteLoading}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Confirm</Text>
                </Pressable>
              </View>
            )}
          </View>
        </Modal>

        {/* GIF Picker Modal */}
        <Modal
          isVisible={gifModalVisible}
          onBackdropPress={closeGifModal}
          onBackButtonPress={closeGifModal}
          style={{ justifyContent: 'flex-start', margin: 0 }}
          useNativeDriver
        >
          <View style={{ flex: 1, backgroundColor: isDark ? '#15202B' : '#fff' }}>
            {/* Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: colors.text,
              }}>
                Choose a GIF
              </Text>
              <Pressable
                onPress={closeGifModal}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  padding: 4,
                })}
              >
                <FontAwesome name="times" size={24} color={colors.text} />
              </Pressable>
            </View>

            {/* Search Bar */}
            <View style={{
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.bubble,
                borderRadius: 25,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}>
                <FontAwesome name="search" size={16} color={colors.text} style={{ marginRight: 12 }} />
                <TextInput
                  placeholder="Search GIFs..."
                  placeholderTextColor={colors.text + '80'}
                  value={gifSearchQuery}
                  onChangeText={setGifSearchQuery}
                  onSubmitEditing={() => searchGifs(gifSearchQuery)}
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: colors.text,
                  }}
                  returnKeyType="search"
                />
                {gifSearchQuery.length > 0 && (
                  <Pressable
                    onPress={() => {
                      setGifSearchQuery('');
                      searchGifs('');
                    }}
                    style={{ marginLeft: 8 }}
                  >
                    <FontAwesome name="times-circle" size={16} color={colors.text + '60'} />
                  </Pressable>
                )}
              </View>
            </View>

            {/* GIF Grid */}
            <View style={{ flex: 1, padding: 16 }}>
              {gifLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={colors.icon} />
                  <Text style={{ color: colors.text, marginTop: 12, fontSize: 16 }}>
                    {gifSearchQuery.trim() ? 'Searching GIFs...' : 'Loading...'}
                  </Text>
                </View>
              ) : gifResults.length > 0 ? (
                <FlatList
                  data={gifResults}
                  renderItem={({ item, index }) => {
                    const { getBestGifUrl, getGifPreviewUrl } = require('../utils/tenorApi');
                    const gifUrl = getBestGifUrl(item);
                    const previewUrl = getGifPreviewUrl(item);
                    
                    return (
                      <Pressable
                        onPress={() => handleSelectGif(gifUrl)}
                        style={({ pressed }) => [
                          {
                            flex: 1,
                            margin: 2,
                            borderRadius: 8,
                            overflow: 'hidden',
                            aspectRatio: 1,
                            opacity: pressed ? 0.7 : 1,
                          }
                        ]}
                      >
                        <Image
                          source={{ uri: previewUrl || gifUrl }}
                          style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: isDark ? '#333' : '#f0f0f0',
                          }}
                          resizeMode="cover"
                        />
                      </Pressable>
                    );
                  }}
                  keyExtractor={(item) => item.id}
                  numColumns={3}
                  columnWrapperStyle={{ justifyContent: 'space-between' }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 20 }}
                />
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ 
                    fontSize: 48,
                    marginBottom: 16,
                  }}>
                    🎭
                  </Text>
                  <Text style={{ 
                    color: colors.text, 
                    fontSize: 18, 
                    textAlign: 'center',
                    fontWeight: '600',
                    marginBottom: 8,
                  }}>
                    {gifSearchQuery.trim() 
                      ? `No GIFs found for "${gifSearchQuery}"` 
                      : 'Search for the perfect GIF'
                    }
                  </Text>
                  <Text style={{ 
                    color: colors.text, 
                    fontSize: 14, 
                    textAlign: 'center',
                    opacity: 0.7,
                    marginTop: 4,
                  }}>
                    {gifSearchQuery.trim() 
                      ? 'Try a different search term'
                      : 'Type something in the search bar above'
                    }
                  </Text>
                </View>
              )}
            </View>

            {/* Powered by Tenor */}
            <View style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              alignItems: 'center',
            }}>
              <Text style={{
                fontSize: 12,
                color: colors.text + '60',
                fontStyle: 'italic',
              }}>
                Powered by Tenor
              </Text>
            </View>
          </View>
        </Modal>
        
      </KeyboardAvoidingView>
    </SafeAreaViewSA>
  );
};

export default ConversationScreenRefactored;

export const options = { headerShown: false }; 