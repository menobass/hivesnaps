import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  useColorScheme,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import Markdown from 'react-native-markdown-display';
import RenderHtml from 'react-native-render-html';
import { Dimensions } from 'react-native';
import { useRouter } from 'expo-router';

import { ReplyData } from '../../hooks/useConversationData';
import { ConversationScreenStyles } from '../../styles/ConversationScreenStyles';
import genericAvatar from '../../assets/images/generic-avatar.png';
import SpoilerText from './SpoilerText';
import TwitterEmbed from './TwitterEmbed';
import {
  extractVideoInfo,
  removeEmbedUrls,
  removeTwitterUrls,
} from '../../utils/extractVideoInfo';
import { extractImageUrls } from '../../utils/extractImageUrls';
import { extractHivePostUrls } from '../../utils/extractHivePostInfo';
import { convertSpoilerSyntax } from '../../utils/spoilerParser';
import {
  stripImageTags,
  preserveParagraphSpacing,
  linkifyUrls,
  linkifyMentions,
  linkifyHashtags,
  containsHtml,
} from '../../utils/contentProcessing';

interface ReplyProps {
  reply: ReplyData & { visualLevel: number };
  onUpvotePress: (params: { author: string; permlink: string }) => void;
  onReplyPress: (author: string, permlink: string) => void;
  onEditPress: (reply: ReplyData) => void;
  onImagePress: (imageUrl: string) => void;
  currentUsername?: string | null;
  colors: {
    text: string;
    bubble: string;
    icon: string;
    payout: string;
    button: string;
    buttonText: string;
  };
}

const Reply: React.FC<ReplyProps> = ({
  reply,
  onUpvotePress,
  onReplyPress,
  onEditPress,
  onImagePress,
  currentUsername,
  colors,
}) => {
  const router = useRouter();
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';

  // Extract and render Twitter posts - define this function first
  const extractAndRenderTwitterPosts = (content: string) => {
    const videoInfo = extractVideoInfo(content);

    if (videoInfo && videoInfo.type === 'twitter') {
      console.log('🐦 Rendering Twitter post with WebView:', videoInfo);

      return (
        <View key={`twitter-${videoInfo.tweetId}`} style={{ marginBottom: 8 }}>
          <TwitterEmbed embedUrl={videoInfo.embedUrl} isDark={isDark} />
        </View>
      );
    }

    return null;
  };

  // Process content
  const videoInfo = extractVideoInfo(reply.body);
  const imageUrls = extractImageUrls(reply.body);
  const hivePostUrls = extractHivePostUrls(reply.body);

  let textBody = reply.body;
  if (videoInfo || hivePostUrls.length > 0) {
    textBody = removeEmbedUrls(textBody);
  }

  // Check for Twitter posts and remove URLs if found
  const twitterPosts = extractAndRenderTwitterPosts(reply.body);
  if (twitterPosts) {
    textBody = removeTwitterUrls(textBody);
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

  // Calculate indentation based on visual level
  const maxVisualLevel = 2;
  const visualLevel = Math.min(reply.visualLevel, maxVisualLevel);
  const marginLeft = visualLevel * 18;
  const contentWidth = Math.max(windowWidth - marginLeft - 32, 200);

  console.log(
    `[REPLY] Rendering reply from ${reply.author}, visualLevel: ${visualLevel}, marginLeft: ${marginLeft}px`
  );

  // Custom markdown rules
  const markdownRules = {
    image: (node: any, children: any, parent: any, styles: any) => {
      const { src, alt } = node.attributes;

      // Only process actual image URLs, ignore hashtag/profile links
      if (
        !src ||
        src.startsWith('hashtag://') ||
        src.startsWith('profile://')
      ) {
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
        <Pressable key={uniqueKey} onPress={() => onImagePress(src)}>
          <ExpoImage
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
            contentFit='cover'
          />
        </Pressable>
      );
    },
    link: (node: any, children: any, parent: any, styles: any) => {
      const { href } = node.attributes;

      // Handle profile:// URLs
      if (href && href.startsWith('profile://')) {
        const username = href.replace('profile://', '');
        const uniqueKey = `${href}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <Text
            key={uniqueKey}
            style={{
              color: colors.icon,
              fontWeight: 'bold',
              textDecorationLine: 'underline',
            }}
            onPress={() =>
              router.push(`/ProfileScreen?username=${username}` as any)
            }
          >
            {children}
          </Text>
        );
      }

      // Handle mention links (https://peakd.com/@username)
      if (href && href.startsWith('https://peakd.com/@')) {
        const username = href.replace('https://peakd.com/@', '');
        const uniqueKey = `${href}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <Text
            key={uniqueKey}
            style={{
              color: colors.icon,
              fontWeight: 'bold',
              textDecorationLine: 'underline',
              paddingTop: 4,
            }}
            onPress={() =>
              router.push(`/ProfileScreen?username=${username}` as any)
            }
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
            style={{
              color: colors.icon,
              fontWeight: 'bold',
              textDecorationLine: 'underline',
            }}
            onPress={() =>
              router.push({
                pathname: '/DiscoveryScreen',
                params: { hashtag: tag },
              })
            }
          >
            {children}
          </Text>
        );
      }

      // Handle other HTTPS links (fallback for regular URLs)
      if (href) {
        const uniqueKey = `${href}-${Math.random().toString(36).substr(2, 9)}`;
        return (
          <Text
            key={uniqueKey}
            style={{
              color: colors.icon,
              textDecorationLine: 'underline',
            }}
          >
            {children}
          </Text>
        );
      }

      return null;
    },
  };

  return (
    <View
      key={reply.author + reply.permlink + '-' + reply.visualLevel}
      style={{
        marginLeft: marginLeft,
        marginBottom: 10,
      }}
    >
      <View
        style={[
          ConversationScreenStyles.replyBubble,
          { backgroundColor: colors.bubble },
        ]}
      >
        {/* Avatar, author, timestamp row */}
        <View style={ConversationScreenStyles.authorRow}>
          <Pressable
            onPress={() =>
              router.push(`/ProfileScreen?username=${reply.author}` as any)
            }
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.7 : 1,
                flexDirection: 'row',
                alignItems: 'center',
              },
            ]}
            accessibilityRole='button'
            accessibilityLabel={`View ${reply.author}'s profile`}
          >
            {reply.avatarUrl ? (
              <ExpoImage
                source={
                  reply.avatarUrl ? { uri: reply.avatarUrl } : genericAvatar
                }
                style={ConversationScreenStyles.avatar}
                contentFit='cover'
                onError={() => {}}
              />
            ) : (
              <ExpoImage
                source={genericAvatar}
                style={ConversationScreenStyles.avatar}
                contentFit='cover'
              />
            )}
            <Text
              style={[
                ConversationScreenStyles.replyAuthor,
                { color: colors.text, marginLeft: 10 },
              ]}
            >
              {reply.author}
            </Text>
            <Text
              style={[
                ConversationScreenStyles.snapTimestamp,
                { color: colors.text },
              ]}
            >
              {reply.created
                ? new Date(reply.created + 'Z').toLocaleString()
                : ''}
            </Text>
          </Pressable>
        </View>

        {/* Images */}
        {imageUrls.length > 0 && (
          <View style={ConversationScreenStyles.imageContainer}>
            {imageUrls.map((url, idx) => (
              <Pressable key={url + idx} onPress={() => onImagePress(url)}>
                <ExpoImage
                  source={{ uri: url }}
                  style={ConversationScreenStyles.imageStyle}
                  contentFit='cover'
                />
              </Pressable>
            ))}
          </View>
        )}

        {/* Hive Post Previews */}
        {hivePostUrls.length > 0 && (
          <View style={{ marginTop: 8 }}>
            {hivePostUrls.map((url, index) => (
              <Text key={index} style={{ color: colors.text, marginBottom: 4 }}>
                📎 {url}
              </Text>
            ))}
          </View>
        )}

        {/* Twitter/X Posts */}
        {extractAndRenderTwitterPosts(reply.body)}

        {/* Spoiler Components */}
        {spoilerData.spoilers.map((spoiler: any, index: number) => (
          <SpoilerText
            key={`reply-spoiler-${index}`}
            buttonText={spoiler.buttonText}
          >
            {spoiler.content}
          </SpoilerText>
        ))}

        {/* Text Content */}
        {textBody.trim().length > 0 && (
          <View
            style={{
              marginTop:
                videoInfo || imageUrls.length > 0 || hivePostUrls.length > 0
                  ? 8
                  : 0,
            }}
          >
            {isHtml ? (
              <RenderHtml
                contentWidth={contentWidth}
                source={{ html: textBody }}
                baseStyle={{
                  color: colors.text,
                  fontSize: 14,
                  marginBottom: 4,
                  lineHeight: 20,
                  flexWrap: 'wrap',
                }}
                enableExperimentalMarginCollapsing
                tagsStyles={{
                  a: { color: colors.icon },
                  p: { marginBottom: 12, lineHeight: 20 },
                  u: { textDecorationLine: 'underline' },
                }}
              />
            ) : (
              <Markdown
                style={{
                  body: { color: colors.text, fontSize: 14, marginBottom: 4 },
                  paragraph: {
                    color: colors.text,
                    fontSize: 14,
                    marginBottom: 12,
                    lineHeight: 20,
                    flexWrap: 'wrap',
                  },
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
            style={[
              ConversationScreenStyles.replyButton,
              ConversationScreenStyles.upvoteButton,
            ]}
            onPress={() =>
              onUpvotePress({
                author: reply.author,
                permlink: reply.permlink || '',
              })
            }
            disabled={
              Array.isArray(reply.active_votes) &&
              reply.active_votes.some(
                (v: any) => v.voter === currentUsername && v.percent > 0
              )
            }
          >
            <FontAwesome
              name='arrow-up'
              size={16}
              color={
                Array.isArray(reply.active_votes) &&
                reply.active_votes.some(
                  (v: any) => v.voter === currentUsername && v.percent > 0
                )
                  ? '#8e44ad'
                  : colors.icon
              }
            />
          </TouchableOpacity>
          <Text
            style={[
              ConversationScreenStyles.replyMetaText,
              { color: colors.text },
            ]}
          >
            {reply.voteCount || 0}
          </Text>
          <FontAwesome
            name='comment-o'
            size={16}
            color={colors.icon}
            style={{ marginLeft: 12 }}
          />
          <Text
            style={[
              ConversationScreenStyles.replyMetaText,
              { color: colors.text },
            ]}
          >
            {reply.replyCount || 0}
          </Text>
          <Text
            style={[
              ConversationScreenStyles.replyMetaText,
              { color: colors.payout, marginLeft: 12 },
            ]}
          >
            {reply.payout ? `$${reply.payout.toFixed(2)}` : ''}
          </Text>
          <View style={{ flex: 1 }} />

          {/* Edit button - only show for own replies */}
          {reply.author === currentUsername && (
            <TouchableOpacity
              style={ConversationScreenStyles.replyButton}
              onPress={() => onEditPress(reply)}
            >
              <FontAwesome name='edit' size={14} color={colors.icon} />
              <Text
                style={[
                  ConversationScreenStyles.replyButtonText,
                  { color: colors.icon, fontSize: 12 },
                ]}
              >
                Edit
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={ConversationScreenStyles.replyButton}
            onPress={() => onReplyPress(reply.author, reply.permlink || '')}
          >
            <FontAwesome name='reply' size={16} color={colors.icon} />
            <Text
              style={[
                ConversationScreenStyles.replyButtonText,
                { color: colors.icon },
              ]}
            >
              Reply
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default Reply;
