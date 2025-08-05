import React, { useState, useCallback } from 'react';
import { SafeAreaView as SafeAreaViewRN } from 'react-native';
import {
  SafeAreaView as SafeAreaViewSA,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
  Linking,
  Pressable,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import SafeRenderHtml from '../components/SafeRenderHtml';
import { Dimensions } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Client } from '@hiveio/dhive';
import { useUserAuth } from '../hooks/useUserAuth';
import { useUpvote } from '../hooks/useUpvote';
import { useHiveData } from '../hooks/useHiveData';
import UpvoteModal from '../components/UpvoteModal';
import genericAvatar from '../assets/images/generic-avatar.png';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

interface HivePostData {
  author: string;
  permlink: string;
  title: string;
  body: string;
  created: string;
  voteCount: number;
  replyCount: number;
  payout: number;
  avatarUrl?: string;
  active_votes?: any[];
  json_metadata?: string;
  category?: string;
  tags?: string[];
}

const HivePostScreen = () => {
  const { author, permlink } = useLocalSearchParams<{
    author: string;
    permlink: string;
  }>();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUsername } = useUserAuth();
  const { hivePrice, globalProps, rewardFund } = useHiveData();

  console.log('[HivePostScreen] Component loaded with params:', {
    author,
    permlink,
  });

  const [post, setPost] = useState<HivePostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  } = useUpvote(currentUsername, globalProps, rewardFund, hivePrice);

  const fetchHivePost = useCallback(async () => {
    console.log('[HivePostScreen] fetchHivePost called with:', {
      author,
      permlink,
    });

    if (!author || !permlink) {
      console.log('[HivePostScreen] Missing parameters');
      setError('Missing post parameters');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[HivePostScreen] Fetching post data from Hive...');
      // Fetch the post
      const postData = await client.database.call('get_content', [
        author,
        permlink,
      ]);

      if (!postData || !postData.author) {
        setError('Post not found');
        setLoading(false);
        return;
      }

      // Fetch author avatar
      let avatarUrl: string | undefined = undefined;
      try {
        const accounts = await client.database.call('get_accounts', [
          [postData.author],
        ]);
        if (accounts && accounts[0]) {
          const metadata =
            accounts[0].posting_json_metadata || accounts[0].json_metadata;
          if (metadata) {
            try {
              const profile = JSON.parse(metadata).profile;
              if (profile && profile.profile_image) {
                avatarUrl = profile.profile_image;
              }
            } catch (e) {
              // Invalid JSON metadata
            }
          }
        }
      } catch (e) {
        // Avatar fetch failed
      }

      // Extract tags from metadata
      let tags: string[] = [];
      try {
        if (postData.json_metadata) {
          const metadata = JSON.parse(postData.json_metadata);
          tags = metadata.tags || [];
        }
      } catch (e) {
        // Invalid JSON metadata
      }

      const hivePostData: HivePostData = {
        author: postData.author,
        permlink: postData.permlink,
        title: postData.title || 'Untitled Post',
        body: postData.body,
        created: postData.created,
        voteCount: postData.net_votes || 0,
        replyCount: postData.children || 0,
        payout: parseFloat(
          postData.pending_payout_value
            ? postData.pending_payout_value.replace(' HBD', '')
            : '0'
        ),
        avatarUrl,
        active_votes: postData.active_votes,
        json_metadata: postData.json_metadata,
        category: postData.category,
        tags,
      };

      setPost(hivePostData);
    } catch (error) {
      console.error('Error fetching Hive post:', error);
      setError('Failed to load post');
    } finally {
      setLoading(false);
    }
  }, [author, permlink]);

  React.useEffect(() => {
    fetchHivePost();
  }, [fetchHivePost]);

  const handleUpvotePress = useCallback(() => {
    if (!post) return;

    openUpvoteModal({
      author: post.author,
      permlink: post.permlink,
      snap: post,
    });
  }, [post, openUpvoteModal]);

  const handleRefresh = useCallback(() => {
    fetchHivePost();
  }, [fetchHivePost]);

  const colors = {
    background: isDark ? '#15202B' : '#fff',
    text: isDark ? '#D7DBDC' : '#0F1419',
    border: isDark ? '#38444D' : '#E1E8ED',
    icon: isDark ? '#8899A6' : '#657786',
    button: isDark ? '#1DA1F2' : '#1DA1F2',
    buttonText: '#FFFFFF',
    buttonInactive: isDark ? '#38444D' : '#E1E8ED',
    payout: '#17BF63',
  };

  if (loading) {
    return (
      <SafeAreaViewSA style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <ActivityIndicator size='large' color={colors.button} />
          <Text style={{ color: colors.text, marginTop: 16 }}>
            Loading post...
          </Text>
        </View>
      </SafeAreaViewSA>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaViewSA style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <FontAwesome
            name='exclamation-triangle'
            size={48}
            color={colors.icon}
          />
          <Text
            style={{
              color: colors.text,
              fontSize: 18,
              marginTop: 16,
              textAlign: 'center',
            }}
          >
            {error || 'Post not found'}
          </Text>
          <TouchableOpacity
            onPress={handleRefresh}
            style={{
              backgroundColor: colors.button,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 8,
              marginTop: 16,
            }}
          >
            <Text style={{ color: colors.buttonText, fontWeight: '600' }}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaViewSA>
    );
  }

  const windowWidth = Dimensions.get('window').width;

  // Smart HTML detection - distinguish between HTML and markdown content
  const hasHtmlTags = /<([a-z][\s\S]*?)>/i.test(post.body);
  const hasComplexHtml =
    post.body.includes('<div') ||
    post.body.includes('<p') ||
    post.body.includes('<span') ||
    post.body.includes('<img') ||
    post.body.includes('<a') ||
    post.body.includes('<h') ||
    post.body.includes('<ul') ||
    post.body.includes('<ol') ||
    post.body.includes('<li') ||
    post.body.includes('<br') ||
    post.body.includes('<hr');

  // Use HTML renderer only for complex HTML, use markdown for simple formatting tags
  const isHtml = hasComplexHtml;

  // Preprocess content for markdown rendering - convert <u> tags to markdown format
  const preprocessForMarkdown = (content: string) => {
    return content
      .replace(/<u>(.*?)<\/u>/g, '___$1___') // Convert <u> tags to markdown underlines
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**') // Convert <strong> tags to markdown bold
      .replace(/<em>(.*?)<\/em>/g, '*$1*') // Convert <em> tags to markdown italic
      .replace(
        /(^|[^\w/@])@([a-z0-9\-\.]{3,16})(?![a-z0-9\-\.])/gi,
        '$1[**@$2**](profile://$2)'
      ); // Convert @usernames to clickable links
  };

  console.log('[HivePostScreen] Content type detection:', {
    isHtml,
    bodyLength: post.body.length,
    bodyPreview: post.body.substring(0, 200),
    hasMarkdownHeaders: /^#{1,6}\s/.test(post.body),
    hasMarkdownBold: /\*\*.*\*\*/.test(post.body),
    hasMarkdownItalic: /\*.*\*/.test(post.body),
    hasUTags: post.body.includes('<u>'),
  });

  return (
    <SafeAreaViewSA style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome name='arrow-left' size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          style={{
            color: colors.text,
            fontSize: 18,
            fontWeight: '600',
            marginLeft: 16,
            flex: 1,
          }}
        >
          Hive Post
        </Text>
        <TouchableOpacity onPress={handleRefresh}>
          <FontAwesome name='refresh' size={20} color={colors.icon} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Author Info */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <ExpoImage
            source={post.avatarUrl ? { uri: post.avatarUrl } : genericAvatar}
            style={{ width: 48, height: 48, borderRadius: 24 }}
            contentFit='cover'
          />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text
              style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}
            >
              {post.author}
            </Text>
            <Text style={{ color: colors.icon, fontSize: 14 }}>
              {new Date(post.created + 'Z').toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Title */}
        {post.title && (
          <Text
            style={{
              color: colors.text,
              fontSize: 20,
              fontWeight: 'bold',
              marginBottom: 16,
            }}
          >
            {post.title}
          </Text>
        )}

        {/* Content */}
        <View style={{ marginBottom: 20 }}>
          {isHtml ? (
            <SafeRenderHtml
              contentWidth={windowWidth - 32}
              source={{ html: post.body }}
              baseStyle={{
                color: colors.text,
                fontSize: 16,
                lineHeight: 24,
              }}
              tagsStyles={{
                a: { color: colors.button },
                p: { marginBottom: 16 },
                h1: {
                  color: colors.text,
                  fontSize: 24,
                  fontWeight: 'bold',
                  marginBottom: 16,
                },
                h2: {
                  color: colors.text,
                  fontSize: 20,
                  fontWeight: 'bold',
                  marginBottom: 12,
                },
                h3: {
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: 'bold',
                  marginBottom: 10,
                },
                u: { textDecorationLine: 'underline' },
              }}
            />
          ) : (
            <Markdown
              style={{
                body: {
                  color: colors.text,
                  fontSize: 16,
                  lineHeight: 24,
                  fontFamily: 'System',
                },
                paragraph: {
                  marginBottom: 16,
                  color: colors.text,
                },
                heading1: {
                  color: colors.text,
                  fontSize: 24,
                  fontWeight: 'bold',
                  marginBottom: 16,
                  marginTop: 24,
                },
                heading2: {
                  color: colors.text,
                  fontSize: 20,
                  fontWeight: 'bold',
                  marginBottom: 12,
                  marginTop: 20,
                },
                heading3: {
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: 'bold',
                  marginBottom: 10,
                  marginTop: 16,
                },
                heading4: {
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: 'bold',
                  marginBottom: 8,
                  marginTop: 12,
                },
                heading5: {
                  color: colors.text,
                  fontSize: 14,
                  fontWeight: 'bold',
                  marginBottom: 6,
                  marginTop: 10,
                },
                heading6: {
                  color: colors.text,
                  fontSize: 12,
                  fontWeight: 'bold',
                  marginBottom: 4,
                  marginTop: 8,
                },
                link: {
                  color: colors.button,
                  textDecorationLine: 'underline',
                },
                strong: {
                  fontWeight: 'bold',
                  color: colors.text,
                },
                em: {
                  fontStyle: 'italic',
                  color: colors.text,
                },
                // Add styling for markdown underlines (___text___)
                underline: {
                  textDecorationLine: 'underline',
                  color: colors.text,
                },
                u: {
                  textDecorationLine: 'underline',
                  color: colors.text,
                },

                code_inline: {
                  backgroundColor: isDark ? '#2C3E50' : '#F8F9FA',
                  color: isDark ? '#E74C3C' : '#E74C3C',
                  paddingHorizontal: 4,
                  paddingVertical: 2,
                  borderRadius: 4,
                  fontFamily: 'monospace',
                  fontSize: 14,
                },
                code_block: {
                  backgroundColor: isDark ? '#2C3E50' : '#F8F9FA',
                  color: isDark ? '#E74C3C' : '#E74C3C',
                  padding: 12,
                  borderRadius: 8,
                  fontFamily: 'monospace',
                  fontSize: 14,
                  marginVertical: 8,
                },
                blockquote: {
                  borderLeftWidth: 4,
                  borderLeftColor: colors.button,
                  paddingLeft: 16,
                  marginVertical: 8,
                  backgroundColor: isDark ? '#2C3E50' : '#F8F9FA',
                  paddingVertical: 8,
                  paddingRight: 12,
                },
                list_item: {
                  marginBottom: 4,
                  color: colors.text,
                },
                bullet_list: {
                  marginBottom: 16,
                  paddingLeft: 16,
                },
                ordered_list: {
                  marginBottom: 16,
                  paddingLeft: 16,
                },
                hr: {
                  backgroundColor: colors.border,
                  height: 1,
                  marginVertical: 16,
                },
              }}
              rules={{
                link: (node, children, parent, styles) => {
                  const { href } = node.attributes;

                  // Handle profile:// links for mentions
                  if (href && href.startsWith('profile://')) {
                    const username = href.replace('profile://', '');
                    return (
                      <Pressable
                        key={node.key}
                        onPress={() =>
                          router.push(
                            `/ProfileScreen?username=${username}` as any
                          )
                        }
                        style={({ pressed }) => [
                          { opacity: pressed ? 0.6 : 1 },
                        ]}
                        accessibilityRole='link'
                        accessibilityLabel={`View @${username}'s profile`}
                      >
                        <Text
                          style={{
                            color: colors.button,
                            fontWeight: 'bold',
                            transform: [{ translateY: 4 }] // hack to move down
                          }}
                        >
                          @{username}
                        </Text>
                      </Pressable>
                    );
                  }

                  // Handle regular links
                  return (
                    <Pressable
                      key={node.key}
                      onPress={() => Linking.openURL(href)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                      accessibilityRole='link'
                      accessibilityLabel={`Open link: ${href}`}
                    >
                      <Text
                        style={{
                          color: colors.button,
                          textDecorationLine: 'underline',
                        }}
                      >
                        {children}
                      </Text>
                    </Pressable>
                  );
                },
              }}
            >
              {preprocessForMarkdown(post.body)}
            </Markdown>
          )}
        </View>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}
          >
            {post.tags.slice(0, 5).map((tag, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: colors.button,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12,
                  marginRight: 8,
                  marginBottom: 4,
                }}
              >
                <Text style={{ color: colors.buttonText, fontSize: 12 }}>
                  #{tag}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Engagement Metrics */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={handleUpvotePress}
              disabled={post.active_votes?.some(
                (vote: any) =>
                  vote.voter === currentUsername && vote.percent > 0
              )}
              style={{ marginRight: 16 }}
            >
              <FontAwesome
                name='arrow-up'
                size={20}
                color={
                  post.active_votes?.some(
                    (vote: any) =>
                      vote.voter === currentUsername && vote.percent > 0
                  )
                    ? '#8e44ad'
                    : colors.icon
                }
              />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 16, marginRight: 16 }}>
              {post.voteCount}
            </Text>
            <FontAwesome
              name='comment-o'
              size={16}
              color={colors.icon}
              style={{ marginRight: 8 }}
            />
            <Text style={{ color: colors.text, fontSize: 16, marginRight: 16 }}>
              {post.replyCount}
            </Text>
          </View>
          <Text
            style={{ color: colors.payout, fontSize: 16, fontWeight: '600' }}
          >
            ${post.payout.toFixed(2)}
          </Text>
        </View>
      </ScrollView>

      {/* Upvote Modal */}
      <UpvoteModal
        visible={upvoteModalVisible}
        voteWeight={voteWeight}
        voteValue={voteValue}
        voteWeightLoading={voteWeightLoading}
        upvoteLoading={upvoteLoading}
        upvoteSuccess={upvoteSuccess}
        onClose={closeUpvoteModal}
        onConfirm={confirmUpvote}
        onVoteWeightChange={setVoteWeight}
        colors={{
          background: colors.background,
          text: colors.text,
          button: colors.button,
          buttonText: colors.buttonText,
          buttonInactive: colors.buttonInactive,
          icon: colors.icon,
        }}
      />
    </SafeAreaViewSA>
  );
};

export default HivePostScreen;

export const options = { headerShown: false };
