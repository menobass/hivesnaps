import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  useColorScheme,
  Linking,
  Pressable,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { extractImageUrls } from '../../utils/extractImageUrls';
import { stripImageTags } from '../../utils/stripImageTags';
import { extractVideoInfo, removeVideoUrls } from '../../utils/extractVideoInfo';
import IPFSVideoPlayer from './IPFSVideoPlayer';
import { WebView } from 'react-native-webview';
import Markdown from 'react-native-markdown-display';
import RenderHtml from 'react-native-render-html';
import { Video, ResizeMode } from 'expo-av';
import {
  convertSpoilerSyntax,
  type SpoilerData,
} from '../../utils/spoilerParser';
import SpoilerText from './SpoilerText';
import TwitterEmbed from './TwitterEmbed';
import YouTubeEmbed from './YouTubeEmbed';
import ThreeSpeakEmbed from './ThreeSpeakEmbed';
import { extractHivePostUrls } from '../../utils/extractHivePostInfo';
import { OptimizedHivePostPreviewRenderer } from '../../components/OptimizedHivePostPreviewRenderer';
import { classifyUrl } from '../../utils/urlClassifier';
import { canBeResnapped } from '../../utils/postTypeDetector';
import { getMarkdownStyles } from '../../styles/markdownStyles';
import { linkStyles, useLinkTextStyle } from '../../styles/linkStyles';

const twitterColors = {
  light: {
    background: '#FFFFFF',
    text: '#0F1419',
    bubble: '#F7F9F9',
    border: '#CFD9DE',
    icon: '#1DA1F2',
    payout: '#17BF63',
  },
  dark: {
    background: '#15202B',
    text: '#D7DBDC',
    bubble: '#22303C',
    border: '#38444D',
    icon: '#1DA1F2',
    payout: '#17BF63',
  },
};

interface SnapProps {
  author: string;
  avatarUrl?: string;
  body: string;
  created: string;
  voteCount?: number;
  replyCount?: number;
  payout?: number;
  onUpvotePress?: (snap: { author: string; permlink: string }) => void;
  permlink?: string;
  hasUpvoted?: boolean;
  onSpeechBubblePress?: () => void; // NEW: handler for speech bubble
  onUserPress?: (username: string) => void; // NEW: handler for username/avatar press
  onContentPress?: () => void; // NEW: handler for content/text press
  onImagePress?: (imageUrl: string) => void; // NEW: handler for image press
  showAuthor?: boolean; // Optional: show author info in Snap bubble
  onHashtagPress?: (hashtag: string) => void; // Optional: handle hashtag press
  onReplyPress?: (author: string, permlink: string) => void; // NEW: handler for reply button
  onEditPress?: (snap: {
    author: string;
    permlink: string;
    body: string;
  }) => void; // NEW: handler for edit button
  onResnapPress?: (author: string, permlink: string) => void; // NEW: handler for resnap button
  currentUsername?: string | null; // NEW: current user to check if they can edit
  posting?: boolean; // To disable buttons during reply posting
  editing?: boolean; // To disable buttons during edit submission
  // Reply-specific props
  visualLevel?: number; // For reply indentation
  isReply?: boolean; // To enable reply-specific styling and behavior
  compactMode?: boolean; // For more compact button layout
}

// Utility to extract raw image URLs from text (not in markdown or html)
function extractRawImageUrls(text: string): string[] {
  // Match URLs ending with image extensions, not inside markdown or html tags
  const regex =
    /(?:^|\s)(https?:\/\/(?:[\w.-]+)\/(?:[\w\-./%]+)\.(?:jpg|jpeg|png|gif|webp|bmp|svg))(?:\s|$)/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

// Utility to remove raw image URLs from text
function removeRawImageUrls(text: string): string {
  const replaced = text.replace(
    /(?:^|\s)(https?:\/\/(?:[\w.-]+)\/(?:[\w\-./%]+)\.(?:jpg|jpeg|png|gif|webp|bmp|svg))(?:\s|$)/gi,
    ' '
  );
  // Collapse only horizontal spaces within each line; preserve blank lines & newlines
  return replaced
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.replace(/[ \t]{2,}/g, ' ').replace(/ +$/,''))
    .join('\n');
}

const removeYouTubeUrl = (text: string): string => {
  // Remove all YouTube links (youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, etc.)
  const removed = text.replace(
    /(?:https?:\/\/(?:www\.)?)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[\w-]{11}(\S*)?/gi,
    ''
  );
  return removed
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.replace(/[ \t]{2,}/g, ' ').replace(/ +$/,''))
    .join('\n');
};

// Utility to check if a string contains HTML tags
function containsHtml(str: string): boolean {
  return /<([a-z][\s\S]*?)>/i.test(str);
}

// Utility: Preprocess @username mentions to clickable profile links
function linkifyMentions(text: string): string {
  // Only match @username if not preceded by a '/' or inside a markdown link
  // Negative lookbehind for '/': (?<!/)
  // Hive usernames: 3-16 chars, a-z, 0-9, dash, dot (no @ in username)
  // Avoid emails and already-linked mentions
  return text.replace(
    /(^|[^\w/@])@([a-z0-9\-\.]{3,16})(?![a-z0-9\-\.])/gi,
    (match, pre, username, offset, string) => {
      // Don't process if we're inside a markdown link [text](url)
      const beforeMatch = string.substring(0, offset);
      const afterMatch = string.substring(offset + match.length);

      // Check if we're inside a markdown link by looking for unmatched brackets
      const openBrackets = (beforeMatch.match(/\[/g) || []).length;
      const closeBrackets = (beforeMatch.match(/\]/g) || []).length;
      const isInsideMarkdownLink =
        openBrackets > closeBrackets && afterMatch.includes('](');

      if (isInsideMarkdownLink) {
        return match; // Don't modify if inside a markdown link
      }

      return `${pre}[**@${username}**](profile://${username})`;
    }
  );
}

// Utility: Preprocess raw URLs to clickable markdown links (if not already linked)
function linkifyUrls(text: string): string {
  // Use our URL classifier to determine how to handle each URL
  return text.replace(/(https?:\/\/[\w.-]+(?:\/[\w\-./?%&=+#@]*)?)/gi, url => {
    // If already inside a markdown or html link, skip
    if (/\]\([^)]+\)$/.test(url) || /href=/.test(url)) return url;

    // Classify the URL using our utility
    const urlInfo = classifyUrl(url);

    // For now, only create markdown links for normal URLs
    // Hive posts and embedded media will be handled by their respective renderers
    if (urlInfo.type === 'normal') {
      return `[${urlInfo.displayText || url}](${url})`;
    }

    // For all other types (hive_post, embedded_media, invalid), return as-is
    // This allows the existing renderers to handle them properly
    return url;
  });
}

// Helper: Render mp4 video using expo-av Video
const renderMp4Video = (uri: string, key?: string | number) => (
  <View
    key={key || uri}
    style={{
      width: '100%',
      aspectRatio: 16 / 9,
      marginVertical: 10,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#eee',
    }}
  >
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

// Custom markdown rules for mp4 and video support

const Snap: React.FC<SnapProps> = ({
  author,
  avatarUrl,
  body,
  created,
  voteCount = 0,
  replyCount = 0,
  payout = 0,
  onUpvotePress,
  permlink,
  hasUpvoted = false,
  onSpeechBubblePress,
  onUserPress,
  onContentPress,
  onImagePress,
  showAuthor = false,
  onHashtagPress,
  onReplyPress,
  onEditPress,
  onResnapPress,
  currentUsername,
  posting = false, // Default to false
  editing = false, // Default to false
  // Reply-specific props
  visualLevel = 0,
  isReply = false,
  compactMode = false,
}) => {
  // Process hashtags in text, converting them to clickable markdown links
  function processHashtags(text: string): string {
    return text.replace(/(#\w+)/g, (match, hashtag) => {
      const tag = hashtag.replace('#', '');
      return `[${hashtag}](hashtag://${tag})`;
    });
  }
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const colors = twitterColors[colorScheme];
  const upvoteColor = hasUpvoted ? '#8e44ad' : colors.icon; // purple if upvoted
  const imageUrls = extractImageUrls(body);
  const rawImageUrls = extractRawImageUrls(body);
  const embeddedContent = extractVideoInfo(body); // Renamed from videoInfo to be more accurate
  const hivePostUrls = extractHivePostUrls(body); // Extract Hive post URLs for previews
  const router = useRouter(); // For navigation in reply mode

  // Centralized link text style (color, size, lineHeight) from styles/linkStyles
  const linkTextStyle = useLinkTextStyle(colors.icon, isReply);

  // Calculate indentation for replies
  const maxVisualLevel = 2;
  const effectiveVisualLevel = isReply ? Math.min(visualLevel, maxVisualLevel) : 0;
  const marginLeft = effectiveVisualLevel * 18;
  const windowWidth = Dimensions.get('window').width;
  const contentWidth = isReply ? Math.max(windowWidth - marginLeft - 32, 200) : windowWidth - 32;

  // Custom markdown rules (defined inside component to access isReply and router)
  const markdownRules = {
    image: (node: any, children: any, parent: any, styles: any) => {
      const { src, alt } = node.attributes;

      // Only process actual image URLs, ignore hashtag/profile links
      if (!src || src.startsWith('hashtag://') || src.startsWith('profile://')) {
        return null;
      }

      // Check if it's actually an image URL
      const isImageUrl =
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(src) ||
        src.startsWith('data:image/') ||
        src.includes('image');

      if (!isImageUrl) {
        return null;
      }

      const uniqueKey = `${src || alt}-${Math.random().toString(36).substr(2, 9)}`;
      return (
        <Pressable
          key={uniqueKey}
          onPress={() => {
            if (onImagePress) {
              onImagePress(src);
            } else {
              // Fallback to local modal preview instead of global handler
              setModalImageUrl(src);
              setModalVisible(true);
            }
          }}
        >
          <Image
            source={{ uri: src }}
            style={{
              width: '100%',
              aspectRatio: 1.2,
              maxHeight: 340,
              borderRadius: 14,
              marginVertical: 10,
              alignSelf: 'center',
              backgroundColor: '#eee',
            }}
            resizeMode='cover'
            accessibilityLabel={alt || 'image'}
          />
        </Pressable>
      );
    },
    link: (node: any, children: any, parent: any, styles: any) => {
      let { href } = node.attributes;

      // Safety check: if href contains markdown syntax, extract the actual URL
      if (href && (href.includes('%5B') || href.includes('['))) {
        let textToProcess = href;

        // If URL is encoded, decode it first
        if (href.includes('%5B')) {
          textToProcess = decodeURIComponent(href);
        }

        // Extract URL from markdown link syntax [text](url)
        const markdownMatch = textToProcess.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (markdownMatch) {
          href = markdownMatch[2]; // Extract the URL part
        }
      }
      const mp4Match = href && href.match(/\.mp4($|\?)/i);
      if (mp4Match) {
        return renderMp4Video(href, href);
      }
      // Handle profile:// links for mentions
      if (href && href.startsWith('profile://')) {
        const username = href.replace('profile://', '');
        const uniqueKey = `${href}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <Text
            key={uniqueKey}
            onPress={() => {
              if (isReply) {
                router.push(`/ProfileScreen?username=${username}` as any);
              } else {
                onUserPress && onUserPress(username);
              }
            }}
            accessibilityRole='link'
            accessibilityLabel={`View @${username}'s profile`}
            style={[linkStyles.base, linkStyles.mention, linkTextStyle]}
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
            onPress={() => {
              if (isReply) {
                router.push({ pathname: '/DiscoveryScreen', params: { hashtag: tag } } as any);
              } else {
                onHashtagPress && onHashtagPress(tag);
              }
            }}
            accessibilityRole='link'
            accessibilityLabel={`View #${tag} hashtag`}
            style={[linkStyles.base, linkStyles.hashtag, linkTextStyle]}
          >
            {children}
          </Text>
        );
      }
      // Default: open external link
      const uniqueKey = href
        ? `${href}-${Math.random().toString(36).substr(2, 9)}`
        : Math.random().toString(36).substr(2, 9);
      return (
        <Text
          key={uniqueKey}
          style={[linkStyles.base, linkStyles.external, linkTextStyle]}
          onPress={() => {
            if (href) {
              try {
                const urlToOpen =
                  href.startsWith('http://') || href.startsWith('https://')
                    ? href
                    : `https://${href}`;
                const urlObj = new URL(urlToOpen);
                if (!urlObj.hostname || !urlObj.hostname.includes('.')) {
                  throw new Error('Invalid domain');
                }
                Linking.openURL(urlToOpen).catch(error => {
                  console.error('Error opening URL:', urlToOpen, error);
                });
              } catch (error) {
                console.error('Invalid URL:', href, error);
              }
            }
          }}
        >
          {children}
        </Text>
      );
    },
    html: (node: any, children: any, parent: any, styles: any) => {
      const htmlContent = node.content || '';

      // Handle <video> tags for mp4
      const videoTagMatch = htmlContent.match(
        /<video[^>]*src=["']([^"']+\.mp4)["'][^>]*>(.*?)<\/video>/i
      );
      if (videoTagMatch) {
        const mp4Url = videoTagMatch[1];
        return renderMp4Video(mp4Url, mp4Url);
      }

      // Handle 3Speak iframe embeds
      const threeSpeakIframeMatch = htmlContent.match(
        /<iframe[^>]+src=["']https:\/\/3speak\.tv\/embed\?v=([^\/\s"']+)\/([a-zA-Z0-9_-]+)["'][^>]*>/i
      );
      if (threeSpeakIframeMatch) {
        const username = threeSpeakIframeMatch[1];
        const videoId = threeSpeakIframeMatch[2];
        const uniqueKey = `3speak-${username}-${videoId}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <View
            key={uniqueKey}
            style={{
              width: '100%',
              aspectRatio: 16 / 9,
              borderRadius: 12,
              overflow: 'hidden',
              position: 'relative',
              marginVertical: 10,
            }}
          >
            <WebView
              source={{
                uri: `https://3speak.tv/embed?v=${username}/${videoId}&autoplay=0`,
              }}
              style={{ flex: 1, backgroundColor: '#000' }}
              allowsFullscreenVideo
              javaScriptEnabled
              domStorageEnabled
              mediaPlaybackRequiresUserAction={true}
              allowsInlineMediaPlayback={true}
            />
            {/* Video type indicator */}
            <View
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: 'rgba(0,0,0,0.7)',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                3SPEAK
              </Text>
            </View>
          </View>
        );
      }

      // Handle IPFS iframe embeds
      const ipfsIframeMatch = htmlContent.match(
        /<iframe[^>]+src=["']([^"']*\/ipfs\/([A-Za-z0-9]+)[^"']*?)["'][^>]*>/i
      );
      if (ipfsIframeMatch) {
        const ipfsUrl = ipfsIframeMatch[1];
        const uniqueKey = `ipfs-${ipfsIframeMatch[2]}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <View key={uniqueKey} style={{ marginVertical: 10 }}>
            <IPFSVideoPlayer ipfsUrl={ipfsUrl} isDark={false} />
          </View>
        );
      }

      // Default HTML rendering (let markdown handle it)
      return null;
    },
  };

  // Remove embedded content URLs and image URLs from text body if present
  let textBody = stripImageTags(body);
  if (embeddedContent) {
    textBody = removeVideoUrls(textBody);
  }
  if (rawImageUrls.length > 0) {
    textBody = removeRawImageUrls(textBody);
  }

  // Remove Hive post URLs from text body to avoid showing raw URLs
  if (hivePostUrls.length > 0) {
    hivePostUrls.forEach(url => {
      textBody = textBody.replace(url, '').trim();
    });
    // Clean up horizontal double spaces only, preserving paragraph breaks
    textBody = textBody
      .replace(/\r\n/g,'\n')
      .split('\n')
      .map(l => l.replace(/[ \t]{2,}/g,' ').replace(/ +$/,''))
      .join('\n');
  }

  // Process spoiler syntax first, before other text processing
  const spoilerData = convertSpoilerSyntax(textBody);
  textBody = spoilerData.processedText;

  // Add: linkify URLs first, then mentions, then hashtags (order matters!)
  textBody = linkifyUrls(textBody);
  textBody = linkifyMentions(textBody);
  textBody = processHashtags(textBody);
  // Remove extraction of external links
  const cleanTextBody = textBody; // Just use the processed textBody
  const [modalVisible, setModalVisible] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

  // Remove global side-effects previously used for handlers
  // (globalThis references deleted)

  // dynamic link text handled by useLinkTextStyle

  // Map current colors to ThemeColors expected by buildMarkdownStyles
  const markdownThemeColors = {
    text: colors.text,
    button: (colors as any).button || colors.icon || '#3b82f6',
    border: colors.border,
    card: (colors as any).card || colors.background,
    icon: colors.icon,
    background: colors.background,
  };

  const markdownDisplayStyles = getMarkdownStyles(colors, isDark);

  // Where cleanTextBody is derived before rendering Markdown/HTML
  const finalRenderedBody = cleanTextBody;

  return (
    <View
      style={{
        marginLeft: marginLeft,
        marginBottom: isReply ? 10 : undefined,
      }}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: colors.bubble,
            borderColor: colors.border,
            width: '100%',
            alignSelf: 'stretch',
          },
        ]}
      >
      {/* Image Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType='fade'
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <FontAwesome name='close' size={28} color='#fff' />
            </TouchableOpacity>
            {modalImageUrl && (
              <Image
                source={{ uri: modalImageUrl }}
                style={styles.fullImage}
                resizeMode='contain'
              />
            )}
          </View>
        </View>
      </Modal>
      {/* Top row: avatar, username, timestamp (conditionally rendered) */}
      {(showAuthor || isReply) && (
        <View style={styles.topRow}>
          <Pressable
            onPress={() => onUserPress && onUserPress(author)}
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.7 : 1,
                flexDirection: 'row',
                alignItems: 'center',
              },
            ]}
            disabled={!onUserPress}
            accessibilityRole='button'
            accessibilityLabel={`View ${author}'s profile`}
          >
            <Image
              source={
                avatarUrl
                  ? { uri: avatarUrl }
                  : require('../../assets/images/generic-avatar.png')
              }
              style={styles.avatar}
            />
            <Text style={[styles.username, { color: colors.text }]}>
              {author}
            </Text>
          </Pressable>
          <Text style={[styles.timestamp, { color: colors.text }]}>
            {new Date(created + 'Z').toLocaleString()}
          </Text>
        </View>
      )}
      {/* Embedded Content (Videos, Twitter posts, etc.) */}
      {embeddedContent && (
        <View style={{ marginBottom: 8 }}>
          {embeddedContent.type === 'ipfs' ? (
            <IPFSVideoPlayer
              ipfsUrl={embeddedContent.embedUrl}
              isDark={isDark}
            />
          ) : embeddedContent.type === 'twitter' ? (
            <TwitterEmbed embedUrl={embeddedContent.embedUrl} isDark={isDark} />
          ) : embeddedContent.type === 'youtube' ? (
            <YouTubeEmbed embedUrl={embeddedContent.embedUrl} isDark={isDark} />
          ) : embeddedContent.type === '3speak' ? (
            <ThreeSpeakEmbed
              embedUrl={embeddedContent.embedUrl}
              isDark={isDark}
            />
          ) : null}
        </View>
      )}

      {/* Images from markdown/html */}
      {imageUrls.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          {imageUrls.map((url, idx) => (
            <Pressable
              key={url + idx}
              onPress={() => {
                if (onImagePress) {
                  onImagePress(url);
                } else {
                  setModalImageUrl(url);
                  setModalVisible(true);
                }
              }}
            >
              <Image
                source={{ uri: url }}
                style={{
                  width: '100%',
                  height: 200,
                  borderRadius: 12,
                  marginBottom: 6,
                  backgroundColor: '#eee',
                }}
                resizeMode='cover'
              />
            </Pressable>
          ))}
        </View>
      )}
      {/* Images from raw URLs */}
      {rawImageUrls.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          {rawImageUrls.map((url, idx) => (
            <Pressable
              key={url + idx}
              onPress={() => {
                if (onImagePress) {
                  onImagePress(url);
                } else {
                  setModalImageUrl(url);
                  setModalVisible(true);
                }
              }}
            >
              <Image
                source={{ uri: url }}
                style={{
                  width: '100%',
                  height: 200,
                  borderRadius: 12,
                  marginBottom: 6,
                  backgroundColor: '#eee',
                }}
                resizeMode='cover'
              />
            </Pressable>
          ))}
        </View>
      )}

      {/* Spoiler Components */}
      {spoilerData.spoilers.map((spoiler: SpoilerData, index: number) => (
        <SpoilerText key={`spoiler-${index}`} buttonText={spoiler.buttonText}>
          {spoiler.content}
        </SpoilerText>
      ))}

      {/* Body */}
      {cleanTextBody.length > 0 &&
        (() => {
          const windowWidth = Dimensions.get('window').width;
          const isHtml = containsHtml(cleanTextBody);
          if (onContentPress) {
            return (
              <Pressable
                onPress={onContentPress}
                style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                accessibilityRole='button'
                accessibilityLabel='View conversation'
              >
                {isHtml ? (
                  <RenderHtml
                    contentWidth={contentWidth}
                    source={{ html: cleanTextBody }}
                    baseStyle={{
                      color: colors.text,
                      fontSize: isReply ? 14 : 15,
                      marginBottom: 8,
                      lineHeight: isReply ? 20 : undefined,
                    }}
                    enableExperimentalMarginCollapsing
                    tagsStyles={{
                      a: { color: colors.icon },
                      u: { textDecorationLine: 'underline' },
                      ...(isReply && { p: { marginBottom: 12, lineHeight: 20 } }),
                    }}
                    renderers={{
                      video: (props: any) => {
                        const src = props?.tnode?.attributes?.src;
                        const TDefaultRenderer = props?.TDefaultRenderer;
                        if (src && src.endsWith('.mp4')) {
                          return renderMp4Video(src);
                        }
                        return TDefaultRenderer ? (
                          <TDefaultRenderer {...props} />
                        ) : null;
                      },
                    }}
                  />
                ) : (
                  <Markdown
                    style={markdownDisplayStyles}
                    rules={markdownRules}
                  >
                    {finalRenderedBody}
                  </Markdown>
                )}
              </Pressable>
            );
          } else {
            return isHtml ? (
              <RenderHtml
                contentWidth={contentWidth}
                source={{ html: cleanTextBody }}
                baseStyle={{
                  color: colors.text,
                  fontSize: isReply ? 14 : 15,
                  marginBottom: 8,
                  lineHeight: isReply ? 20 : undefined,
                }}
                enableExperimentalMarginCollapsing
                tagsStyles={{
                  a: { color: colors.icon },
                  u: { textDecorationLine: 'underline' },
                  ...(isReply && { p: { marginBottom: 12, lineHeight: 20 } }),
                }}
                renderers={{
                  video: (props: any) => {
                    const src = props?.tnode?.attributes?.src;
                    const TDefaultRenderer = props?.TDefaultRenderer;
                    if (src && src.endsWith('.mp4')) {
                      return renderMp4Video(src);
                    }
                    return TDefaultRenderer ? (
                      <TDefaultRenderer {...props} />
                    ) : null;
                  },
                }}
              />
            ) : (
              <Markdown
                style={markdownDisplayStyles}
                rules={markdownRules}
              >
                {finalRenderedBody}
              </Markdown>
            );
          }
        })()}
      {/* VoteReplyBar - different layouts for compact mode (replies) vs normal mode */}
      {compactMode || isReply ? (
        // Compact mode for replies
        <View style={[styles.voteBar, { marginTop: 8 }]}>
          {onUpvotePress && permlink ? (
            <Pressable
              onPress={() => onUpvotePress({ author, permlink })}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, marginRight: 4 }]}
              accessibilityRole='button'
              accessibilityLabel='Upvote this snap'
            >
              <FontAwesome
                name='arrow-up'
                size={16}
                color={upvoteColor}
              />
            </Pressable>
          ) : (
            <FontAwesome
              name='arrow-up'
              size={16}
              color={upvoteColor}
              style={{ marginRight: 4 }}
            />
          )}
          <Text style={[styles.voteCount, { color: colors.text, fontSize: 14 }]}>
            {voteCount}
          </Text>
          
          <FontAwesome
            name='comment-o'
            size={16}
            color={colors.icon}
            style={{ marginLeft: 12, marginRight: 4 }}
          />
          <Text style={[styles.replyCount, { color: colors.text, fontSize: 14 }]}>
            {replyCount}
          </Text>
          
          <Text style={[styles.payout, { color: colors.payout, marginLeft: 12, fontSize: 14 }]}>
            ${payout.toFixed(2)}
          </Text>
          
          <View style={{ flex: 1 }} />
          
          {/* Edit button - only show for own snaps */}
          {onEditPress && permlink && author === currentUsername && (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginLeft: 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                backgroundColor: 'transparent',
                opacity: posting || editing ? 0.5 : 1,
              }}
              onPress={() => onEditPress({ author, permlink, body })}
              disabled={posting || editing}
              accessibilityRole='button'
              accessibilityLabel='Edit this snap'
            >
              <FontAwesome name='edit' size={14} color={colors.icon} />
              <Text style={{ marginLeft: 4, fontWeight: 'bold', fontSize: 12, color: colors.icon }}>
                Edit
              </Text>
            </TouchableOpacity>
          )}
          
          {onReplyPress && permlink && (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginLeft: 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                backgroundColor: 'transparent',
                opacity: posting || editing ? 0.5 : 1,
              }}
              onPress={() => onReplyPress(author, permlink)}
              disabled={posting || editing}
              accessibilityRole='button'
              accessibilityLabel='Reply to this snap'
            >
              <FontAwesome name='reply' size={16} color={colors.icon} />
              <Text style={{ marginLeft: 4, fontWeight: 'bold', fontSize: 12, color: colors.icon }}>
                Reply
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        // Normal mode for main snaps
        <View style={styles.voteBar}>
          {onUpvotePress && permlink ? (
            <Pressable
              onPress={() => onUpvotePress({ author, permlink })}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              accessibilityRole='button'
              accessibilityLabel='Upvote this snap'
            >
              <FontAwesome
                name='arrow-up'
                size={18}
                color={upvoteColor}
                style={styles.icon}
              />
            </Pressable>
          ) : (
            <FontAwesome
              name='arrow-up'
              size={18}
              color={upvoteColor}
              style={styles.icon}
            />
          )}
          <Text style={[styles.voteCount, { color: colors.text }]}>
            {voteCount}
          </Text>
          {onSpeechBubblePress ? (
            <Pressable
              onPress={onSpeechBubblePress}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              accessibilityRole='button'
              accessibilityLabel='View conversation'
            >
              <FontAwesome
                name='comment-o'
                size={18}
                color={colors.icon}
                style={styles.icon}
              />
            </Pressable>
          ) : (
            <FontAwesome
              name='comment-o'
              size={18}
              color={colors.icon}
              style={styles.icon}
            />
          )}
          <Text style={[styles.replyCount, { color: colors.text }]}>
            {replyCount}
          </Text>
          {/* Resnap button */}
          {onResnapPress && permlink && canBeResnapped({ author, permlink }) && (
            <Pressable
              onPress={() => onResnapPress(author, permlink)}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.6 : 1,
                  marginLeft: 12,
                  padding: 4,
                },
              ]}
              accessibilityRole='button'
              accessibilityLabel='Resnap this post'
            >
              <FontAwesome name='retweet' size={18} color={colors.icon} />
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          <Text style={[styles.payout, { color: colors.payout }]}>
            ${payout.toFixed(2)}
          </Text>
          {/* Edit button - only show for own snaps */}
          {onEditPress && permlink && author === currentUsername && (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'auto',
                marginLeft: 12,
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: 'transparent',
                opacity: posting || editing ? 0.5 : 1, // Dim when disabled
              }}
              onPress={() => onEditPress({ author, permlink, body })}
              disabled={posting || editing}
              accessibilityRole='button'
              accessibilityLabel='Edit this snap'
            >
              <FontAwesome name='edit' size={16} color={colors.icon} />
              <Text
                style={{
                  marginLeft: 6,
                  fontWeight: 'bold',
                  fontSize: 15,
                  color: colors.icon,
                }}
              >
                Edit
              </Text>
            </TouchableOpacity>
          )}
          {onReplyPress && permlink && (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'auto',
                marginLeft: 12,
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: 'transparent',
                opacity: posting || editing ? 0.5 : 1, // Dim when disabled
              }}
              onPress={() => onReplyPress(author, permlink)}
              disabled={posting || editing}
              accessibilityRole='button'
              accessibilityLabel='Reply to this snap'
            >
              <FontAwesome name='reply' size={16} color={colors.icon} />
              <Text
                style={{
                  marginLeft: 6,
                  fontWeight: 'bold',
                  fontSize: 15,
                  color: colors.icon,
                }}
              >
                Reply
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Hive Post Previews - Footer Style */}
      {hivePostUrls.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <OptimizedHivePostPreviewRenderer
            postUrls={hivePostUrls}
            colors={{
              bubble: colors.bubble,
              icon: colors.icon,
              text: colors.text,
            }}
            onError={error => {
              console.warn('[Snap] Hive post preview error:', error);
            }}
          />
        </View>
      )}
      </View>
    </View>
  );
};

const { width, height } = Dimensions.get('window');
const styles = StyleSheet.create({
  bubble: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    width: '100%', // Ensure full width
    alignSelf: 'stretch',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#E1E8ED',
  },
  username: {
    fontWeight: 'bold',
    fontSize: 15,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 13,
    marginLeft: 'auto',
    opacity: 0.7,
  },
  body: {
    fontSize: 16,
    marginBottom: 10,
    marginLeft: 2,
  },
  voteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  icon: {
    marginRight: 4,
  },
  voteCount: {
    marginRight: 12,
    fontSize: 14,
  },
  replyCount: {
    marginRight: 12,
    fontSize: 14,
  },
  payout: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.95,
    height: height * 0.85,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
  },
  fullImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
});

export default Snap;
