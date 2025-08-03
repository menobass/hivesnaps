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
  const { author, permlink } = useLocalSearchParams<{ author: string; permlink: string }>();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUsername } = useUserAuth();
  const { hivePrice, globalProps, rewardFund } = useHiveData();

  console.log('[HivePostScreen] Component loaded with params:', { author, permlink });

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
    console.log('[HivePostScreen] fetchHivePost called with:', { author, permlink });
    
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
      const postData = await client.database.call('get_content', [author, permlink]);

      if (!postData || !postData.author) {
        setError('Post not found');
        setLoading(false);
        return;
      }

      // Fetch author avatar
      let avatarUrl: string | undefined = undefined;
      try {
        const accounts = await client.database.call('get_accounts', [[postData.author]]);
        if (accounts && accounts[0]) {
          const metadata = accounts[0].posting_json_metadata || accounts[0].json_metadata;
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.button} />
          <Text style={{ color: colors.text, marginTop: 16 }}>Loading post...</Text>
        </View>
      </SafeAreaViewSA>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaViewSA style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <FontAwesome name="exclamation-triangle" size={48} color={colors.icon} />
          <Text style={{ color: colors.text, fontSize: 18, marginTop: 16, textAlign: 'center' }}>
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
            <Text style={{ color: colors.buttonText, fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaViewSA>
    );
  }

  const windowWidth = Dimensions.get('window').width;
  const isHtml = post.body.includes('<') && post.body.includes('>');

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
          <FontAwesome name="arrow-left" size={24} color={colors.text} />
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
          <FontAwesome name="refresh" size={20} color={colors.icon} />
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
            contentFit="cover"
          />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
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
                h1: { color: colors.text, fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
                h2: { color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
                h3: { color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
              }}
            />
          ) : (
            <Markdown
              style={{
                body: { color: colors.text, fontSize: 16, lineHeight: 24 },
                paragraph: { marginBottom: 16 },
                heading1: { color: colors.text, fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
                heading2: { color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
                heading3: { color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
                link: { color: colors.button },
              }}
            >
              {post.body}
            </Markdown>
          )}
        </View>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
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
                <Text style={{ color: colors.buttonText, fontSize: 12 }}>#{tag}</Text>
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
              disabled={
                post.active_votes?.some(
                  (vote: any) => vote.voter === currentUsername && vote.percent > 0
                )
              }
              style={{ marginRight: 16 }}
            >
              <FontAwesome
                name="arrow-up"
                size={20}
                color={
                  post.active_votes?.some(
                    (vote: any) => vote.voter === currentUsername && vote.percent > 0
                  )
                    ? '#8e44ad'
                    : colors.icon
                }
              />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 16, marginRight: 16 }}>
              {post.voteCount}
            </Text>
            <FontAwesome name="comment-o" size={16} color={colors.icon} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.text, fontSize: 16, marginRight: 16 }}>
              {post.replyCount}
            </Text>
          </View>
          <Text style={{ color: colors.payout, fontSize: 16, fontWeight: '600' }}>
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