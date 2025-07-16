import React, { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { PrivateKey } from '@hiveio/dhive';
import { useColorScheme } from 'react-native';
import { View, FlatList, Text, ActivityIndicator, Modal, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateVoteValue } from '../utils/calculateVoteValue';
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


const AVATAR_CACHE_TTL = 1000 * 60 * 60 * 24 * 3; // 3 days

const DiscoveryScreen = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = twitterColors[colorScheme];
  const router = useRouter();
  const { hashtag } = useLocalSearchParams<{ hashtag: string }>();

  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarCache, setAvatarCache] = useState<{ [username: string]: { url: string; ts: number } }>({});


  // Avatar fetching/caching helpers
  const getAvatarUrl = (username: string) =>
    `https://images.hive.blog/u/${username}/avatar/original`;

  // Load avatar cache from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const cacheStr = await AsyncStorage.getItem('hivesnaps_avatar_cache');
        if (cacheStr) {
          setAvatarCache(JSON.parse(cacheStr));
        }
      } catch {}
    })();
  }, []);

  // Save avatar cache to AsyncStorage when it changes
  useEffect(() => {
    AsyncStorage.setItem('hivesnaps_avatar_cache', JSON.stringify(avatarCache)).catch(() => {});
  }, [avatarCache]);

  // Refactor: extract fetchHashtagSnaps for reuse, accept username as parameter
  const fetchHashtagSnaps = async (currentUsername?: string) => {
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

      // Fetch avatars for all unique authors
      const now = Date.now();
      const uniqueAuthors = Array.from(new Set(allSnaps.map(s => s.author)));
      const newCache = { ...avatarCache };
      const avatarFetchPromises = uniqueAuthors.map(async username => {
        // Use cache if not expired
        if (newCache[username] && now - newCache[username].ts < AVATAR_CACHE_TTL) {
          return;
        }
        // Check if user has custom avatar (by checking if the image exists)
        const url = getAvatarUrl(username);
        try {
          const res = await fetch(url, { method: 'HEAD' });
          if (res.ok) {
            newCache[username] = { url, ts: now };
          } else {
            newCache[username] = { url: '', ts: now };
          }
        } catch {
          newCache[username] = { url: '', ts: now };
        }
      });
      await Promise.all(avatarFetchPromises);
      setAvatarCache(newCache);

      // Attach avatarUrl and hasUpvoted to each snap
      const snapsWithAvatars = allSnaps.map(snap => {
        const hasUpvoted = Array.isArray(snap.active_votes) && currentUsername && snap.active_votes.some((v: any) => v.voter === currentUsername && v.percent > 0);
        return {
          ...snap,
          avatarUrl: newCache[snap.author]?.url || '',
          hasUpvoted: !!hasUpvoted,
        };
      });
      setSnaps(snapsWithAvatars);
    } catch (err) {
      setSnaps([]);
    }
    setLoading(false);
  };

  // Load username from SecureStore before fetching snaps
  useEffect(() => {
    const loadUsernameAndFetch = async () => {
      const storedUsername = await SecureStore.getItemAsync('hive_username');
      if (storedUsername) setUsername(storedUsername);
      // Only pass string or undefined, never null
      if (hashtag) fetchHashtagSnaps(storedUsername ?? undefined);
    };
    loadUsernameAndFetch();
  }, [hashtag]);


  // Upvote modal state and logic (copied/adapted from FeedScreen)
  const [upvoteModalVisible, setUpvoteModalVisible] = useState(false);
  const [upvoteTarget, setUpvoteTarget] = useState<{ author: string; permlink: string } | null>(null);
  const [voteWeight, setVoteWeight] = useState(100);
  const [voteWeightLoading, setVoteWeightLoading] = useState(false);
  const [upvoteLoading, setUpvoteLoading] = useState(false);
  const [upvoteSuccess, setUpvoteSuccess] = useState(false);
  const [voteValue, setVoteValue] = useState<{ hbd: string, usd: string } | null>(null);
  const [username, setUsername] = useState('');
  const [globalProps, setGlobalProps] = useState<any | null>(null);
  const [rewardFund, setRewardFund] = useState<any | null>(null);
  const [hivePrice, setHivePrice] = useState<number>(1);
  // Fetch Hive global properties, reward fund, and price on mount
  useEffect(() => {
    const fetchHiveProps = async () => {
      try {
        const props = await client.database.getDynamicGlobalProperties();
        setGlobalProps(props);
        const fund = await client.database.call('get_reward_fund', ['post']);
        setRewardFund(fund);
      } catch (err) {
        setGlobalProps(null);
        setRewardFund(null);
      }
    };
    fetchHiveProps();
    // Fetch HIVE price (reuse logic from FeedScreen if available)
    const fetchHivePrice = async () => {
      try {
        // You may want to use a shared utility for this
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=hive&vs_currencies=usd');
        const data = await res.json();
        setHivePrice(data.hive?.usd || 1);
      } catch {
        setHivePrice(1);
      }
    };
    fetchHivePrice();
    // Remove AsyncStorage username fetch, now handled in hashtag effect
  }, []);

  const handleUpvotePress = async ({ author, permlink }: { author: string; permlink: string }) => {
    setUpvoteTarget({ author, permlink });
    setVoteWeightLoading(true);
    try {
      // Load last used vote weight if available
      const val = await AsyncStorage.getItem('hivesnaps_vote_weight');
      const weight = val !== null ? Number(val) : 100;
      setVoteWeight(weight);
      // Ensure globalProps and rewardFund are loaded before calculating vote value
      if (!globalProps || !rewardFund) {
        const props = await client.database.getDynamicGlobalProperties();
        setGlobalProps(props);
        const fund = await client.database.call('get_reward_fund', ['post']);
        setRewardFund(fund);
      }
      // Calculate vote value if possible
      let accountObj = null;
      if (username) {
        const accounts = await client.database.getAccounts([username]);
        accountObj = accounts && accounts[0] ? accounts[0] : null;
      }
      if (accountObj && globalProps && rewardFund) {
        const calcValue = calculateVoteValue(accountObj, globalProps, rewardFund, weight, hivePrice);
        setVoteValue(calcValue);
      } else {
        setVoteValue(null);
      }
    } finally {
      setVoteWeightLoading(false);
      setUpvoteModalVisible(true);
    }
  };

  const handleUpvoteCancel = () => {
    setUpvoteModalVisible(false);
    setUpvoteTarget(null);
    setVoteValue(null);
    // Do not reset voteWeight, keep last used value
  };

  const handleUpvoteConfirm = async () => {
    if (!upvoteTarget) return;
    setUpvoteLoading(true);
    setUpvoteSuccess(false);
    try {
      // Get posting key from SecureStore
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) throw new Error('No posting key found. Please log in again.');
      const postingKey = PrivateKey.fromString(postingKeyStr);
      // Broadcast vote
      await client.broadcast.vote({
        voter: username,
        author: upvoteTarget.author,
        permlink: upvoteTarget.permlink,
        weight: voteWeight * 100, // dhive expects 10000 = 100%
      }, postingKey);
      // Persist the vote weight after successful vote
      await AsyncStorage.setItem('hivesnaps_vote_weight', String(voteWeight));

      // Update snap in state to reflect upvote
      setSnaps(prevSnaps => prevSnaps.map(snap => {
        if (snap.author === upvoteTarget.author && snap.permlink === upvoteTarget.permlink) {
          return {
            ...snap,
            hasUpvoted: true,
            net_votes: (snap.net_votes || 0) + 1,
            active_votes: Array.isArray(snap.active_votes)
              ? [...snap.active_votes, { voter: username, percent: voteWeight * 100 }]
              : [{ voter: username, percent: voteWeight * 100 }],
          };
        }
        return snap;
      }));

      // Refresh snaps from blockchain after upvote
      await fetchHashtagSnaps(username);

      setUpvoteLoading(false);
      setUpvoteSuccess(true);
      // Close modal after short delay, then immediately reset upvote state
      setTimeout(() => {
        setUpvoteModalVisible(false);
        setUpvoteSuccess(false);
        setUpvoteTarget(null);
        setVoteValue(null);
      }, 1200);
    } catch {
      setUpvoteLoading(false);
      setUpvoteSuccess(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Upvote Modal (copied/adapted from FeedScreen) */}
      <Modal
        visible={upvoteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleUpvoteCancel}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 24, width: '85%', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Upvote Snap</Text>
            <Text style={{ color: colors.text, fontSize: 15, marginBottom: 16 }}>Vote Weight: {voteWeight}%</Text>
            {voteWeightLoading ? (
              <ActivityIndicator size="small" color={colors.button} style={{ marginVertical: 16 }} />
            ) : (
              <>
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={1}
                  maximumValue={100}
                  step={1}
                  value={voteWeight}
                  onValueChange={async val => {
                    setVoteWeight(val);
                    // Live update vote value
                    let accountObj = null;
                    if (username) {
                      const accounts = await client.database.getAccounts([username]);
                      accountObj = accounts && accounts[0] ? accounts[0] : null;
                    }
                    if (accountObj && globalProps && rewardFund) {
                      const calcValue = calculateVoteValue(accountObj, globalProps, rewardFund, val, hivePrice);
                      setVoteValue(calcValue);
                    } else {
                      setVoteValue(null);
                    }
                  }}
                  onSlidingComplete={async val => {
                    setVoteWeight(val);
                    // Live update vote value
                    let accountObj = null;
                    if (username) {
                      const accounts = await client.database.getAccounts([username]);
                      accountObj = accounts && accounts[0] ? accounts[0] : null;
                    }
                    if (accountObj && globalProps && rewardFund) {
                      const calcValue = calculateVoteValue(accountObj, globalProps, rewardFund, val, hivePrice);
                      setVoteValue(calcValue);
                    } else {
                      setVoteValue(null);
                    }
                  }}
                  minimumTrackTintColor={colors.button}
                  maximumTrackTintColor={colors.buttonInactive}
                  thumbTintColor={colors.button}
                />
                {/* Show only USD value below slider, live update */}
                {voteValue !== null && (
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginTop: 12 }}>
                    ${voteValue.usd} USD
                  </Text>
                )}
              </>
            )}
            {upvoteLoading ? (
              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.icon} />
                <Text style={{ color: colors.text, marginTop: 8 }}>Submitting vote...</Text>
              </View>
            ) : upvoteSuccess ? (
              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <Text style={{ color: colors.button, fontSize: 18, fontWeight: 'bold' }}>Upvote successful!</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', marginTop: 24 }}>
                <Pressable
                  style={{ flex: 1, marginRight: 8, backgroundColor: colors.buttonInactive, borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={handleUpvoteCancel}
                  disabled={upvoteLoading}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={{ flex: 1, marginLeft: 8, backgroundColor: colors.button, borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={handleUpvoteConfirm}
                  disabled={upvoteLoading}
                >
                  <Text style={{ color: colors.buttonText, fontWeight: '600' }}>Confirm</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
              hasUpvoted={item.hasUpvoted}
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
          refreshing={loading}
          onRefresh={fetchHashtagSnaps}
        />
      )}
    </View>
  );
};

export default DiscoveryScreen;
