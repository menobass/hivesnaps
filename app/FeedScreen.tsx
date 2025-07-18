import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, useColorScheme, Dimensions, ActivityIndicator, FlatList, Modal, Pressable, Platform, TextInput, KeyboardAvoidingView } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Client, PrivateKey } from '@hiveio/dhive';
import Snap from './components/Snap';
import NotificationBadge from './components/NotificationBadge';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import { uploadImageToCloudinaryFixed } from '../utils/cloudinaryImageUploadFixed';
import { useNotifications } from '../hooks/useNotifications';
import { useVotingPower } from '../hooks/useVotingPower';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ConversationScreen from './ConversationScreen';
import ImageView from 'react-native-image-viewing';
import { calculateVoteValue } from '../utils/calculateVoteValue';
import { getHivePriceUSD } from '../utils/getHivePrice';


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
  // HIVE price in USD for vote value calculation
  const [hivePrice, setHivePrice] = useState<number>(1);

  // Fetch HIVE price on mount
  useEffect(() => {
    const fetchHivePrice = async () => {
      try {
        const price = await getHivePriceUSD();
        if (price > 0) setHivePrice(price);
      } catch (err) {
        console.log('[HivePriceDebug] Error fetching HIVE price:', err);
        setHivePrice(1);
      }
    };
    fetchHivePrice();
  }, []);
  // Hive reward fund for vote value calculation
  const [rewardFund, setRewardFund] = useState<any | null>(null);

  // Fetch Hive global properties and reward fund on mount
  useEffect(() => {
    const fetchHiveProps = async () => {
      try {
        const props = await client.database.getDynamicGlobalProperties();
        setGlobalProps(props);
        const fund = await client.database.call('get_reward_fund', ['post']);
        setRewardFund(fund);
      } catch (err) {
        console.log('Error fetching Hive globalProps or rewardFund:', err);
        setGlobalProps(null);
        setRewardFund(null);
      }
    };
    fetchHiveProps();
  }, []);
  console.log('FeedScreen mounted'); // Debug log

  const [username, setUsername] = useState('');
  // Estimated Hive vote value for upvote modal
  const [voteValue, setVoteValue] = useState<{ hbd: string, usd: string } | null>(null);
  // Hive global properties for vote value calculation
  const [globalProps, setGlobalProps] = useState<any | null>(null);
  // Fetch Hive global properties on mount
  useEffect(() => {
    const fetchGlobalProps = async () => {
      try {
        const props = await client.database.getDynamicGlobalProperties();
        setGlobalProps(props);
      } catch (err) {
        console.log('Error fetching Hive globalProps:', err);
        setGlobalProps(null);
      }
    };
    fetchGlobalProps();
  }, []);
  // Voting Power info modal state
  const [vpInfoModalVisible, setVpInfoModalVisible] = useState(false);
  // Voting power hook
  const { votingPower, loading: vpLoading, error: vpError } = useVotingPower(username);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [activeFilter, setActiveFilter] = useState<'following' | 'newest' | 'trending' | 'my'>('newest');
  const [feedLoading, setFeedLoading] = useState(false);
  const [hasUnclaimedRewards, setHasUnclaimedRewards] = useState(false);
  // Cache for snaps and avatars
  const [snapsCache, setSnapsCache] = useState<Record<string, Snap[]>>({});
  const [avatarCache, setAvatarCache] = useState<Record<string, { url: string; timestamp: number }>>({});
  const [lastFetchTime, setLastFetchTime] = useState<Record<string, number>>({});
  const [upvoteModalVisible, setUpvoteModalVisible] = useState(false);
  const [upvoteTarget, setUpvoteTarget] = useState<{ author: string; permlink: string } | null>(null);
  // Local state for upvote slider
  const [voteWeight, setVoteWeight] = useState(100);
  const [voteWeightLoading, setVoteWeightLoading] = useState(false);
  const [upvoteLoading, setUpvoteLoading] = useState(false);
  const [upvoteSuccess, setUpvoteSuccess] = useState(false);
  // --- New Snap Modal State ---
  const [newSnapModalVisible, setNewSnapModalVisible] = useState(false);
  const [newSnapText, setNewSnapText] = useState('');
  const [newSnapImage, setNewSnapImage] = useState<string | null>(null);
  const [newSnapLoading, setNewSnapLoading] = useState(false);
  const [newSnapSuccess, setNewSnapSuccess] = useState(false);
  const [newSnapUploading, setNewSnapUploading] = useState(false);
  // Image modal state
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [modalImages, setModalImages] = useState<Array<{uri: string}>>([]);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const colorScheme = useColorScheme() || 'light';
  const colors = twitterColors[colorScheme];
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<any>>(null); // FlatList ref for scroll control
  const [pendingScrollToKey, setPendingScrollToKey] = useState<string | null>(null); // Key to scroll to after refresh
  const [viewableSnaps, setViewableSnaps] = useState<string[]>([]); // Track visible snap keys
  const [viewableItems, setViewableItems] = useState<any[]>([]); // Track visible items
  const router = useRouter();

  // Notifications
  const { unreadCount } = useNotifications(username || null);

  // Viewability config for FlatList
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 60, // Consider item visible if 60% is shown
  };
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    setViewableItems(viewableItems);
  }).current;

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
          // Try to get profile image from posting_json_metadata first (most current), then fallback to json_metadata
          if (accounts && accounts[0]) {
            let meta = null;
            // Try posting_json_metadata first (most up-to-date)
            if (accounts[0].posting_json_metadata) {
              try {
                meta = JSON.parse(accounts[0].posting_json_metadata);
                console.log('posting_json_metadata:', accounts[0].posting_json_metadata);
              } catch (err) {
                console.log('Error parsing posting_json_metadata:', err);
              }
            }
            // If no profile image in posting_json_metadata, fallback to json_metadata
            if (!meta || !meta.profile || !meta.profile.profile_image) {
              if (accounts[0].json_metadata) {
                try {
                  const jsonMeta = JSON.parse(accounts[0].json_metadata);
                  meta = jsonMeta;
                  console.log('json_metadata (fallback):', accounts[0].json_metadata);
                } catch (err) {
                  console.log('Error parsing json_metadata:', err);
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
            
            // Check for unclaimed rewards
            // Handle both Asset objects and string formats
            const parseRewardBalance = (balance: any, symbol: string) => {
              if (!balance) return 0;
              if (typeof balance === 'object' && balance.amount !== undefined) {
                // Asset object format
                return parseFloat(balance.amount) || 0;
              } else if (typeof balance === 'string') {
                // String format like "0.000 HIVE"
                return parseFloat(balance.replace(` ${symbol}`, '')) || 0;
              } else {
                // Try converting to string and parsing
                return parseFloat(balance.toString().replace(` ${symbol}`, '')) || 0;
              }
            };
            
            const unclaimedHive = parseRewardBalance(accounts[0].reward_hive_balance, 'HIVE');
            const unclaimedHbd = parseRewardBalance(accounts[0].reward_hbd_balance, 'HBD');
            const unclaimedVests = parseRewardBalance(accounts[0].reward_vesting_balance, 'VESTS');
            
            const hasRewards = unclaimedHive > 0 || unclaimedHbd > 0 || unclaimedVests > 0;
            setHasUnclaimedRewards(hasRewards);
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

  // Enhanced avatar fetching with time-based caching
  const enhanceSnapsWithAvatar = async (snaps: Snap[]) => {
    // Get unique authors not already in cache or with expired cache
    const authors = Array.from(new Set(snaps.map(s => s.author)));
    const now = Date.now();
    const AVATAR_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    // Helper to update snaps state for a given author
    const updateSnapsWithAvatar = (author: string, url: string) => {
      setSnaps(prevSnaps => prevSnaps.map(snap =>
        snap.author === author ? { ...snap, avatarUrl: url } : snap
      ));
    };

    const uncachedAuthors = authors.filter(author => {
      const cached = avatarCache[author];
      return !cached || (now - cached.timestamp) > AVATAR_CACHE_DURATION;
    });

    // Only fetch accounts for authors not in cache or with expired cache
    if (uncachedAuthors.length > 0) {
      try {
        const accounts = await client.database.getAccounts(uncachedAuthors);
        for (const acc of accounts) {
          let meta = null;
          // Try posting_json_metadata first (most up-to-date)
          if (acc.posting_json_metadata) {
            try {
              meta = JSON.parse(acc.posting_json_metadata);
            } catch {}
          }
          // Fallback to json_metadata if posting_json_metadata doesn't have profile image
          if ((!meta || !meta.profile || !meta.profile.profile_image) && acc.json_metadata) {
            try {
              meta = JSON.parse(acc.json_metadata);
            } catch {}
          }
          const url = meta && meta.profile && meta.profile.profile_image
            ? meta.profile.profile_image.replace(/[\\/]+$/, '')
            : '';
          // Update avatar cache for this author
          setAvatarCache(prev => ({ ...prev, [acc.name]: { url, timestamp: now } }));
          // Progressive update: update snaps state for this author
          updateSnapsWithAvatar(acc.name, url);
        }
      } catch (e) {
        console.log('Error fetching accounts for avatars:', e);
      }
    }

    // After all, ensure all snaps have the latest avatar URLs (from cache)
    return snaps.map(snap => ({
      ...snap,
      avatarUrl: avatarCache[snap.author]?.url || ''
    }));
  };

  // Cache management - 5 minute cache
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const isCacheValid = (filterKey: string) => {
    const lastFetch = lastFetchTime[filterKey];
    return lastFetch && (Date.now() - lastFetch) < CACHE_DURATION;
  };

  const getCachedSnaps = (filterKey: string) => {
    if (isCacheValid(filterKey) && snapsCache[filterKey]) {
      return snapsCache[filterKey];
    }
    return null;
  };

  const setCachedSnaps = (filterKey: string, snaps: Snap[]) => {
    setSnapsCache(prev => ({ ...prev, [filterKey]: snaps }));
    setLastFetchTime(prev => ({ ...prev, [filterKey]: Date.now() }));
  };

  // Optimized Fetch Snaps (replies to @peak.snaps) with caching
  const fetchSnaps = async (useCache = true) => {
    const cacheKey = 'newest';
    
    // Check cache first
    if (useCache) {
      const cachedSnaps = getCachedSnaps(cacheKey);
      if (cachedSnaps) {
        console.log('Using cached snaps for newest feed');
        setSnaps(cachedSnaps);
        return;
      }
    }
    
    setFeedLoading(true);
    try {
      // Optimized: Get fewer container posts initially, focus on most recent
      const discussions = await client.database.call('get_discussions_by_blog', [{
        tag: 'peak.snaps',
        limit: 3 // Reduced from 10 to 3 for faster loading
      }]);
      
      let allSnaps: Snap[] = [];
      
      // Process container posts in parallel for better performance
      const snapPromises = discussions.map(async (post: any) => {
        try {
          const replies: Snap[] = await client.database.call('get_content_replies', [post.author, post.permlink]);
          return replies;
        } catch (err) {
          console.log('Error fetching replies for post:', post.permlink, err);
          return [];
        }
      });
      
      const snapResults = await Promise.all(snapPromises);
      allSnaps = snapResults.flat();
      
      // Sort by created date descending
      allSnaps.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      
      // Limit to most recent 50 snaps for better performance
      const limitedSnaps = allSnaps.slice(0, 50);
      
      const enhanced = await enhanceSnapsWithAvatar(limitedSnaps);
      setSnaps(enhanced);
      setCachedSnaps(cacheKey, enhanced);
      console.log('Fetched and cached snaps:', enhanced.length);
    } catch (err) {
      console.log('Error fetching snaps:', err);
    }
    setFeedLoading(false);
  };

  // Optimized Following Feed with caching
  const fetchFollowingSnaps = async (useCache = true) => {
    const cacheKey = 'following';
    
    // Check cache first
    if (useCache) {
      const cachedSnaps = getCachedSnaps(cacheKey);
      if (cachedSnaps) {
        console.log('Using cached snaps for following feed');
        setSnaps(cachedSnaps);
        return;
      }
    }
    
    setFeedLoading(true);
    if (!username) return;
    try {
      // Get following list
      const followingResult = await client.call('condenser_api', 'get_following', [username, '', 'blog', 100]);
      const following = Array.isArray(followingResult)
        ? followingResult.map((f: any) => f.following)
        : (followingResult && followingResult.following) ? followingResult.following : [];
      console.log('Following:', following);
      
      // Get fewer container posts for faster loading
      const containerPosts = await client.database.call('get_discussions_by_blog', [{ tag: 'peak.snaps', limit: 3 }]);
      
      // Process in parallel
      const snapPromises = containerPosts.map(async (post: any) => {
        try {
          const replies: Snap[] = await client.database.call('get_content_replies', [post.author, post.permlink]);
          return replies.filter((reply) => following.includes(reply.author));
        } catch (err) {
          console.log('Error fetching replies for post:', post.permlink, err);
          return [];
        }
      });
      
      const snapResults = await Promise.all(snapPromises);
      let allSnaps = snapResults.flat();
      
      // Sort and limit
      allSnaps.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      const limitedSnaps = allSnaps.slice(0, 50);
      
      const enhanced = await enhanceSnapsWithAvatar(limitedSnaps);
      setSnaps(enhanced);
      setCachedSnaps(cacheKey, enhanced);
      console.log('Fetched and cached following snaps:', enhanced.length);
    } catch (err) {
      console.log('Error fetching following snaps:', err);
    }
    setFeedLoading(false);
  };

  // Optimized Trending Feed with caching
  const fetchTrendingSnaps = async (useCache = true) => {
    const cacheKey = 'trending';
    
    // Check cache first
    if (useCache) {
      const cachedSnaps = getCachedSnaps(cacheKey);
      if (cachedSnaps) {
        console.log('Using cached snaps for trending feed');
        setSnaps(cachedSnaps);
        return;
      }
    }
    
    setFeedLoading(true);
    try {
      // Get recent container posts (same as newest feed for consistency)
      const discussions = await client.database.call('get_discussions_by_blog', [{
        tag: 'peak.snaps',
        limit: 3 // Changed from 1 to 3 to match other feeds
      }]);
      
      let allSnaps: Snap[] = [];
      
      // Process container posts in parallel for better performance
      const snapPromises = discussions.map(async (post: any) => {
        try {
          const replies: Snap[] = await client.database.call('get_content_replies', [post.author, post.permlink]);
          return replies;
        } catch (err) {
          console.log('Error fetching replies for post:', post.permlink, err);
          return [];
        }
      });
      
      const snapResults = await Promise.all(snapPromises);
      allSnaps = snapResults.flat();
      
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
      
      // Limit to most recent 50 snaps for better performance
      const limitedSnaps = allSnaps.slice(0, 50);
      
      const enhanced = await enhanceSnapsWithAvatar(limitedSnaps);
      setSnaps(enhanced);
      setCachedSnaps(cacheKey, enhanced);
      console.log('Fetched and cached trending snaps:', enhanced.length);
    } catch (err) {
      console.log('Error fetching trending snaps:', err);
    }
    setFeedLoading(false);
  };

  // Optimized My Snaps Feed with caching
  const fetchMySnaps = async (useCache = true) => {
    const cacheKey = `my-${username}`;
    
    // Check cache first
    if (useCache) {
      const cachedSnaps = getCachedSnaps(cacheKey);
      if (cachedSnaps) {
        console.log('Using cached snaps for my snaps feed');
        setSnaps(cachedSnaps);
        return;
      }
    }
    
    setFeedLoading(true);
    try {
      // Get recent container posts (same as other feeds for consistency)
      const discussions = await client.database.call('get_discussions_by_blog', [{
        tag: 'peak.snaps',
        limit: 3 // Changed from 1 to 3 to match other feeds
      }]);
      
      let mySnaps: Snap[] = [];
      
      if (discussions && discussions.length > 0 && username) {
        // Process container posts in parallel for better performance
        const snapPromises = discussions.map(async (post: any) => {
          try {
            const replies: Snap[] = await client.database.call('get_content_replies', [post.author, post.permlink]);
            // Filter to only those by the logged-in user
            return replies.filter((reply) => reply.author === username);
          } catch (err) {
            console.log('Error fetching replies for post:', post.permlink, err);
            return [];
          }
        });
        
        const snapResults = await Promise.all(snapPromises);
        mySnaps = snapResults.flat();
        
        // Sort by created date descending
        mySnaps.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
        
        // Limit for performance
        mySnaps = mySnaps.slice(0, 50);
      }
      
      const enhanced = await enhanceSnapsWithAvatar(mySnaps);
      setSnaps(enhanced);
      setCachedSnaps(cacheKey, enhanced);
      console.log('Fetched and cached my snaps:', enhanced.length);
    } catch (err) {
      console.log('Error fetching my snaps:', err);
    }
    setFeedLoading(false);
  };

  // Refetch snaps when activeFilter or username changes
  useEffect(() => {
    if (activeFilter === 'newest') {
      fetchSnaps(true); // Use cache
    } else if (activeFilter === 'following' && username) {
      fetchFollowingSnaps(true); // Use cache
    } else if (activeFilter === 'trending') {
      fetchTrendingSnaps(true); // Use cache
    } else if (activeFilter === 'my' && username) {
      fetchMySnaps(true); // Use cache
    } else {
      setSnaps([]); // Placeholder for other filters
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, username]);

  // Handler for filter button presses with immediate cache loading
  const handleFilterPress = (filter: 'following' | 'newest' | 'trending' | 'my') => {
    setActiveFilter(filter);
    
    // Immediately show cached content if available for instant UI response
    const cacheKey = filter === 'my' ? `my-${username}` : filter;
    const cachedSnaps = getCachedSnaps(cacheKey);
    if (cachedSnaps) {
      setSnaps(cachedSnaps);
    }
  };

  // Corrected: Accepts { author, permlink } object
  const handleUpvotePress = async ({ author, permlink }: { author: string; permlink: string }) => {
    setUpvoteTarget({ author, permlink });
    setVoteWeightLoading(true);
    try {
      const val = await AsyncStorage.getItem('hivesnaps_vote_weight');
      const weight = val !== null ? Number(val) : 100;
      setVoteWeight(weight);
      // Fetch account object for vote value calculation
      let accountObj = null;
      if (username) {
        const accounts = await client.database.getAccounts([username]);
        accountObj = accounts && accounts[0] ? accounts[0] : null;
      }
      // Calculate initial vote value
      if (accountObj && globalProps && rewardFund) {
        console.log('[VoteValueDebug] accountObj:', accountObj);
        console.log('[VoteValueDebug] globalProps:', globalProps);
        console.log('[VoteValueDebug] rewardFund:', rewardFund);
        console.log('[VoteValueDebug] hivePrice:', hivePrice);
        const calcValue = calculateVoteValue(accountObj, globalProps, rewardFund, weight, hivePrice);
        console.log('[VoteValueDebug] calculateVoteValue result:', calcValue);
        setVoteValue(calcValue);
      } else {
        setVoteValue(null);
      }
    } catch {
      setVoteWeight(100);
      let accountObj = null;
      if (username) {
        const accounts = await client.database.getAccounts([username]);
        accountObj = accounts && accounts[0] ? accounts[0] : null;
      }
      if (accountObj && globalProps && rewardFund) {
        console.log('[VoteValueDebug] accountObj:', accountObj);
        console.log('[VoteValueDebug] globalProps:', globalProps);
        console.log('[VoteValueDebug] rewardFund:', rewardFund);
        console.log('[VoteValueDebug] hivePrice:', hivePrice);
        const calcValue = calculateVoteValue(accountObj, globalProps, rewardFund, 100, hivePrice);
        console.log('[VoteValueDebug] calculateVoteValue result:', calcValue);
        setVoteValue(calcValue);
      } else {
        setVoteValue(null);
      }
    }
    setVoteWeightLoading(false);
    setUpvoteModalVisible(true);
    setPendingScrollToKey(author + '-' + permlink); // Remember which snap to scroll to
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
      // Retrieve posting key from secure store
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) throw new Error('No posting key found. Please log in again.');
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Ecency-style weight: 1-100% slider maps to -10000 to 10000 (positive for upvote)
      // Ecency rounds to nearest 100 (1%)
      let weight = Math.round(voteWeight * 100);
      if (weight > 10000) weight = 10000;
      if (weight < 1) weight = 1;

      // Use dhive to broadcast vote
      await client.broadcast.vote(
        {
          voter: username,
          author: upvoteTarget.author,
          permlink: upvoteTarget.permlink,
          weight,
        },
        postingKey
      );

      // Persist the vote weight after successful vote
      await AsyncStorage.setItem('hivesnaps_vote_weight', String(voteWeight));

      setUpvoteLoading(false);
      setUpvoteSuccess(true);
      // Refresh feed and scroll to upvoted snap after short delay
      setTimeout(async () => {
        setUpvoteModalVisible(false);
        setUpvoteSuccess(false);
        setUpvoteTarget(null);
        // Refresh feed
        if (activeFilter === 'newest') await fetchSnaps(false); // Force refresh
        else if (activeFilter === 'following') await fetchFollowingSnaps(false);
        else if (activeFilter === 'trending') await fetchTrendingSnaps(false);
        else if (activeFilter === 'my') await fetchMySnaps(false);
        // Scrolling will be handled in useEffect below
      }, 2000);
    } catch (err) {
      setUpvoteLoading(false);
      setUpvoteSuccess(false);
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      alert('Upvote failed: ' + errorMsg);
    }
  };

  // ---
  // WISHLIST / WORK IN PROGRESS:
  // The following scroll-to-upvoted Snap logic is intended to bring the upvoted Snap into view after voting.
  // However, with variable-height FlatList items, this does not reliably center or scroll to the correct Snap.
  // As of now, this feature is NOT working as intended. If you have experience with FlatList and dynamic item heights,
  // please help improve or fix this logic! See related discussion in commit and/or GitHub issue.
  // ---
  // Scroll to upvoted snap after snaps update if needed
  useEffect(() => {
    if (pendingScrollToKey && snaps.length > 0 && flatListRef.current) {
      const idx = snaps.findIndex(s => (s.author + '-' + s.permlink) === pendingScrollToKey);
      console.log('[ScrollDebug] pendingScrollToKey:', pendingScrollToKey);
      console.log('[ScrollDebug] snaps.length:', snaps.length);
      console.log('[ScrollDebug] found index:', idx);
      // Always scroll to the Snap if found, regardless of isVisible
      if (idx >= 0) {
        setTimeout(() => {
          console.log('[ScrollDebug] Forcing scroll to index:', idx);
          flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 }); // Center it if possible
          setPendingScrollToKey(null);
        }, 600); // Wait for FlatList to render
      } else {
        console.log('[ScrollDebug] Snap not found in refreshed snaps.');
        setPendingScrollToKey(null);
      }
    }
  }, [snaps, pendingScrollToKey]);

  // --- New Snap Modal Handlers ---
  const openNewSnapModal = () => {
    setNewSnapText('');
    setNewSnapImage(null);
    setNewSnapSuccess(false);
    setNewSnapModalVisible(true);
  };
  const closeNewSnapModal = () => {
    setNewSnapModalVisible(false);
    setNewSnapText('');
    setNewSnapImage(null);
    setNewSnapSuccess(false);
  };
  const handleAddImage = async () => {
    try {
      // Show action sheet to choose between camera and gallery
      let pickType: 'camera' | 'gallery' | 'cancel';
      
      if (Platform.OS === 'ios') {
        pickType = await new Promise<'camera' | 'gallery' | 'cancel'>(resolve => {
          import('react-native').then(({ ActionSheetIOS }) => {
            ActionSheetIOS.showActionSheetWithOptions(
              {
                options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
                cancelButtonIndex: 0,
              },
              buttonIndex => {
                if (buttonIndex === 0) resolve('cancel');
                else if (buttonIndex === 1) resolve('camera');
                else if (buttonIndex === 2) resolve('gallery');
              }
            );
          });
        });
      } else {
        pickType = await new Promise<'camera' | 'gallery' | 'cancel'>(resolve => {
          import('react-native').then(({ Alert }) => {
            Alert.alert(
              'Add Image',
              'Choose an option',
              [
                { text: 'Take Photo', onPress: () => resolve('camera') },
                { text: 'Choose from Gallery', onPress: () => resolve('gallery') },
                { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
              ],
              { cancelable: true }
            );
          });
        });
      }
      
      if (pickType === 'cancel') return;
      
      // Enhanced permission handling with better error messages
      let result;
      if (pickType === 'camera') {
        // Check current permission status first
        const currentPermission = await ImagePicker.getCameraPermissionsAsync();
        let finalStatus = currentPermission.status;
        
        if (finalStatus !== 'granted') {
          // Request permission if not granted
          const requestPermission = await ImagePicker.requestCameraPermissionsAsync();
          finalStatus = requestPermission.status;
        }
        
        if (finalStatus !== 'granted') {
          import('react-native').then(({ Alert }) => {
            Alert.alert(
              'Camera Permission Required',
              'HiveSnaps needs camera access to take photos. Please enable camera permissions in your device settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => {
                  if (Platform.OS === 'ios') {
                    import('expo-linking').then(({ default: Linking }) => {
                      Linking.openURL('app-settings:');
                    });
                  } else {
                    import('expo-intent-launcher').then(({ default: IntentLauncher }) => {
                      IntentLauncher.startActivityAsync(
                        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
                        { data: 'package:com.anonymous.hivesnaps' }
                      );
                    }).catch(() => {
                      // Fallback for older Android versions
                      import('expo-linking').then(({ default: Linking }) => {
                        Linking.openURL('app-settings:');
                      });
                    });
                  }
                }}
              ]
            );
          });
          return;
        }
        
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.8,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      } else {
        // Media library permission handling
        const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
        let finalStatus = currentPermission.status;
        
        if (finalStatus !== 'granted') {
          const requestPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          finalStatus = requestPermission.status;
        }
        
        if (finalStatus !== 'granted') {
          import('react-native').then(({ Alert }) => {
            Alert.alert(
              'Photo Library Permission Required',
              'HiveSnaps needs photo library access to select images. Please enable photo permissions in your device settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => {
                  if (Platform.OS === 'ios') {
                    import('expo-linking').then(({ default: Linking }) => {
                      Linking.openURL('app-settings:');
                    });
                  } else {
                    import('expo-intent-launcher').then(({ default: IntentLauncher }) => {
                      IntentLauncher.startActivityAsync(
                        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
                        { data: 'package:com.anonymous.hivesnaps' }
                      );
                    }).catch(() => {
                      // Fallback for older Android versions
                      import('expo-linking').then(({ default: Linking }) => {
                        Linking.openURL('app-settings:');
                      });
                    });
                  }
                }}
              ]
            );
          });
          return;
        }
        
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
      }
      
      if (!result || result.canceled || !result.assets || !result.assets[0]) return;
      const asset = result.assets[0];
      
      setNewSnapUploading(true);
      try {
        const fileToUpload = {
          uri: asset.uri,
          name: `snap-${Date.now()}.jpg`,
          type: 'image/jpeg',
        };
        const cloudinaryUrl = await uploadImageToCloudinaryFixed(fileToUpload);
        setNewSnapImage(cloudinaryUrl);
      } catch (err) {
        console.error('Image upload error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown upload error';
        import('react-native').then(({ Alert }) => {
          Alert.alert(
            'Upload Failed',
            `Image upload failed: ${errorMessage}`,
            [{ text: 'OK' }]
          );
        });
      } finally {
        setNewSnapUploading(false);
      }
    } catch (err) {
      console.error('Image picker error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      import('react-native').then(({ Alert }) => {
        Alert.alert(
          'Error',
          `Failed to pick image: ${errorMessage}`,
          [{ text: 'OK' }]
        );
      });
      setNewSnapUploading(false);
    }
  };

  // Image modal handler
  const handleImagePress = (imageUrl: string) => {
    setModalImages([{ uri: imageUrl }]);
    setModalImageIndex(0);
    setImageModalVisible(true);
  };

  const handleSubmitNewSnap = async () => {
    if (!username) {
      alert('You must be logged in to post a Snap.');
      return;
    }
    if (!newSnapText.trim()) {
      alert('Snap text cannot be empty.');
      return;
    }
    setNewSnapLoading(true);
    setNewSnapSuccess(false);
    try {
      // Get posting key
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) throw new Error('No posting key found. Please log in again.');
      const postingKey = PrivateKey.fromString(postingKeyStr);
      // Get latest @peak.snaps post (container)
      const discussions = await client.database.call('get_discussions_by_blog', [{ tag: 'peak.snaps', limit: 1 }]);
      if (!discussions || discussions.length === 0) throw new Error('No container post found.');
      const container = discussions[0];
      // Generate permlink
      const permlink = `snap-${Date.now()}`;
      // Compose body (append image if present)
      let body = newSnapText.trim();
      if (newSnapImage) {
        body += `\n![image](${newSnapImage})`;
      }
      // Compose metadata
      const json_metadata = JSON.stringify({ app: 'hivesnaps/1.0', image: newSnapImage ? [newSnapImage] : [] });
      // Broadcast comment (reply)
      await client.broadcast.comment({
        parent_author: container.author,
        parent_permlink: container.permlink,
        author: username,
        permlink,
        title: '',
        body,
        json_metadata,
      }, postingKey);
      setNewSnapLoading(false);
      setNewSnapSuccess(true);
      setTimeout(async () => {
        setNewSnapModalVisible(false);
        setNewSnapText('');
        setNewSnapImage(null);
        setNewSnapSuccess(false);
        // Switch to 'newest' and refresh feed
        setActiveFilter('newest');
        await fetchSnaps(false); // Force refresh without cache
        // Scroll to top
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 1800);
    } catch (err) {
      setNewSnapLoading(false);
      setNewSnapSuccess(false);
      alert('Failed to post Snap: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
    }
  };

  // Avatar cache invalidation function
  const invalidateUserAvatar = (author: string) => {
    setAvatarCache(prev => {
      const updated = { ...prev };
      delete updated[author];
      return updated;
    });
  };

  // Register cache invalidator on mount
  useEffect(() => {
    registerAvatarCacheInvalidator(invalidateUserAvatar);
    return () => {
      unregisterAvatarCacheInvalidator(invalidateUserAvatar);
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Upvote Modal */}
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
            {/* Show loading indicator if vote weight is loading */}
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
                      console.log('[VoteValueDebug] accountObj:', accountObj);
                      console.log('[VoteValueDebug] globalProps:', globalProps);
                      console.log('[VoteValueDebug] rewardFund:', rewardFund);
                      console.log('[VoteValueDebug] hivePrice:', hivePrice);
                      const calcValue = calculateVoteValue(accountObj, globalProps, rewardFund, val, hivePrice);
                      console.log('[VoteValueDebug] calculateVoteValue result:', calcValue);
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
                      console.log('[VoteValueDebug] accountObj:', accountObj);
                      console.log('[VoteValueDebug] globalProps:', globalProps);
                      console.log('[VoteValueDebug] rewardFund:', rewardFund);
                      console.log('[VoteValueDebug] hivePrice:', hivePrice);
                      const calcValue = calculateVoteValue(accountObj, globalProps, rewardFund, val, hivePrice);
                      console.log('[VoteValueDebug] calculateVoteValue result:', calcValue);
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
                <FontAwesome name="hourglass-half" size={32} color={colors.icon} />
                <Text style={{ color: colors.text, marginTop: 8 }}>Submitting vote...</Text>
              </View>
            ) : upvoteSuccess ? (
              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <FontAwesome name="check-circle" size={32} color={colors.button} />
                <Text style={{ color: colors.text, marginTop: 8 }}>Upvote successful!</Text>
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
      {/* Top bar inside SafeAreaView for status bar/notch safety */}
      <SafeAreaView style={{ backgroundColor: colors.background, paddingTop: insets.top }} edges={['top']}>
        <View style={styles.topBar}>
          {/* User avatar instead of logo */}
          <View style={{ flexDirection: 'row', alignItems: 'center', position: 'relative' }}>
            <Pressable
              onPress={() => {
                console.log('Navigating to ProfileScreen for:', username);
                router.push(`/ProfileScreen?username=${username}` as any);
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center' }]}
              accessibilityRole="button"
              accessibilityLabel={`View your profile`}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.text} style={styles.avatar} />
              ) : (
                <View style={{ position: 'relative' }}>
                  <Image
                    source={avatarUrl ? { uri: avatarUrl } : require('../assets/images/generic-avatar.png')}
                    style={styles.avatar}
                  />
                  {/* Subtle reward indicator as avatar overlay */}
                  {hasUnclaimedRewards && (
                    <View style={[styles.rewardIndicator, { 
                      position: 'absolute', 
                      top: -2, 
                      right: -2, 
                      backgroundColor: '#FFD700',
                      borderWidth: 1,
                      borderColor: colors.background
                    }]}> 
                      <FontAwesome name="dollar" size={8} color="#FFF" />
                    </View>
                  )}
                </View>
              )}
              <Text style={[styles.username, { color: colors.text }]}>{username}</Text>
            </Pressable>
            {/* Voting Power display and help icon as a single, larger Pressable */}
            {username && (
              vpLoading ? (
                <ActivityIndicator size="small" color={colors.button} style={{ marginLeft: 8 }} />
              ) : (
                <Pressable
                  onPress={() => setVpInfoModalVisible(true)}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: pressed ? colors.buttonInactive : 'transparent' }]}
                  accessibilityLabel="Show Voting Power info"
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ color: colors.button, fontSize: 14, fontWeight: 'bold' }}>
                    VP: {votingPower !== null ? (votingPower / 100).toFixed(2) : '--'}%
                  </Text>
                  <FontAwesome name="question-circle" size={18} color={colors.button} style={{ marginLeft: 6 }} />
                </Pressable>
              )
            )}
            {/* Voting Power Info Modal */}
            <Modal
              visible={vpInfoModalVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setVpInfoModalVisible(false)}
            >
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 24, width: '85%', alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>What is Voting Power (VP)?</Text>
                  <Text style={{ color: colors.text, fontSize: 15, marginBottom: 18, textAlign: 'left' }}>
                    Voting Power (VP) is a measure of your ability to upvote posts and comments on the Hive blockchain. The higher your VP, the more influence your votes have.{"\n\n"}
                    - VP decreases each time you upvote.{"\n"}
                    - VP regenerates automatically over time (about 20% per day).{"\n"}
                    - Keeping your VP high means your votes have more impact.{"\n\n"}
                    You can see your current VP in the top bar. After upvoting, your VP will drop slightly and recharge over time.
                  </Text>
                  <Pressable
                    style={{ backgroundColor: colors.button, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24, marginTop: 8 }}
                    onPress={() => setVpInfoModalVisible(false)}
                    accessibilityLabel="Close Voting Power info"
                  >
                    <Text style={{ color: colors.buttonText, fontWeight: '600', fontSize: 16 }}>Close</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          </View>
        </View>
        {/* Slogan row */}
        <View style={styles.sloganRow}>
          <Text style={[styles.slogan, { color: colors.text }]}>What's snappening today?</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              style={styles.bellBtn}
              onPress={() => router.push('/NotificationsScreen')}
            >
              <View style={{ position: 'relative' }}>
                <FontAwesome name="bell" size={22} color={colors.icon} />
                <NotificationBadge 
                  count={unreadCount}
                  size="small"
                  color="#FF3B30"
                  visible={unreadCount > 0}
                />
              </View>
            </TouchableOpacity>
          </View>
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
            ref={flatListRef}
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
                permlink={item.permlink}
                onUpvotePress={() => handleUpvotePress({ author: item.author, permlink: item.permlink })}
                hasUpvoted={Array.isArray(item.active_votes) && item.active_votes.some((v: any) => v.voter === username && v.percent > 0)}
                onSpeechBubblePress={() => {
                  console.log('Navigating to ConversationScreen with:', item);
                  router.push({ pathname: '/ConversationScreen', params: { author: item.author, permlink: item.permlink } });
                }}
                onContentPress={() => {
                  console.log('Navigating to ConversationScreen via content press with:', item);
                  router.push({ pathname: '/ConversationScreen', params: { author: item.author, permlink: item.permlink } });
                }}
                onUserPress={(username) => {
                  console.log('Navigating to ProfileScreen for:', username);
                  router.push(`/ProfileScreen?username=${username}` as any);
                }}
                onImagePress={handleImagePress}
                showAuthor // Show author info in feed
                onHashtagPress={tag => {
                  router.push({ pathname: '/DiscoveryScreen', params: { hashtag: tag } });
                }}
              />
            )}
            contentContainerStyle={{ paddingBottom: 80 }}
            style={{ width: '100%' }}
            refreshing={feedLoading}
            onRefresh={async () => {
              if (activeFilter === 'newest') await fetchSnaps(false); // Force refresh
              else if (activeFilter === 'following') await fetchFollowingSnaps(false);
              else if (activeFilter === 'trending') await fetchTrendingSnaps(false);
              else if (activeFilter === 'my') await fetchMySnaps(false);
            }}
            onScrollToIndexFailed={({ index }) => {
              // Fallback: scroll to closest possible
              flatListRef.current?.scrollToOffset({ offset: Math.max(0, index - 2) * 220, animated: true });
            }}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
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
        onPress={() => setNewSnapModalVisible(true)}
        accessibilityLabel="Create new snap"
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
      {/* New Snap Modal */}
      <Modal
        visible={newSnapModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewSnapModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 24, width: '90%', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>New Snap</Text>
            <View style={{ width: '100%', marginBottom: 12 }}>
              <Text style={{ color: colors.text, fontSize: 15, marginBottom: 6 }}>What's snappening?</Text>
              <View style={{ borderWidth: 1, borderColor: colors.buttonInactive, borderRadius: 8, backgroundColor: colorScheme === 'dark' ? '#22303C' : '#F5F8FA', padding: 8 }}>
                <TextInput
                  style={{ color: colors.text, fontSize: 16, minHeight: 60, maxHeight: 120, textAlignVertical: 'top' }}
                  placeholder="Write your Snap..."
                  placeholderTextColor={colors.buttonInactive}
                  multiline
                  value={newSnapText}
                  onChangeText={setNewSnapText}
                  editable={!newSnapLoading && !newSnapSuccess}
                />
              </View>
            </View>
            {/* Add Image Button & Preview */}
            <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.buttonInactive, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, marginRight: 10 }}
                onPress={handleAddImage}
                disabled={newSnapLoading || newSnapSuccess || newSnapUploading}
              >
                <FontAwesome name="image" size={20} color={colors.icon} style={{ marginRight: 6 }} />
                <Text style={{ color: colors.text, fontWeight: '600' }}>Add Image</Text>
              </Pressable>
              {newSnapUploading && (
                <ActivityIndicator size="small" color={colors.button} style={{ marginLeft: 8 }} />
              )}
              {newSnapImage && !newSnapUploading && (
                <Image source={{ uri: newSnapImage }} style={{ width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: colors.buttonInactive }} />
              )}
            </View>
            {/* Action Buttons or Loading/Success */}
            {newSnapLoading ? (
              <View style={{ marginTop: 18, alignItems: 'center' }}>
                <FontAwesome name="hourglass-half" size={32} color={colors.icon} />
                <Text style={{ color: colors.text, marginTop: 8 }}>Posting snap...</Text>
              </View>
            ) : newSnapSuccess ? (
              <View style={{ marginTop: 18, alignItems: 'center' }}>
                <FontAwesome name="check-circle" size={32} color={colors.button} />
                <Text style={{ color: colors.text, marginTop: 8 }}>Snap posted!</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', marginTop: 18 }}>
                <Pressable
                  style={{ flex: 1, marginRight: 8, backgroundColor: colors.buttonInactive, borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={() => setNewSnapModalVisible(false)}
                  disabled={newSnapLoading}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={{ flex: 1, marginLeft: 8, backgroundColor: colors.button, borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={handleSubmitNewSnap}
                  disabled={newSnapLoading}
                >
                  <Text style={{ color: colors.buttonText, fontWeight: '600' }}>Submit</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Image Modal with react-native-image-viewing */}
      <ImageView
        images={modalImages}
        imageIndex={modalImageIndex}
        visible={imageModalVisible}
        onRequestClose={() => {
          setImageModalVisible(false);
          // Force status bar refresh after modal closes
          setTimeout(() => {
            // This helps prevent white stripe issues
          }, 100);
        }}
        backgroundColor="rgba(0, 0, 0, 0.95)"
        swipeToCloseEnabled={true}
        doubleTapToZoomEnabled={true}
        presentationStyle="fullScreen"
        HeaderComponent={() => (
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 50,
              right: 20,
              zIndex: 1000,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderRadius: 20,
              width: 40,
              height: 40,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setImageModalVisible(false)}
            accessibilityLabel="Close image"
          >
            <FontAwesome name="close" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      />
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
    maxWidth: 120, // Prevent username from taking too much space
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 4,
    overflow: 'hidden', // Only works for View, but safe to keep for now
  },
  rewardIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
    elevation: 2,
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

// Cache management utility
let avatarCacheInvalidators: Array<(author: string) => void> = [];

export const registerAvatarCacheInvalidator = (invalidator: (author: string) => void) => {
  avatarCacheInvalidators.push(invalidator);
};

export const unregisterAvatarCacheInvalidator = (invalidator: (author: string) => void) => {
  avatarCacheInvalidators = avatarCacheInvalidators.filter(i => i !== invalidator);
};

export const invalidateAvatarCache = (author: string) => {
  avatarCacheInvalidators.forEach(invalidator => invalidator(author));
};
