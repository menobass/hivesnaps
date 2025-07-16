import React, { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { View, FlatList, Text, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Snap from './components/Snap';
import { Client } from '@hiveio/dhive';

// Use local twitterColors definition (copied from FeedScreen)
const twitterColors = {
  light: {
    background: '#fff',
    text: '#14171A',
    button: '#1DA1F2',
    buttonText: '#fff',
    buttonInactive: '#AAB8C2',
    icon: '#657786',
    fab: '#1DA1F2',
    fabIcon: '#fff',
    border: '#E1E8ED',
    username: '#1DA1F2',
    reward: '#FFD700',
    error: '#FF3B30',
    footer: '#F5F8FA',
  },
  dark: {
    background: '#15202B',
    text: '#fff',
    button: '#1DA1F2',
    buttonText: '#fff',
    buttonInactive: '#38444D',
    icon: '#8899A6',
    fab: '#1DA1F2',
    fabIcon: '#fff',
    border: '#38444D',
    username: '#1DA1F2',
    reward: '#FFD700',
    error: '#FF3B30',
    footer: '#22303C',
  },
};

// Use local client instance (copied from FeedScreen)
const HIVE_NODES = [
  'https://api.hive.blog',
  'https://anyx.io',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

interface Snap {
  [key: string]: any;
}

const DiscoveryScreen = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = twitterColors[colorScheme];
  const router = useRouter();
  const { hashtag } = useLocalSearchParams<{ hashtag: string }>();

  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHashtagSnaps = async () => {
      setLoading(true);
      try {
        // Get recent container posts
        const discussions = await client.database.call('get_discussions_by_blog', [{ tag: 'peak.snaps', limit: 5 }]);
        let allSnaps: Snap[] = [];
        const snapPromises = discussions.map(async (post: any) => {
          try {
            const replies: Snap[] = await client.database.call('get_content_replies', [post.author, post.permlink]);
            // Filter snaps containing the hashtag
            return replies.filter(reply =>
              reply.body && reply.body.toLowerCase().includes(`#${hashtag?.toLowerCase()}`)
            );
          } catch {
            return [];
          }
        });
        const snapResults = await Promise.all(snapPromises);
        allSnaps = snapResults.flat();
        // Sort by created date descending
        allSnaps.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
        setSnaps(allSnaps);
      } catch (err) {
        setSnaps([]);
      }
      setLoading(false);
    };
    if (hashtag) fetchHashtagSnaps();
  }, [hashtag]);

  // Basic upvote handler (replace with real logic as needed)
  const handleUpvotePress = ({ author, permlink }: { author: string; permlink: string }) => {
    // TODO: Implement real upvote logic (e.g., call Hive API, update UI, show feedback)
    alert(`Upvote pressed for @${author}/${permlink}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text }}>
          #{hashtag} Snaps
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={colors.button} style={{ marginTop: 40 }} />
      ) : snaps.length === 0 ? (
        <Text style={{ color: colors.text, marginTop: 24, textAlign: 'center' }}>No snaps found for this hashtag.</Text>
      ) : (
        <FlatList
          data={snaps}
          keyExtractor={item => item.author + '-' + item.permlink}
          renderItem={({ item }) => (
            <Snap
              author={item.author}
              avatarUrl={item.avatarUrl}
              body={item.body}
              created={item.created}
              voteCount={item.net_votes || 0}
              replyCount={item.children || 0}
              payout={parseFloat(item.pending_payout_value ? item.pending_payout_value.replace(' HBD', '') : '0')}
              permlink={item.permlink}
              onUpvotePress={handleUpvotePress}
              onSpeechBubblePress={() => {
                router.push({ pathname: '/ConversationScreen', params: { author: item.author, permlink: item.permlink } });
              }}
              onContentPress={() => {
                router.push({ pathname: '/ConversationScreen', params: { author: item.author, permlink: item.permlink } });
              }}
              onUserPress={username => {
                router.push(`/ProfileScreen?username=${username}` as any);
              }}
              showAuthor
              onHashtagPress={tag => {
                router.push({ pathname: '/DiscoveryScreen', params: { hashtag: tag } });
              }}
            />
          )}
          contentContainerStyle={{ paddingBottom: 80 }}
          style={{ width: '100%' }}
        />
      )}
    </View>
  );
};

export default DiscoveryScreen;
