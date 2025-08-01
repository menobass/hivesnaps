import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Image, useColorScheme, Dimensions, ActivityIndicator, FlatList, Modal, Pressable, Platform, TextInput, ScrollView, BackHandler, ToastAndroid, KeyboardAvoidingView } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

// Components
import Snap from './components/Snap';
import NotificationBadge from './components/NotificationBadge';
import Slider from '@react-native-community/slider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    background: isDark ? twitterColors.dark.background : twitterColors.light.background,
    text: isDark ? twitterColors.dark.text : twitterColors.light.text,
    button: isDark ? twitterColors.dark.button : twitterColors.light.button,
    buttonText: isDark ? twitterColors.dark.buttonText : twitterColors.light.buttonText,
    buttonInactive: isDark ? twitterColors.dark.buttonInactive : twitterColors.light.buttonInactive,
    icon: isDark ? twitterColors.dark.icon : twitterColors.light.icon,
    bubble: isDark ? '#192734' : '#f0f0f0',
  };

  // Initialize styles
  const styles = createFeedScreenStyles(colors, isDark);

  // Custom hooks for business logic
  const {
    username,
    avatarUrl,
    hasUnclaimedRewards,
    votingPower,
    vpLoading,
    loading: userLoading,
    logout
  } = useUserAuth();

  const {
    snaps,
    loading: feedLoading,
    error: feedError,
    fetchSnaps,
    refreshSnaps
  } = useFeedData(username);

  const {
    hivePrice,
    globalProps,
    rewardFund
  } = useHiveData();

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
    updateSnapsOptimistically
  } = useUpvote(username, globalProps, rewardFund, hivePrice);

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
    loadRecentSearches
  } = useSearch();

  const { unreadCount } = useNotifications(username || null);

  // Local UI state
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('newest');
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [vpInfoModalVisible, setVpInfoModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [modalImages, setModalImages] = useState<Array<{ uri: string }>>([]);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [exitTimestamp, setExitTimestamp] = useState<number | null>(null);

  // Refs
  const flatListRef = useRef<FlatList<any>>(null);

  // Load recent searches on mount
  useEffect(() => {
    loadRecentSearches();
  }, [loadRecentSearches]);

  // Fetch snaps when filter changes
  useEffect(() => {
    fetchSnaps(activeFilter, true);
  }, [activeFilter, fetchSnaps]);

  // Handle filter button presses
  const handleFilterPress = (filter: FeedFilter) => {
    setActiveFilter(filter);
  };

  // Handle upvote press
  const handleUpvotePress = async ({ author, permlink }: { author: string; permlink: string }) => {
    await openUpvoteModal({ author, permlink });
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
      const hashtag = searchTerm.startsWith('#') ? searchTerm.slice(1) : searchTerm;
      const cleanHashtag = hashtag.trim();
      
      if (cleanHashtag) {
        await saveToRecentHashtags(cleanHashtag);
        router.push(`/DiscoveryScreen?hashtag=${encodeURIComponent(cleanHashtag)}`);
        setIsSearchModalVisible(false);
        clearSearch();
      }
      return;
    }

    await handleSearch(searchTerm);
  };

  // Handle back button for exit confirmation
  useFocusEffect(
    React.useCallback(() => {
      const backAction = () => {
        const now = Date.now();

        if (exitTimestamp && (now - exitTimestamp) < 2000) {
          logout();
          return true;
        } else {
          setExitTimestamp(now);

          if (Platform.OS === 'android') {
            ToastAndroid.show('Press back again to log out', ToastAndroid.SHORT);
          }

          setTimeout(() => {
            setExitTimestamp(null);
          }, 2000);

          return true;
        }
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }, [exitTimestamp, logout])
  );

  // Viewability config for FlatList
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 60,
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    // Track visible items if needed
  }).current;

  return (
    <View style={styles.container}>
      {/* Upvote Modal */}
      <Modal
        visible={upvoteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeUpvoteModal}
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
                  onValueChange={setVoteWeight}
                  minimumTrackTintColor={colors.button}
                  maximumTrackTintColor={colors.buttonInactive}
                  thumbTintColor={colors.button}
                />
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
                  onPress={closeUpvoteModal}
                  disabled={upvoteLoading}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={{ flex: 1, marginLeft: 8, backgroundColor: colors.button, borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={confirmUpvote}
                  disabled={upvoteLoading}
                >
                  <Text style={{ color: colors.buttonText, fontWeight: '600' }}>Confirm</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Top bar */}
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', position: 'relative' }}>
            <Pressable
              onPress={() => router.push(`/ProfileScreen?username=${username}` as any)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center' }]}
              accessibilityRole="button"
              accessibilityLabel={`View your profile`}
            >
              {userLoading ? (
                <ActivityIndicator size="small" color={colors.text} style={styles.avatar} />
              ) : (
                <View style={{ position: 'relative' }}>
                  <Image
                    source={avatarUrl ? { uri: avatarUrl } : require('../assets/images/generic-avatar.png')}
                    style={styles.avatar}
                  />
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
          </View>
        </View>

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

        {/* Slogan row */}
        <View style={styles.sloganRow}>
          <Text style={[styles.slogan, { color: colors.text }]}>What's snappening today?</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.searchBtn, { marginRight: 12 }]}
              onPress={() => setIsSearchModalVisible(true)}
              accessibilityLabel="Search posts and users"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <FontAwesome name="search" size={22} color={colors.icon} />
            </TouchableOpacity>
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
              { key: 'my', label: 'My Snaps', icon: 'user' }
            ].map((filter, index) => (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.filterBtnScrollable,
                  {
                    backgroundColor: activeFilter === filter.key ? colors.button : colors.buttonInactive,
                    marginLeft: index === 0 ? 0 : 8,
                    marginRight: index === 3 ? 0 : 0
                  }
                ]}
                onPress={() => handleFilterPress(filter.key as FeedFilter)}
                activeOpacity={0.7}
              >
                <FontAwesome
                  name={filter.icon as any}
                  size={16}
                  color={activeFilter === filter.key ? colors.buttonText : colors.text}
                  style={{ marginRight: 6 }}
                />
                <Text style={[
                  styles.filterTextScrollable,
                  { color: activeFilter === filter.key ? colors.buttonText : colors.text }
                ]}>
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
                  router.push({ pathname: '/ConversationScreen', params: { author: item.author, permlink: item.permlink } });
                }}
                onContentPress={() => {
                  router.push({ pathname: '/ConversationScreen', params: { author: item.author, permlink: item.permlink } });
                }}
                onUserPress={(username) => {
                  router.push(`/ProfileScreen?username=${username}` as any);
                }}
                onImagePress={handleImagePress}
                showAuthor
                onHashtagPress={tag => {
                  router.push({ pathname: '/DiscoveryScreen', params: { hashtag: tag } });
                }}
              />
            )}
            contentContainerStyle={{ paddingBottom: 80 }}
            style={{ width: '100%' }}
            refreshing={feedLoading}
            onRefresh={async () => {
              await refreshSnaps(activeFilter);
            }}
            onScrollToIndexFailed={({ index }) => {
              flatListRef.current?.scrollToOffset({ offset: Math.max(0, index - 2) * 220, animated: true });
            }}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
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
        accessibilityLabel="Create new snap"
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

      {/* Search Modal */}
      <Modal
        visible={isSearchModalVisible}
        animationType="slide"
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
                placeholder={searchType === 'content' ? "Search hashtags like photography, crypto..." : "Search users..."}
                placeholderTextColor={colors.text + '60'}
                value={searchType === 'content' && searchQuery && !searchQuery.startsWith('#') ? `#${searchQuery}` : searchQuery}
                onChangeText={(text) => {
                  if (searchType === 'content') {
                    const cleanText = text.startsWith('#') ? text.slice(1) : text;
                    setSearchQuery(cleanText);
                  } else {
                    setSearchQuery(text);
                  }
                }}
                onSubmitEditing={() => handleSearchSubmit()}
                returnKeyType="search"
                autoFocus
              />
            </View>

            {/* Search Filters */}
            <View style={styles.searchFilters}>
              <TouchableOpacity
                style={[
                  styles.searchFilterBtn,
                  searchType === 'users' && styles.searchFilterBtnActive
                ]}
                onPress={() => {
                  setSearchType('users');
                  clearSearch();
                }}
              >
                <Text
                  style={[
                    styles.searchFilterText,
                    searchType === 'users' && styles.searchFilterTextActive
                  ]}
                >
                  Users
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.searchFilterBtn,
                  searchType === 'content' && styles.searchFilterBtnActive
                ]}
                onPress={() => {
                  setSearchType('content');
                  clearSearch();
                }}
              >
                <Text
                  style={[
                    styles.searchFilterText,
                    searchType === 'content' && styles.searchFilterTextActive
                  ]}
                >
                  Content
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.searchContent}>
              {/* Recent Searches - Users */}
              {!searchQuery && searchType === 'users' && recentSearches.length > 0 && (
                <View style={styles.recentSearchesSection}>
                  <Text style={styles.recentSearchesTitle}>Recent User Searches</Text>
                  {recentSearches.map((search, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.recentSearchItem}
                      onPress={() => {
                        setSearchQuery(search);
                        handleSearchSubmit(search);
                      }}
                    >
                      <FontAwesome name="user" size={14} color={colors.icon} style={{ marginRight: 8 }} />
                      <Text style={styles.recentSearchText}>{search}</Text>
                      <TouchableOpacity
                        style={styles.clearRecentBtn}
                        onPress={() => removeRecentSearch(search)}
                      >
                        <Text style={{ color: colors.text + '60', fontSize: 12 }}>✕</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Recent Hashtags - Content */}
              {!searchQuery && searchType === 'content' && recentHashtags.length > 0 && (
                <View style={styles.recentSearchesSection}>
                  <Text style={styles.recentSearchesTitle}>Recent Hashtags</Text>
                  {recentHashtags.map((hashtag, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.recentSearchItem}
                      onPress={() => {
                        setSearchQuery(hashtag);
                        handleSearchSubmit(hashtag);
                      }}
                    >
                      <FontAwesome name="hashtag" size={14} color={colors.icon} style={{ marginRight: 8 }} />
                      <Text style={styles.recentSearchText}>#{hashtag}</Text>
                      <TouchableOpacity
                        style={styles.clearRecentBtn}
                        onPress={() => removeRecentHashtag(hashtag)}
                      >
                        <Text style={{ color: colors.text + '60', fontSize: 12 }}>✕</Text>
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
                      <ActivityIndicator size="large" color={colors.button} />
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
                          router.push(`/ProfileScreen?username=${result.name}` as any);
                          setIsSearchModalVisible(false);
                        }}
                      >
                        <Image
                          source={{
                            uri: result.avatarUrl || `https://images.hive.blog/u/${result.name}/avatar`
                          }}
                          style={styles.searchResultAvatar}
                        />
                        <View style={styles.searchResultInfo}>
                          <Text style={styles.searchResultUsername}>@{result.name}</Text>
                          <Text style={styles.searchResultMeta}>
                            {result.displayName && result.displayName !== result.name ? result.displayName : ''}
                          </Text>
                          {result.about && (
                            <Text
                              style={styles.searchResultContent}
                              numberOfLines={1}
                              ellipsizeMode="tail"
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
                    <FontAwesome name="hashtag" size={32} color={colors.icon} style={{ marginBottom: 8 }} />
                    <Text style={styles.searchEmptyText}>
                      Searching for #{searchQuery}...
                    </Text>
                    <Text style={[styles.searchEmptyText, { fontSize: 14, opacity: 0.7, marginTop: 8 }]}>
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