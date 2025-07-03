import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, useColorScheme, Linking, Pressable, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { extractImageUrls } from '../../utils/extractImageUrls';
import { uploadImageToCloudinaryFixed } from '../../utils/cloudinaryImageUploadFixed';
import { stripImageTags } from '../../utils/stripImageTags';
import { extractVideoInfo, removeVideoUrls, extractYouTubeId } from '../../utils/extractVideoInfo';
import { extractExternalLinks } from '../../utils/extractExternalLinks';
import IPFSVideoPlayer from './IPFSVideoPlayer';
import { WebView } from 'react-native-webview';
import Markdown from 'react-native-markdown-display';
import RenderHtml from 'react-native-render-html';
import { Video, ResizeMode } from 'expo-av';

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
}

// Utility to extract raw image URLs from text (not in markdown or html)
function extractRawImageUrls(text: string): string[] {
  // Match URLs ending with image extensions, not inside markdown or html tags
  const regex = /(?:^|\s)(https?:\/\/(?:[\w.-]+)\/(?:[\w\-./%]+)\.(?:jpg|jpeg|png|gif|webp|bmp|svg))(?:\s|$)/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

// Utility to remove raw image URLs from text
function removeRawImageUrls(text: string): string {
  return text.replace(/(?:^|\s)(https?:\/\/(?:[\w.-]+)\/(?:[\w\-./%]+)\.(?:jpg|jpeg|png|gif|webp|bmp|svg))(?:\s|$)/gi, ' ').replace(/\s{2,}/g, ' ').trim();
}

const removeYouTubeUrl = (text: string): string => {
  // Remove all YouTube links (youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, etc.)
  return text.replace(/(?:https?:\/\/(?:www\.)?)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[\w-]{11}(\S*)?/gi, '').replace(/\s{2,}/g, ' ').trim();
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

// Utility: Preprocess raw URLs to clickable markdown links (if not already linked)
function linkifyUrls(text: string): string {
  // Regex for URLs (http/https) - includes @ character for Hive frontend URLs
  return text.replace(/(https?:\/\/[\w.-]+(?:\/[\w\-./?%&=+#@]*)?)/gi, (url) => {
    // If already inside a markdown or html link, skip
    if (/\]\([^)]+\)$/.test(url) || /href=/.test(url)) return url;
    // Do NOT shorten display for long URLs; use full URL as display
    return `[${url}](${url})`;
  });
}

// Helper: Render mp4 video using expo-av Video
const renderMp4Video = (uri: string, key?: string | number) => (
  <View key={key || uri} style={{ width: '100%', aspectRatio: 16 / 9, marginVertical: 10, borderRadius: 12, overflow: 'hidden', backgroundColor: '#eee' }}>
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
          const handler = (globalThis as any)._snapOnImagePress;
          if (typeof handler === 'function') {
            handler(src);
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
          resizeMode="cover"
          accessibilityLabel={alt || 'image'}
        />
      </Pressable>
    );
  },
  link: (
    node: any,
    children: any,
    parent: any,
    styles: any
  ) => {
    const { href } = node.attributes;
    const mp4Match = href && href.match(/\.mp4($|\?)/i);
    if (mp4Match) {
      return renderMp4Video(href, href);
    }
    // Handle profile:// links for mentions
    if (href && href.startsWith('profile://')) {
      const username = href.replace('profile://', '');
      // Use global onUserPress from Snap props
      return (
        <Pressable
          key={href}
          onPress={() => {
            const handler = (globalThis as any)._snapOnUserPress;
            if (typeof handler === 'function') handler(username);
          }}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="link"
          accessibilityLabel={`View @${username}'s profile`}
        >
          <Text style={{ color: twitterColors.light.icon, fontWeight: 'bold', textDecorationLine: 'underline' }}>{children}</Text>
        </Pressable>
      );
    }
    // Default: open external link
    return (
      <Text
        key={href}
        style={{ color: twitterColors.light.icon, textDecorationLine: 'underline' }}
        onPress={() => {
          if (href) Linking.openURL(href);
        }}
      >
        {children}
      </Text>
    );
  },
  html: (
    node: any,
    children: any,
    parent: any,
    styles: any
  ) => {
    const htmlContent = node.content || '';
    const videoTagMatch = htmlContent.match(/<video[^>]*src=["']([^"']+\.mp4)["'][^>]*>(.*?)<\/video>/i);
    if (videoTagMatch) {
      const mp4Url = videoTagMatch[1];
      return renderMp4Video(mp4Url, mp4Url);
    }
    // ...existing code...
    return null;
  },
  // ...existing code...
};

const Snap: React.FC<SnapProps> = ({ author, avatarUrl, body, created, voteCount = 0, replyCount = 0, payout = 0, onUpvotePress, permlink, hasUpvoted = false, onSpeechBubblePress, onUserPress, onContentPress, onImagePress }) => {
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const colors = twitterColors[colorScheme];
  const upvoteColor = hasUpvoted ? '#8e44ad' : colors.icon; // purple if upvoted
  const imageUrls = extractImageUrls(body);
  const rawImageUrls = extractRawImageUrls(body);
  const videoInfo = extractVideoInfo(body);
  // Remove video URLs and raw image URLs from text body if present
  let textBody = stripImageTags(body);
  if (videoInfo) {
    textBody = removeVideoUrls(textBody);
  }
  if (rawImageUrls.length > 0) {
    textBody = removeRawImageUrls(textBody);
  }
  // Add: linkify URLs first, then mentions (order matters!)
  textBody = linkifyUrls(textBody);
  textBody = linkifyMentions(textBody);
  // Remove extraction of external links
  const cleanTextBody = textBody; // Just use the processed textBody
  const [modalVisible, setModalVisible] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

  // Expose onUserPress globally for markdownRules
  (globalThis as any)._snapOnUserPress = onUserPress;
  (globalThis as any)._snapOnImagePress = onImagePress;

  return (
    <View style={[styles.bubble, { backgroundColor: colors.bubble, borderColor: colors.border, width: '100%', alignSelf: 'stretch' }]}> 
      {/* Image Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <FontAwesome name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {modalImageUrl && (
              <Image
                source={{ uri: modalImageUrl }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>
      {/* Top row: avatar, username, timestamp */}
      <View style={styles.topRow}>
        <Pressable
          onPress={() => onUserPress && onUserPress(author)}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center' }]}
          disabled={!onUserPress}
          accessibilityRole="button"
          accessibilityLabel={`View ${author}'s profile`}
        >
          <Image source={avatarUrl ? { uri: avatarUrl } : require('../../assets/images/logo.jpg')} style={styles.avatar} />       
          <Text style={[styles.username, { color: colors.text }]}>{author}</Text>
        </Pressable>
        <Text style={[styles.timestamp, { color: colors.text }]}>{new Date(created).toLocaleString()}</Text>    
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
      {/* Images from markdown/html */}
      {imageUrls.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          {imageUrls.map((url, idx) => (
            <Pressable key={url + idx} onPress={() => {
              if (onImagePress) {
                onImagePress(url);
              } else {
                setModalImageUrl(url);
                setModalVisible(true);
              }
            }}>
              <Image
                source={{ uri: url }}
                style={{ width: '100%', height: 200, borderRadius: 12, marginBottom: 6, backgroundColor: '#eee' }}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </View>
      )}
      {/* Images from raw URLs */}
      {rawImageUrls.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          {rawImageUrls.map((url, idx) => (
            <Pressable key={url + idx} onPress={() => {
              if (onImagePress) {
                onImagePress(url);
              } else {
                setModalImageUrl(url);
                setModalVisible(true);
              }
            }}>
              <Image
                source={{ uri: url }}
                style={{ width: '100%', height: 200, borderRadius: 12, marginBottom: 6, backgroundColor: '#eee' }}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </View>
      )}
      {/* Body */}
      {cleanTextBody.length > 0 && (() => {
        const windowWidth = Dimensions.get('window').width;
        const isHtml = containsHtml(cleanTextBody);
        if (onContentPress) {
          return (
            <Pressable
              onPress={onContentPress}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="View conversation"
            >
              {isHtml ? (
                <RenderHtml
                  contentWidth={windowWidth - 32}
                  source={{ html: cleanTextBody }}
                  baseStyle={{ color: colors.text, fontSize: 15, marginBottom: 8 }}
                  enableExperimentalMarginCollapsing
                  tagsStyles={{ a: { color: colors.icon } }}
                  renderers={{
                    video: (props: any) => {
                      const src = props?.tnode?.attributes?.src;
                      const TDefaultRenderer = props?.TDefaultRenderer;
                      if (src && src.endsWith('.mp4')) {
                        return renderMp4Video(src);
                      }
                      return TDefaultRenderer ? <TDefaultRenderer {...props} /> : null;
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
                  {cleanTextBody}
                </Markdown>
              )}
            </Pressable>
          );
        } else {
          return isHtml ? (
            <RenderHtml
              contentWidth={windowWidth - 32}
              source={{ html: cleanTextBody }}
              baseStyle={{ color: colors.text, fontSize: 15, marginBottom: 8 }}
              enableExperimentalMarginCollapsing
              tagsStyles={{ a: { color: colors.icon } }}
              renderers={{
                video: (props: any) => {
                  const src = props?.tnode?.attributes?.src;
                  const TDefaultRenderer = props?.TDefaultRenderer;
                  if (src && src.endsWith('.mp4')) {
                    return renderMp4Video(src);
                  }
                  return TDefaultRenderer ? <TDefaultRenderer {...props} /> : null;
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
              {cleanTextBody}
            </Markdown>
          );
        }
      })()}
      {/* VoteReplyBar - only upvote icon is interactive */}
      <View style={styles.voteBar}>
        {onUpvotePress && permlink ? (
          <Pressable
            onPress={() => onUpvotePress({ author, permlink })}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Upvote this snap"
          >
            <FontAwesome name="arrow-up" size={18} color={upvoteColor} style={styles.icon} />
          </Pressable>
        ) : (
          <FontAwesome name="arrow-up" size={18} color={upvoteColor} style={styles.icon} />
        )}
        <Text style={[styles.voteCount, { color: colors.text }]}>{voteCount}</Text>
        {onSpeechBubblePress ? (
          <Pressable
            onPress={onSpeechBubblePress}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="View conversation"
          >
            <FontAwesome name="comment-o" size={18} color={colors.icon} style={styles.icon} />
          </Pressable>
        ) : (
          <FontAwesome name="comment-o" size={18} color={colors.icon} style={styles.icon} />
        )}
        <Text style={[styles.replyCount, { color: colors.text }]}>{replyCount}</Text>
        <View style={{ flex: 1 }} />
        <Text style={[styles.payout, { color: colors.payout }]}>${payout.toFixed(2)}</Text>
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
