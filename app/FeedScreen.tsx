import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, useColorScheme, Dimensions, ActivityIndicator, FlatList } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Client } from '@hiveio/dhive';
import Snap from './components/Snap';

const twitterColors = {
  light: {
    background: '#FFFFFF',
    text: '#0F1419',
    button: '#1DA1F2',
    buttonText: '#FFFFFF',
    buttonInactive: '#E1E8ED',
    icon: '#1DA1F2',
  },
  dark: {
    background: '#15202B',
    text: '#D7DBDC',
    button: '#1DA1F2',
    buttonText: '#FFFFFF',
    buttonInactive: '#22303C',
    icon: '#1DA1F2',
  },
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_WIDTH = (SCREEN_WIDTH - 48) / 4; // 12px margin on each side, 8px between buttons

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

// Define a Snap type for Hive posts/comments
interface Snap {
  author: string;
  permlink: string;
  parent_author: string;
  parent_permlink: string;
  body: string;
  created: string;
  json_metadata?: string;
  posting_json_metadata?: string;
  [key: string]: any;
}

const FeedScreen = () => {
  console.log('FeedScreen mounted'); // Debug log

  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [activeFilter, setActiveFilter] = useState<'following' | 'newest' | 'trending' | 'my'>('newest');
  const [feedLoading, setFeedLoading] = useState(false);
  const colorScheme = useColorScheme() || 'light';
  const colors = twitterColors[colorScheme];
  const insets = useSafeAreaInsets();

  useEffect(() => {
    console.log('useEffect running'); // Debug log
    const fetchUser = async () => {
      setLoading(true);
      try {
        const storedUsername = await SecureStore.getItemAsync('hive_username');
        console.log('Stored username:', storedUsername);
        setUsername(storedUsername || '');
        if (storedUsername) {
          const accounts = await client.database.getAccounts([storedUsername]);
          console.log('Hive account object:', accounts && accounts[0]);
          let profileImg = '';
          // Try to get profile image from json_metadata first, then posting_json_metadata
          if (accounts && accounts[0]) {
            let meta = null;
            // Try json_metadata
            if (accounts[0].json_metadata) {
              try {
                meta = JSON.parse(accounts[0].json_metadata);
                console.log('json_metadata:', accounts[0].json_metadata);
              } catch (err) {
                console.log('Error parsing json_metadata:', err);
              }
            }
            // If no profile image in json_metadata, try posting_json_metadata
            if (!meta || !meta.profile || !meta.profile.profile_image) {
              if (accounts[0].posting_json_metadata) {
                try {
                  const postingMeta = JSON.parse(accounts[0].posting_json_metadata);
                  meta = postingMeta;
                  console.log('posting_json_metadata:', accounts[0].posting_json_metadata);
                } catch (err) {
                  console.log('Error parsing posting_json_metadata:', err);
                }
              }
            }
            if (meta && meta.profile && meta.profile.profile_image) {
              profileImg = meta.profile.profile_image;
              // Sanitize avatar URL to remove trailing slashes or backslashes
              profileImg = profileImg.replace(/[\\/]+$/, '');
              console.log('Parsed profile_image:', profileImg);
            } else {
              console.log('No profile_image found in metadata.');
            }
            setAvatarUrl(profileImg);
            console.log('Avatar URL set to:', profileImg);
          }
        }
      } catch (err) {
        setAvatarUrl('');
        console.log('Error fetching Hive user:', err);
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  // Enhance snaps with avatarUrl for Snap component
  const enhanceSnapsWithAvatar = async (snaps: Snap[]) => {
    // Get unique authors
    const authors = Array.from(new Set(snaps.map(s => s.author)));
    // Fetch accounts in batch
    let accounts: any[] = [];
    try {
      accounts = await client.database.getAccounts(authors);
    } catch (e) {
      console.log('Error fetching accounts for avatars:', e);
    }
    // Map author to avatarUrl
    const avatarMap: Record<string, string> = {};
    for (const acc of accounts) {
      let meta = null;
      if (acc.json_metadata) {
        try {
          meta = JSON.parse(acc.json_metadata);
        } catch {}
      }
      if ((!meta || !meta.profile || !meta.profile.profile_image) && acc.posting_json_metadata) {
        try {
          meta = JSON.parse(acc.posting_json_metadata);
        } catch {}
      }
      let url = meta && meta.profile && meta.profile.profile_image ? meta.profile.profile_image.replace(/[\\/]+$/, '') : '';
      avatarMap[acc.name] = url;
    }
    // Attach avatarUrl to each snap
    return snaps.map(snap => ({ ...snap, avatarUrl: avatarMap[snap.author] || '' }));
  };

  // Fetch Snaps (replies to @peak.snaps)
  const fetchSnaps = async () => {
    setFeedLoading(true);
    try {
      // Get latest posts by @peak.snaps
      const discussions = await client.database.call('get_discussions_by_blog', [{
        tag: 'peak.snaps',
        limit: 10
      }]);
      // For each post, get replies (snaps)
      let allSnaps: Snap[] = [];
      for (const post of discussions) {
        const replies: Snap[] = await client.database.call('get_content_replies', [post.author, post.permlink]);
        allSnaps = allSnaps.concat(replies);
      }
      // Optionally, sort by created date descending
      allSnaps.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      const enhanced = await enhanceSnapsWithAvatar(allSnaps);
      setSnaps(enhanced);
      console.log('Fetched snaps:', enhanced.length);
    } catch (err) {
      console.log('Error fetching snaps:', err);
    }
    setFeedLoading(false);
  };

  // Fetch Following Feed (snaps from users the current user follows)
  const fetchFollowingSnaps = async () => {
    setFeedLoading(true);
    if (!username) return;
    try {
      // 1. Get the list of accounts the user is following
      const followingResult = await client.call('condenser_api', 'get_following', [username, '', 'blog', 100]);
      const following = Array.isArray(followingResult)
        ? followingResult.map((f: any) => f.following)
        : (followingResult && followingResult.following) ? followingResult.following : [];
      console.log('Following:', following);
      // 2. Get latest posts by @peak.snaps (the container account)
      const containerPosts = await client.database.call('get_discussions_by_blog', [{ tag: 'peak.snaps', limit: 10 }]);
      let allSnaps: Snap[] = [];
      for (const post of containerPosts) {
        // 3. Get all replies to this post
        const replies: Snap[] = await client.database.call('get_content_replies', [post.author, post.permlink]);
        // 4. Filter replies to only those by followed users
        const filtered = replies.filter((reply) => following.includes(reply.author));
        allSnaps = allSnaps.concat(filtered);
      }
      // 5. Sort by created date descending
      allSnaps.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      const enhanced = await enhanceSnapsWithAvatar(allSnaps);
      setSnaps(enhanced);
      console.log('Fetched following snaps:', enhanced.length);
    } catch (err) {
      console.log('Error fetching following snaps:', err);
    }
    setFeedLoading(false);
  };

  // Fetch Trending Feed (snaps under latest @peak.snaps container, sorted by payout)
  const fetchTrendingSnaps = async () => {
    setFeedLoading(true);
    try {
      // Get the most recent post by @peak.snaps (container account)
      const discussions = await client.database.call('get_discussions_by_blog', [{
        tag: 'peak.snaps',
        limit: 1
      }]);
      let allSnaps: Snap[] = [];
      if (discussions && discussions.length > 0) {
        const post = discussions[0];
        // Get all replies (snaps) to the latest container post
        allSnaps = await client.database.call('get_content_replies', [post.author, post.permlink]);
        // Sort by payout (pending + total + curator) descending
        allSnaps.sort((a, b) => {
          const payoutA =
            parseFloat(a.pending_payout_value ? a.pending_payout_value.replace(' HBD', '') : '0') +
            parseFloat(a.total_payout_value ? a.total_payout_value.replace(' HBD', '') : '0') +
            parseFloat(a.curator_payout_value ? a.curator_payout_value.replace(' HBD', '') : '0');
          const payoutB =
            parseFloat(b.pending_payout_value ? b.pending_payout_value.replace(' HBD', '') : '0') +
            parseFloat(b.total_payout_value ? b.total_payout_value.replace(' HBD', '') : '0') +
            parseFloat(b.curator_payout_value ? b.curator_payout_value.replace(' HBD', '') : '0');
          return payoutB - payoutA;
        });
      }
      const enhanced = await enhanceSnapsWithAvatar(allSnaps);
      setSnaps(enhanced);
      console.log('Fetched trending snaps:', enhanced.length);
    } catch (err) {
      console.log('Error fetching trending snaps:', err);
    }
    setFeedLoading(false);
  };

  // Refetch snaps when activeFilter or username changes
  useEffect(() => {
    if (activeFilter === 'newest') {
      fetchSnaps();
    } else if (activeFilter === 'following' && username) {
      fetchFollowingSnaps();
    } else if (activeFilter === 'trending') {
      fetchTrendingSnaps();
    } else {
      setSnaps([]); // Placeholder for other filters
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, username]);

  // Handler for filter button presses
  const handleFilterPress = (filter: 'following' | 'newest' | 'trending' | 'my') => {
    setActiveFilter(filter);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top bar inside SafeAreaView for status bar/notch safety */}
      <SafeAreaView style={{ backgroundColor: colors.background, paddingTop: insets.top }} edges={['top']}>
        <View style={styles.topBar}>
          {/* User avatar instead of logo */}
          {loading ? (
            <ActivityIndicator size="small" color={colors.text} style={styles.avatar} />
          ) : (
            <Image
              source={avatarUrl ? { uri: avatarUrl } : require('../assets/images/logo.jpg')}
              style={styles.avatar}
            />
          )}
          <Text style={[styles.username, { color: colors.text }]}>{username}</Text>
          <TouchableOpacity style={styles.logoutBtn}>
            <FontAwesome name="sign-out" size={24} color={colors.icon} />
          </TouchableOpacity>
        </View>
        {/* Slogan row */}
        <View style={styles.sloganRow}>
          <Text style={[styles.slogan, { color: colors.text }]}>What's snappening today?</Text>
          <TouchableOpacity style={styles.bellBtn}>
            <FontAwesome name="bell" size={22} color={colors.icon} />
          </TouchableOpacity>
        </View>
        {/* Filter buttons */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: activeFilter === 'following' ? colors.button : colors.buttonInactive }]}
            onPress={() => handleFilterPress('following')}
          >
            <Text style={[styles.filterText, { color: activeFilter === 'following' ? colors.buttonText : colors.text }]}>Following</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: activeFilter === 'newest' ? colors.button : colors.buttonInactive }]}
            onPress={() => handleFilterPress('newest')}
          >
            <Text style={[styles.filterText, { color: activeFilter === 'newest' ? colors.buttonText : colors.text }]}>Newest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: activeFilter === 'trending' ? colors.button : colors.buttonInactive }]}
            onPress={() => handleFilterPress('trending')}
          >
            <Text style={[styles.filterText, { color: activeFilter === 'trending' ? colors.buttonText : colors.text }]}>Trending</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: activeFilter === 'my' ? colors.button : colors.buttonInactive }]}
            onPress={() => handleFilterPress('my')}
          >
            <Text style={[styles.filterText, { color: activeFilter === 'my' ? colors.buttonText : colors.text }]}>My Snaps</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      {/* Feed list */}
      <View style={styles.feedContainer}>
        {feedLoading ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <FontAwesome name="hourglass-half" size={48} color={colors.icon} style={{ marginBottom: 12, transform: [{ rotate: `${(Date.now() % 3600) / 10}deg` }] }} />
            <Text style={{ color: colors.text, fontSize: 16 }}>Loading snaps...</Text>
          </View>
        ) : snaps.length === 0 ? (
          <Text style={{ color: colors.text, marginTop: 24 }}>No snaps to display.</Text>
        ) : (
          <FlatList
            data={snaps}
            keyExtractor={(item) => item.author + '-' + item.permlink}
            renderItem={({ item }) => (
              <Snap
                author={item.author}
                avatarUrl={item.avatarUrl}
                body={item.body}
                created={item.created}
                voteCount={item.net_votes || 0}
                replyCount={item.children || 0}
                payout={parseFloat(item.pending_payout_value ? item.pending_payout_value.replace(' HBD', '') : '0')}
              />
            )}
            contentContainerStyle={{ alignItems: 'center', paddingBottom: 80 }}
          />
        )}
      </View>
      {/* Floating Action Button for New Snap, using safe area insets */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: colors.button,
            shadowColor: colorScheme === 'dark' ? '#000' : '#1DA1F2',
            bottom: insets.bottom + 24,
            right: insets.right + 24,
          },
        ]}
        activeOpacity={0.8}
        onPress={() => {/* TODO: Implement new snap action */}}
        accessibilityLabel="Create new snap"
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 32,
    paddingHorizontal: 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    backgroundColor: '#E1E8ED',
  },
  username: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  logoutBtn: {
    padding: 4,
    marginLeft: 8,
  },
  sloganRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  bellBtn: {
    marginLeft: 8,
    padding: 4,
  },
  slogan: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    textAlign: 'left',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  filterBtn: {
    flex: 1,
    marginHorizontal: 2,
    borderRadius: 8,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    fontSize: 15,
    fontWeight: '600',
  },
  feedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 2,
  },
});

export default FeedScreen;
