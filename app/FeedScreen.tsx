import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  useColorScheme,
  Dimensions,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Platform,
  TextInput,
  ScrollView,
  BackHandler,
  KeyboardAvoidingView,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import ImageView from 'react-native-image-viewing';
import { createFeedScreenStyles } from '../styles/FeedScreenStyles';

// Custom hooks for business logic
import { useUserAuth } from '../hooks/useUserAuth';
import { useFeedData, FeedFilter } from '../hooks/useFeedData';
import { useUpvote } from '../hooks/useUpvote';
import { useSearch } from '../hooks/useSearch';
import { useHiveData } from '../hooks/useHiveData';
import { useNotifications } from '../hooks/useNotifications';
import { useVotingPower } from '../hooks/useVotingPower';
import { useResourceCredits } from '../hooks/useResourceCredits';
import { useUserProfile } from '../hooks/useUserProfile';

// Components
import Snap from './components/Snap';
import NotificationBadge from './components/NotificationBadge';
import SmallButton from '../components/SmallButton';
import StaticContentModal from '../components/StaticContentModal';
import Slider from '@react-native-community/slider';
import UpvoteModal from '../components/UpvoteModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Modal content constants
const VP_MODAL_CONTENT = {
  title: 'What is Voting Power (VP)?',
  content: `Voting Power (VP) is a measure of your ability to upvote posts and comments on the Hive blockchain. The higher your VP, the more influence your votes have.

- VP decreases each time you upvote.
- VP regenerates automatically over time (about 20% per day).
- Keeping your VP high means your votes have more impact.

You can see your current VP in the top bar. After upvoting, your VP will drop slightly and recharge over time.`,
};

const RC_MODAL_CONTENT = {
  title: 'What are Resource Credits (RC)?',
  content: `Resource Credits are like digital fuel. You need them to do things on Hive, like posting, voting, or making transactions. Every account has them, and using the network costs a small amount each time.

How can I get more?

• Power Up Hive: The more Hive Power you have, the more RC you get.

• Ask for a Delegation: A friend or community can temporarily boost your RC by delegating Hive Power.

• Use a Faucet or Service: Some apps or websites offer small amounts of RC for free.

Don't worry—RC recharges over time!

Even if you're out of credits, just wait a bit. Your RC will slowly refill, and you'll be able to use Hive again without doing anything else.`,
};

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

const FeedScreenRefactored = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Theme colors
  const colors = {
    background: isDark
      ? twitterColors.dark.background
      : twitterColors.light.background,
    text: isDark ? twitterColors.dark.text : twitterColors.light.text,
    button: isDark ? twitterColors.dark.button : twitterColors.light.button,
    buttonText: isDark
      ? twitterColors.dark.buttonText
      : twitterColors.light.buttonText,
    buttonInactive: isDark
      ? twitterColors.dark.buttonInactive
      : twitterColors.light.buttonInactive,
    icon: isDark ? twitterColors.dark.icon : twitterColors.light.icon,
    bubble: isDark ? '#192734' : '#f0f0f0',
  };

  // Initialize styles
  const styles = createFeedScreenStyles(colors, isDark);

  // Custom hooks for business logic
  const { currentUsername: username, handleLogout: logout } = useUserAuth();

  // User profile and voting power data
  const {
    avatarUrl,
    hasUnclaimedRewards,
    loading: userLoading,
  } = useUserProfile(username);

  const { votingPower, loading: vpLoading } = useVotingPower(username);
  const { resourceCredits, loading: rcLoading } = useResourceCredits(username);

  const {
    snaps,
    loading: feedLoading,
    error: feedError,
    currentFilter,
    fetchSnaps,
    refreshSnaps,
    loadMoreSnaps,
    updateSnap,
    fetchAndCacheFollowingList,
    ensureFollowingListCached,
    onScrollPositionChange,
    setFilter,
    getMemoryStats,
  } = useFeedData(username);

  const { hivePrice, globalProps, rewardFund } = useHiveData();

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
    updateSnapsOptimistically,
  } = useUpvote(username, globalProps, rewardFund, hivePrice, updateSnap);

  const {
    query: searchQuery,
    type: searchType,
    results: searchResults,
    loading: searchLoading,
    recentSearches,
    recentHashtags,
    setQuery: setSearchQuery,
    setType: setSearchType,
    search: handleSearch,
    clearResults: clearSearch,
    saveToRecentSearches,
    saveToRecentHashtags,
    removeRecentSearch,
    removeRecentHashtag,
    loadRecentSearches,
  } = useSearch();

  const { unreadCount } = useNotifications(username || null);

  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [vpInfoModalVisible, setVpInfoModalVisible] = useState(false);
  const [rcInfoModalVisible, setRcInfoModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [modalImages, setModalImages] = useState<Array<{ uri: string }>>([]);
  const [modalImageIndex, setModalImageIndex] = useState(0);

  // Refs
  const flatListRef = useRef<FlatList<any>>(null);
  const hasInitialFetch = useRef(false);

  // Load recent searches on mount
  useEffect(() => {
    loadRecentSearches();
  }, [loadRecentSearches]);

  // Initial data fetch on mount - only once
  useEffect(() => {
    if (!hasInitialFetch.current) {
      console.log(
        `🎬 [FeedScreen] ===== APP STARTUP - MEMORY MANAGEMENT INITIALIZED =====`
      );
      console.log(`🎬 [FeedScreen] Initial mount - fetching data once`);
      const initialStats = getMemoryStats();
      console.log(
        `📊 [FeedScreen] Initial memory state: ${initialStats.memoryUsage}`
      );
      console.log(
        `🏗️ [FeedScreen] About to fetch snaps using container-pagination strategy...`
      );
      hasInitialFetch.current = true;
      fetchSnaps(false).then(() => {
        // Log memory state after initial fetch
        const postFetchStats = getMemoryStats();
        console.log(
          `📊 [FeedScreen] After initial fetch: ${postFetchStats.memoryUsage}`
        );
     
        if (postFetchStats.containersInMemory === 0) {
          console.log(
            `⚠️ [FeedScreen] WARNING: No containers created after initial fetch! Container system may not be working.`
          );
        }
      }); // Force fresh fetch on mount
    }
  }, []); // Empty deps - only run once on mount

  // Log filter changes (client-side filtering happens automatically in useFeedData)
  useEffect(() => {
    console.log(`🎯 [FeedScreen] Filter changed to: ${currentFilter} (client-side filtering)`);
  }, [currentFilter]);

  // Fetch following list when username becomes available
  useEffect(() => {
    if (username) {
      console.log(`👤 [FeedScreen] Username became available: ${username}`);
      console.log(
        `👤 [FeedScreen] Fetching following list for offline filtering...`
      );

      // Call both functions to ensure following list is cached
      fetchAndCacheFollowingList(username);

      // Also ensure it's cached (this will check if it's already there)
      ensureFollowingListCached(username).then(() => {
        console.log(`👤 [FeedScreen] Following list ensured for ${username}`);
      });
    } else {
      console.log(
        `👤 [FeedScreen] No username yet - waiting for authentication...`
      );
    }
  }, [username, fetchAndCacheFollowingList, ensureFollowingListCached]);

  // Handle when user reaches near the end of the list
  const handleEndReached = () => {
    console.log(`\n📜 [FeedScreen] ===== USER REACHED END OF LIST =====`);
   
    // Show current memory stats before loading more
    const currentStats = getMemoryStats();
    console.log(
      `📊 [FeedScreen] Memory before load more: ${currentStats.memoryUsage}`
    );

    if (!feedLoading) {
      console.log(
        `🔄 [FeedScreen] Triggering loadMoreSnaps for filter: ${currentFilter} - this may trigger memory cleanup!`
      );
      loadMoreSnaps().then(() => {
        // Log memory stats after loading more
        const newStats = getMemoryStats();
        console.log(
          `📊 [FeedScreen] Memory after load more: ${newStats.memoryUsage}`
        );
      });
    } else {
      console.log(
        `⏹️ [FeedScreen] Not loading more, loading: ${feedLoading}`
      );
    }
  };

  // Handle filter button presses
  const handleFilterPress = (filter: FeedFilter) => {
    console.log(`\n🎯 [FeedScreen] User tapped "${filter}" filter button`);
    console.log(
      `� [FeedScreen] Current filter: "${currentFilter}" → New filter: "${filter}"`
    );

    if (filter === currentFilter) {
      console.log(`ℹ️ [FeedScreen] Same filter selected - no action needed`);
      return;
    }

    console.log(
      `🔄 [FeedScreen] Switching filters - this should use client-side filtering if data is cached!`
    );

    // If switching to "following" filter, ensure following list is cached
    if (filter === 'following' && username) {
      console.log(
        `👥 [FeedScreen] Switching to following filter - ensuring following list is cached...`
      );
      ensureFollowingListCached(username).then(() => {
        console.log(
          `👥 [FeedScreen] Following list is now cached, proceeding with filter change`
        );
        setFilter(filter);
      });
    } else {
      // For other filters, change immediately
      setFilter(filter);
    }
  };

  // Handle upvote press
  const handleUpvotePress = async ({
    author,
    permlink,
  }: {
    author: string;
    permlink: string;
  }) => {
    // Find the snap data to pass for optimistic updates
    const snap = snaps.find(
      s => s.author === author && s.permlink === permlink
    );
    await openUpvoteModal({ author, permlink, snap });
  };

  // Handle image press
  const handleImagePress = (imageUrl: string) => {
    setModalImages([{ uri: imageUrl }]);
    setModalImageIndex(0);
    setImageModalVisible(true);
  };

  // Handle search modal close
  const handleCloseSearchModal = () => {
    setIsSearchModalVisible(false);
    clearSearch();
  };

  // Handle search submission
  const handleSearchSubmit = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) return;

    if (searchType === 'content') {
      const hashtag = searchTerm.startsWith('#')
        ? searchTerm.slice(1)
        : searchTerm;
      const cleanHashtag = hashtag.trim();

      if (cleanHashtag) {
        await saveToRecentHashtags(cleanHashtag);
        router.push(
          `/DiscoveryScreen?hashtag=${encodeURIComponent(cleanHashtag)}`
        );
        setIsSearchModalVisible(false);
        clearSearch();
      }
      return;
    }

    await handleSearch(searchTerm);
  };

  // Handle back button - minimize app instead of logout
  useFocusEffect(
    React.useCallback(() => {
      const backAction = () => {
        // On Android, minimize the app when back is pressed on main feed
        if (Platform.OS === 'android') {
          BackHandler.exitApp();
          return true;
        }
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction
      );
      return () => backHandler.remove();
    }, [])
  );

  // Viewability config for FlatList
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 60,
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      // Track the first visible item for scroll position
      if (viewableItems.length > 0) {
        const firstVisibleIndex = viewableItems[0].index || 0;
        onScrollPositionChange(firstVisibleIndex);
      }
    }
  ).current;

  // Track scroll position for memory management and prefetching (throttled)
  const handleScroll = useRef((event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const scrollY = contentOffset.y;
    const screenHeight = layoutMeasurement.height;
    const totalHeight = contentSize.height;

    // Calculate approximate current item index based on scroll position
    // Assuming each item is roughly 200-300px tall
    const estimatedItemHeight = 250;
    const currentIndex = Math.floor(scrollY / estimatedItemHeight);

    // Call the memory management function with current index (now throttled internally)
    onScrollPositionChange(currentIndex);

    // Log memory stats much less frequently - every 50 items and only when containers exist
    if (__DEV__ && currentIndex % 50 === 0 && currentIndex > 0) {
      const stats = getMemoryStats();
      if (stats.containersInMemory > 0) {
        const scrollPercent = Math.round(
          (scrollY / (totalHeight - screenHeight)) * 100
        );
        console.log(
          `📊 [Scroll] Item ${currentIndex}, ${scrollPercent}% scrolled, Memory: ${stats.memoryUsage}`
        );
        console.log(
          `📊 [Scroll] Containers: ${stats.containersInMemory}, Total snaps: ${stats.totalSnaps}`
        );
      }
    }
  }).current;

  // Debug function to manually check memory stats (can be called from console)
  const logMemoryStats = () => {
    const stats = getMemoryStats();
    console.log(`\n🔍 [DEBUG] ===== MANUAL MEMORY STATS CHECK =====`);
    console.log(
      `🔍 [DEBUG] Containers in memory: ${stats.containersInMemory}/4`
    );
    console.log(`🔍 [DEBUG] Total snaps: ${stats.totalSnaps}`);
    console.log(`🔍 [DEBUG] Memory usage: ${stats.memoryUsage}`);
    console.log(`🔍 [DEBUG] Current snaps shown: ${snaps.length}`);
    
    // Add registry information
    if (stats.registryInfo) {
      console.log(`📝 [DEBUG] === CONTAINER REGISTRY ===`);
      console.log(`📝 [DEBUG] Total tracked: ${stats.registryInfo.totalTracked}`);
      console.log(`📝 [DEBUG] In memory: ${stats.registryInfo.inMemory}`);
      console.log(`📝 [DEBUG] Freed: ${stats.registryInfo.freed}`);
      console.log(`📝 [DEBUG] Registry snaps: ${stats.registryInfo.snapsInRegistry}`);
    }
    
    console.log(`🔍 [DEBUG] ===== END MEMORY STATS =====\n`);
    return stats;
  };

  // Make the debug function globally available in development
  if (__DEV__) {
    (globalThis as any).logMemoryStats = logMemoryStats;
    // Also add explicit stats logging
    (globalThis as any).showMemoryStats = () => {
      const stats = getMemoryStats();
      console.log(
        `📊 [Manual] ${stats.memoryUsage}, total snaps: ${stats.totalSnaps}`
      );
      return stats;
    };
  }

  return (
    <View style={styles.container}>
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
        colors={colors}
      />

      {/* Top bar */}
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <Pressable
              onPress={() => {
                if (username) {
                  console.log('Navigating to profile for username:', username);
                  router.push(`/ProfileScreen?username=${username}` as any);
                } else {
                  console.log(
                    'Cannot navigate to profile: username is undefined'
                  );
                }
              }}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                },
              ]}
              accessibilityRole='button'
              accessibilityLabel={`View your profile`}
            >
              {userLoading ? (
                <ActivityIndicator
                  size='small'
                  color={colors.text}
                  style={styles.avatar}
                />
              ) : (
                <View style={{ position: 'relative' }}>
                  <Image
                    source={
                      avatarUrl
                        ? { uri: avatarUrl }
                        : require('../assets/images/generic-avatar.png')
                    }
                    style={styles.avatar}
                  />
                  {hasUnclaimedRewards && (
                    <View
                      style={[
                        styles.rewardIndicator,
                        {
                          position: 'absolute',
                          top: -2,
                          right: -2,
                          backgroundColor: '#FFD700',
                          borderWidth: 1,
                          borderColor: colors.background,
                        },
                      ]}
                    >
                      <FontAwesome name='dollar' size={8} color='#FFF' />
                    </View>
                  )}
                </View>
              )}
              <Text style={[styles.username, { color: colors.text }]}>
                {username && username.length > 8
                  ? username.slice(0, 8) + '...'
                  : username}
              </Text>
            </Pressable>

            {username && (vpLoading || rcLoading) ? (
              <ActivityIndicator
                size='small'
                color={colors.button}
                style={styles.creditsIcon}
              />
            ) : username ? (
              <View style={styles.creditsContainer}>
                {/* Voting Power */}
                <SmallButton
                  label='VP:'
                  value={
                    votingPower !== null ? (votingPower / 100).toFixed(1) : '--'
                  }
                  unit='%'
                  colors={colors}
                  onPress={() => setVpInfoModalVisible(true)}
                  accessibilityLabel='Show Voting Power info'
                  accessibilityRole='button'
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                />

                {/* Separator */}
                <Text style={styles.creditsSeparator}>|</Text>

                {/* Resource Credits */}
                <SmallButton
                  label='RC:'
                  value={
                    resourceCredits !== null ? resourceCredits.toFixed(1) : '--'
                  }
                  unit='%'
                  colors={colors}
                  onPress={() => setRcInfoModalVisible(true)}
                  accessibilityLabel='Show Resource Credits info'
                  accessibilityRole='button'
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                />
              </View>
            ) : null}
          </View>
        </View>

        {/* Info Modals */}
        <StaticContentModal
          visible={vpInfoModalVisible}
          onClose={() => setVpInfoModalVisible(false)}
          title={VP_MODAL_CONTENT.title}
          content={VP_MODAL_CONTENT.content}
          colors={colors}
          closeButtonAccessibilityLabel='Close Voting Power info'
        />

        <StaticContentModal
          visible={rcInfoModalVisible}
          onClose={() => setRcInfoModalVisible(false)}
          title={RC_MODAL_CONTENT.title}
          content={RC_MODAL_CONTENT.content}
          colors={colors}
          closeButtonAccessibilityLabel='Close Resource Credits info'
        />

        {/* Slogan row */}
        <View style={styles.sloganRow}>
          <Text style={[styles.slogan, { color: colors.text }]}>
            What's snappening today?
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.searchBtn, { marginRight: 12 }]}
              onPress={() => setIsSearchModalVisible(true)}
              accessibilityLabel='Search posts and users'
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <FontAwesome name='search' size={22} color={colors.icon} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => router.push('/NotificationsScreen')}
            >
              <View style={{ position: 'relative' }}>
                <FontAwesome name='bell' size={22} color={colors.icon} />
                <NotificationBadge
                  count={unreadCount}
                  size='small'
                  color='#FF3B30'
                  visible={unreadCount > 0}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Row */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
            style={styles.filterScrollView}
          >
            {[
              { key: 'following', label: 'Following', icon: 'users' },
              { key: 'newest', label: 'Newest', icon: 'clock-o' },
              { key: 'trending', label: 'Trending', icon: 'fire' },
              { key: 'my', label: 'My Snaps', icon: 'user' },
            ].map((filter, index) => (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.filterBtnScrollable,
                  {
                    backgroundColor:
                      currentFilter === filter.key
                        ? colors.button
                        : colors.buttonInactive,
                    marginLeft: index === 0 ? 0 : 8,
                    marginRight: index === 3 ? 0 : 0,
                  },
                ]}
                onPress={() => handleFilterPress(filter.key as FeedFilter)}
                activeOpacity={0.7}
              >
                <FontAwesome
                  name={filter.icon as any}
                  size={16}
                  color={
                    currentFilter === filter.key
                      ? colors.buttonText
                      : colors.text
                  }
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.filterTextScrollable,
                    {
                      color:
                        currentFilter === filter.key
                          ? colors.buttonText
                          : colors.text,
                    },
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* Feed list */}
      <View style={styles.feedContainer}>
        {feedLoading ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <FontAwesome
              name='hourglass-half'
              size={48}
              color={colors.icon}
              style={{
                marginBottom: 12,
                transform: [{ rotate: `${(Date.now() % 3600) / 10}deg` }],
              }}
            />
            <Text style={{ color: colors.text, fontSize: 16 }}>
              Loading snaps...
            </Text>
          </View>
        ) : snaps.length === 0 ? (
          <Text style={{ color: colors.text, marginTop: 24 }}>
            No snaps to display.
          </Text>
        ) : (
          <FlatList
            ref={flatListRef}
            data={snaps}
            keyExtractor={(item, index) =>
              `${item.author}-${item.permlink}-${index}`
            }
            renderItem={({ item }) => (
              <Snap
                author={item.author}
                avatarUrl={item.avatarUrl}
                body={item.body}
                created={item.created}
                voteCount={item.net_votes || 0}
                replyCount={item.children || 0}
                payout={parseFloat(
                  item.pending_payout_value
                    ? item.pending_payout_value.replace(' HBD', '')
                    : '0'
                )}
                permlink={item.permlink}
                onUpvotePress={() =>
                  handleUpvotePress({
                    author: item.author,
                    permlink: item.permlink,
                  })
                }
                hasUpvoted={
                  Array.isArray(item.active_votes) &&
                  item.active_votes.some(
                    (v: any) => v.voter === username && v.percent > 0
                  )
                }
                onSpeechBubblePress={() => {
                  router.push({
                    pathname: '/ConversationScreen',
                    params: { author: item.author, permlink: item.permlink },
                  });
                }}
                onContentPress={() => {
                  router.push({
                    pathname: '/ConversationScreen',
                    params: { author: item.author, permlink: item.permlink },
                  });
                }}
                onUserPress={username => {
                  router.push(`/ProfileScreen?username=${username}` as any);
                }}
                onImagePress={handleImagePress}
                showAuthor
                onHashtagPress={tag => {
                  router.push({
                    pathname: '/DiscoveryScreen',
                    params: { hashtag: tag },
                  });
                }}
                onResnapPress={(author, permlink) => {
                  const snapUrl = `https://hive.blog/@${author}/${permlink}`;
                  router.push({
                    pathname: '/ComposeScreen',
                    params: { resnapUrl: snapUrl },
                  });
                }}
              />
            )}
            contentContainerStyle={{ paddingBottom: 80 }}
            style={{ width: '100%' }}
            refreshing={feedLoading}
            onRefresh={async () => {
              await refreshSnaps();
            }}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            onScrollToIndexFailed={({ index }) => {
              flatListRef.current?.scrollToOffset({
                offset: Math.max(0, index - 2) * 220,
                animated: true,
              });
            }}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
            onScroll={handleScroll}
            scrollEventThrottle={16} // Throttle scroll events for performance
          />
        )}
      </View>

      {/* Floating Action Button */}
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
        onPress={() => router.push('/ComposeScreen' as any)}
        accessibilityLabel='Create new snap'
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Image Modal */}
      <ImageView
        images={modalImages}
        imageIndex={modalImageIndex}
        visible={imageModalVisible}
        onRequestClose={() => {
          setImageModalVisible(false);
        }}
        backgroundColor='rgba(0, 0, 0, 0.95)'
        swipeToCloseEnabled={true}
        doubleTapToZoomEnabled={true}
        presentationStyle='fullScreen'
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
            accessibilityLabel='Close image'
          >
            <FontAwesome name='close' size={20} color='#fff' />
          </TouchableOpacity>
        )}
      />

      {/* Search Modal */}
      <Modal
        visible={isSearchModalVisible}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setIsSearchModalVisible(false)}
      >
        <View style={styles.searchModal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.searchContainer}
          >
            {/* Search Header */}
            <View style={styles.searchHeader}>
              <Text style={styles.searchHeaderTitle}>Search</Text>
              <TouchableOpacity
                style={styles.searchCloseBtn}
                onPress={() => setIsSearchModalVisible(false)}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchInputContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder={
                  searchType === 'content'
                    ? 'Search hashtags like photography, crypto...'
                    : 'Search users...'
                }
                placeholderTextColor={colors.text + '60'}
                value={
                  searchType === 'content' &&
                  searchQuery &&
                  !searchQuery.startsWith('#')
                    ? `#${searchQuery}`
                    : searchQuery
                }
                onChangeText={text => {
                  if (searchType === 'content') {
                    const cleanText = text.startsWith('#')
                      ? text.slice(1)
                      : text;
                    setSearchQuery(cleanText);
                  } else {
                    setSearchQuery(text);
                  }
                }}
                onSubmitEditing={() => handleSearchSubmit()}
                returnKeyType='search'
                autoFocus
              />
            </View>

            {/* Search Filters */}
            <View style={styles.searchFilters}>
              <TouchableOpacity
                style={[
                  styles.searchFilterBtn,
                  searchType === 'users' && styles.searchFilterBtnActive,
                ]}
                onPress={() => {
                  setSearchType('users');
                  clearSearch();
                }}
              >
                <Text
                  style={[
                    styles.searchFilterText,
                    searchType === 'users' && styles.searchFilterTextActive,
                  ]}
                >
                  Users
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.searchFilterBtn,
                  searchType === 'content' && styles.searchFilterBtnActive,
                ]}
                onPress={() => {
                  setSearchType('content');
                  clearSearch();
                }}
              >
                <Text
                  style={[
                    styles.searchFilterText,
                    searchType === 'content' && styles.searchFilterTextActive,
                  ]}
                >
                  Content
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.searchContent}>
              {/* Recent Searches - Users */}
              {!searchQuery &&
                searchType === 'users' &&
                recentSearches.length > 0 && (
                  <View style={styles.recentSearchesSection}>
                    <Text style={styles.recentSearchesTitle}>
                      Recent User Searches
                    </Text>
                    {recentSearches.map((search, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.recentSearchItem}
                        onPress={() => {
                          setSearchQuery(search);
                          handleSearchSubmit(search);
                        }}
                      >
                        <FontAwesome
                          name='user'
                          size={14}
                          color={colors.icon}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.recentSearchText}>{search}</Text>
                        <TouchableOpacity
                          style={styles.clearRecentBtn}
                          onPress={() => removeRecentSearch(search)}
                        >
                          <Text
                            style={{ color: colors.text + '60', fontSize: 12 }}
                          >
                            ✕
                          </Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

              {/* Recent Hashtags - Content */}
              {!searchQuery &&
                searchType === 'content' &&
                recentHashtags.length > 0 && (
                  <View style={styles.recentSearchesSection}>
                    <Text style={styles.recentSearchesTitle}>
                      Recent Hashtags
                    </Text>
                    {recentHashtags.map((hashtag, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.recentSearchItem}
                        onPress={() => {
                          setSearchQuery(hashtag);
                          handleSearchSubmit(hashtag);
                        }}
                      >
                        <FontAwesome
                          name='hashtag'
                          size={14}
                          color={colors.icon}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.recentSearchText}>#{hashtag}</Text>
                        <TouchableOpacity
                          style={styles.clearRecentBtn}
                          onPress={() => removeRecentHashtag(hashtag)}
                        >
                          <Text
                            style={{ color: colors.text + '60', fontSize: 12 }}
                          >
                            ✕
                          </Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

              {/* Search Results */}
              {searchQuery && searchType === 'users' && (
                <View style={styles.searchResults}>
                  <Text style={styles.searchResultsTitle}>Users</Text>

                  {searchLoading ? (
                    <View style={styles.searchLoadingContainer}>
                      <ActivityIndicator size='large' color={colors.button} />
                      <Text style={styles.searchLoadingText}>Searching...</Text>
                    </View>
                  ) : searchResults.users.length === 0 ? (
                    <View style={styles.searchEmptyContainer}>
                      <Text style={styles.searchEmptyText}>
                        No users found for "{searchQuery}"
                      </Text>
                    </View>
                  ) : (
                    searchResults.users.map((result: any, index: number) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.searchResultItem}
                        onPress={() => {
                          router.push(
                            `/ProfileScreen?username=${result.name}` as any
                          );
                          setIsSearchModalVisible(false);
                        }}
                      >
                        <Image
                          source={{
                            uri:
                              result.avatarUrl ||
                              `https://images.hive.blog/u/${result.name}/avatar`,
                          }}
                          style={styles.searchResultAvatar}
                        />
                        <View style={styles.searchResultInfo}>
                          <Text style={styles.searchResultUsername}>
                            @{result.name}
                          </Text>
                          <Text style={styles.searchResultMeta}>
                            {result.displayName &&
                            result.displayName !== result.name
                              ? result.displayName
                              : ''}
                          </Text>
                          {result.about && (
                            <Text
                              style={styles.searchResultContent}
                              numberOfLines={1}
                              ellipsizeMode='tail'
                            >
                              {result.about}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}

              {/* Content Search Hint */}
              {searchQuery && searchType === 'content' && (
                <View style={styles.searchResults}>
                  <Text style={styles.searchResultsTitle}>Content Search</Text>
                  <View style={styles.searchEmptyContainer}>
                    <FontAwesome
                      name='hashtag'
                      size={32}
                      color={colors.icon}
                      style={{ marginBottom: 8 }}
                    />
                    <Text style={styles.searchEmptyText}>
                      Searching for #{searchQuery}...
                    </Text>
                    <Text
                      style={[
                        styles.searchEmptyText,
                        { fontSize: 14, opacity: 0.7, marginTop: 8 },
                      ]}
                    >
                      This will open the Discovery screen with your hashtag
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

export default FeedScreenRefactored;
