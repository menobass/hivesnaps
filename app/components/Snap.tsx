import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, useColorScheme, Linking, Pressable, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { extractImageUrls } from '../utils/extractImageUrls';
import { stripImageTags } from '../utils/stripImageTags';
import { extractVideoInfo, removeVideoUrls, extractYouTubeId } from '../utils/extractVideoInfo';
import IPFSVideoPlayer from './IPFSVideoPlayer';
import { WebView } from 'react-native-webview';
import { extractExternalLinks } from '../utils/extractExternalLinks';

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

const Snap: React.FC<SnapProps> = ({ author, avatarUrl, body, created, voteCount = 0, replyCount = 0, payout = 0, onUpvotePress, permlink, hasUpvoted = false, onSpeechBubblePress }) => {
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
  // Extract external (non-image, non-YouTube) links from all forms
  const { links: externalLinks, text: cleanTextBody } = extractExternalLinks(textBody);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

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
        <Image source={avatarUrl ? { uri: avatarUrl } : require('../../assets/images/logo.jpg')} style={styles.avatar} />       
        <Text style={[styles.username, { color: colors.text }]}>{author}</Text>
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
            <Pressable key={url + idx} onPress={() => { setModalImageUrl(url); setModalVisible(true); }}>
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
            <Pressable key={url + idx} onPress={() => { setModalImageUrl(url); setModalVisible(true); }}>
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
      {cleanTextBody.length > 0 && (
        <Text style={[styles.body, { color: colors.text }]}>{cleanTextBody}</Text>
      )}
      {/* External Links */}
      {externalLinks.length > 0 && (
        <View style={{ marginTop: 4, marginBottom: 6 }}>
          {externalLinks.map((link, idx) => {
            let display = link.label || link.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
            // Show only domain if no label
            if (!link.label) {
              try {
                const urlObj = new URL(link.url);
                display = urlObj.hostname.replace(/^www\./, '');
              } catch {
                display = link.url;
              }
            }
            return (
              <Pressable
                key={link.url + idx}
                onPress={() => Linking.openURL(link.url)}
                style={({ pressed }) => [{
                  opacity: pressed ? 0.6 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 2,
                }]}
                accessibilityRole="link"
                accessibilityLabel={`External link to ${display}`}
              >
                <FontAwesome name="external-link" size={15} color={colors.icon} style={{ marginRight: 6 }} />
                <Text style={{ color: colors.icon, textDecorationLine: 'underline', fontSize: 15 }}>{display}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
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
