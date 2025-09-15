import React, { useState, useCallback, useMemo } from 'react';
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
import PostBody from './components/PostBody';
import { Dimensions } from 'react-native';
import { useUserAuth } from '../hooks/useUserAuth';
import { useUpvote } from '../hooks/useUpvote';
import { useHiveData } from '../hooks/useHiveData';
import { useHivePostData } from '../hooks/useHivePostData';
import { HivePostScreenStyles } from '../styles/HivePostScreenStyles';
import { useReply, ReplyTarget } from '../hooks/useReply';
import { useGifPicker } from '../hooks/useGifPickerV2';
import UpvoteModal from '../components/UpvoteModal';
import { useMutedList } from '../store/context';
import Snap from './components/Snap';
import ContentModal from './components/ContentModal';
import { GifPickerModal } from '../components/GifPickerModalV2';
import genericAvatar from '../assets/images/generic-avatar.png';

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

  // Use the new hook for post and comments data
  const {
    post,
    comments,
    loading,
    commentsLoading,
    error,
    commentsError,
    refreshAll,
    updatePost,
    updateComment,
  } = useHivePostData(author, permlink, currentUsername);

  // Get muted list for filtering comments (includes personal mutes + global blacklist)
  const { mutedList } = useMutedList(currentUsername || '');

  // Create wrapper functions for useUpvote that match expected signatures
  const handleUpdatePost = useCallback((author: string, permlink: string, updates: any) => {
    updatePost(updates);
  }, [updatePost]);

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
  } = useUpvote(currentUsername, globalProps, rewardFund, hivePrice, handleUpdatePost, updateComment);

  // Reply functionality hook
  const {
    replyModalVisible,
    replyText,
    replyImage,
    replyGif,
    replyTarget,
    posting: replyPosting,
    uploading: replyUploading,
    processing: replyProcessing,
    error: replyError,
    openReplyModal,
    closeReplyModal,
    setReplyText,
    setReplyImage,
    setReplyGif,
    submitReply,
    addImage: addReplyImage,
    addGif: addReplyGif,
    clearError: clearReplyError,
  } = useReply(currentUsername, async () => {
    await refreshAll();
    return true; // Always return true since we refreshed
  });

    // GIF picker functionality - using new professional hook
  const gifPicker = useGifPicker({
    onGifSelected: (gifUrl: string) => {
      setReplyGif(gifUrl);
    },
    loadTrendingOnOpen: true,
    limit: 20,
  });

  const handleUpvotePress = useCallback(() => {
    if (!post) return;

    openUpvoteModal({
      author: post.author,
      permlink: post.permlink,
      snap: post,
    });
  }, [post, openUpvoteModal]);

  const handleRefresh = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  // Handle reply modal opening
  const handleOpenReplyModal = useCallback(
    (author: string, permlink: string) => {
      openReplyModal({ author, permlink });
    },
    [openReplyModal]
  );

  // Handle resnap from a Hive Post (same behavior as in Snap/Feed/Conversation)
  const handleResnap = useCallback(() => {
    if (!post?.author || !post?.permlink) return;
    const snapUrl = `https://hive.blog/@${post.author}/${post.permlink}`;
    router.push({ pathname: '/ComposeScreen', params: { resnapUrl: snapUrl } });
  }, [post, router]);

  // Handle GIF picker opening
  const handleOpenGifPicker = useCallback(
    (mode: 'reply') => {
      gifPicker.openPicker();
    },
    [gifPicker]
  );

  // Handle GIF selection
  const handleSelectGif = useCallback(
    (gifUrl: string) => {
      gifPicker.selectGif(gifUrl);
    },
    [gifPicker]
  );

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

  const windowWidth = Dimensions.get('window').width;

  // Filter comments to exclude muted users (includes personal mutes + global blacklist)
  const filteredComments = useMemo(() => {
    if (!comments || !mutedList) return comments;

    // Ensure mutedList is a Set for efficient lookups
    const mutedSet = mutedList instanceof Set ? mutedList : new Set(mutedList);
    
    const filterCommentsRecursively = (commentList: typeof comments): typeof comments => {
      return commentList
        .filter(comment => !mutedSet.has(comment.author))
        .map(comment => ({
          ...comment,
          replies: comment.replies ? filterCommentsRecursively(comment.replies) : undefined,
        }));
    };

    return filterCommentsRecursively(comments);
  }, [comments, mutedList]);

  // Function to flatten nested comments into a flat array with level information
  // This follows the same pattern as ConversationScreen for consistency
  const flattenComments = (
    commentList: any[],
    level = 0
  ): Array<any & { visualLevel: number }> => {
    const flattened: Array<any & { visualLevel: number }> = [];

    commentList.forEach(comment => {
      // Add the current comment with its visual level
      const maxVisualLevel = 2;
      const visualLevel = Math.min(level, maxVisualLevel);
      flattened.push({ ...comment, visualLevel });

      // Recursively flatten children
      if (comment.replies && comment.replies.length > 0) {
        const childComments = flattenComments(comment.replies, level + 1);
        flattened.push(...childComments);
      }
    });

    return flattened;
  };

  // Handle comment upvote press
  const handleCommentUpvotePress = useCallback(
    (params: { author: string; permlink: string }) => {
      // Find the comment in our data structure
      const findComment = (
        comments: any[],
        author: string,
        permlink: string
      ): any => {
        for (const comment of comments) {
          if (comment.author === author && comment.permlink === permlink) {
            return comment;
          }
          if (comment.replies) {
            const found = findComment(comment.replies, author, permlink);
            if (found) return found;
          }
        }
        return null;
      };

      const comment = findComment(comments, params.author, params.permlink);
      if (comment) {
        openUpvoteModal({
          author: comment.author,
          permlink: comment.permlink,
          snap: comment,
        });
      }
    },
    [comments, openUpvoteModal]
  );

  // Handle image press (placeholder for now)
  const handleImagePress = useCallback((imageUrl: string) => {
    console.log('Image pressed:', imageUrl);
    // TODO: Implement image viewer
  }, []);

  if (loading) {
    return (
      <SafeAreaViewSA
        style={[
          HivePostScreenStyles.safeArea,
          { backgroundColor: colors.background },
        ]}
      >
        <View style={HivePostScreenStyles.loadingContainer}>
          <ActivityIndicator size='large' color={colors.button} />
          <Text
            style={[HivePostScreenStyles.loadingText, { color: colors.text }]}
          >
            Loading post...
          </Text>
        </View>
      </SafeAreaViewSA>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaViewSA
        style={[
          HivePostScreenStyles.safeArea,
          { backgroundColor: colors.background },
        ]}
      >
        <View style={HivePostScreenStyles.errorContainer}>
          <FontAwesome
            name='exclamation-triangle'
            size={48}
            color={colors.icon}
          />
          <Text
            style={[HivePostScreenStyles.errorText, { color: colors.text }]}
          >
            {error || 'Post not found'}
          </Text>
          <TouchableOpacity
            onPress={handleRefresh}
            style={[
              HivePostScreenStyles.retryButton,
              { backgroundColor: colors.button },
            ]}
          >
            <Text
              style={[
                HivePostScreenStyles.retryButtonText,
                { color: colors.buttonText },
              ]}
            >
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaViewSA>
    );
  }

  return (
    <SafeAreaViewSA
      style={[
        HivePostScreenStyles.safeArea,
        { backgroundColor: colors.background },
      ]}
    >
      {/* Header */}
      <View
        style={[
          HivePostScreenStyles.header,
          { borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome name='arrow-left' size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          style={[HivePostScreenStyles.headerTitle, { color: colors.text }]}
        >
          Hive Post
        </Text>
        <TouchableOpacity onPress={handleRefresh}>
          <FontAwesome name='refresh' size={20} color={colors.icon} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={HivePostScreenStyles.scrollContainer}
        contentContainerStyle={HivePostScreenStyles.contentContainer}
      >
        {/* Author Info */}
        <View style={HivePostScreenStyles.authorInfo}>
          <ExpoImage
            source={post.avatarUrl ? { uri: post.avatarUrl } : genericAvatar}
            style={HivePostScreenStyles.avatar}
            contentFit='cover'
          />
          <View style={HivePostScreenStyles.authorDetails}>
            <Text
              style={[HivePostScreenStyles.authorName, { color: colors.text }]}
            >
              {post.author}
            </Text>
            <Text
              style={[HivePostScreenStyles.timestamp, { color: colors.icon }]}
            >
              {new Date(post.created + 'Z').toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Title */}
        {post.title && (
          <Text style={[HivePostScreenStyles.title, { color: colors.text }]}>
            {post.title}
          </Text>
        )}

        {/* Content */}
        <PostBody body={post.body} colors={colors} isDark={isDark} />

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <View style={HivePostScreenStyles.tagsContainer}>
            {post.tags.slice(0, 5).map((tag, index) => (
              <View
                key={index}
                style={[
                  HivePostScreenStyles.tag,
                  { backgroundColor: colors.button },
                ]}
              >
                <Text
                  style={[
                    HivePostScreenStyles.tagText,
                    { color: colors.buttonText },
                  ]}
                >
                  #{tag}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Engagement Metrics */}
        <View
          style={[
            HivePostScreenStyles.engagementMetrics,
            { borderTopColor: colors.border },
          ]}
        >
          <View style={HivePostScreenStyles.engagementLeft}>
            <TouchableOpacity
              onPress={handleUpvotePress}
              disabled={post.hasUpvoted}
              style={HivePostScreenStyles.upvoteButton}
            >
              <FontAwesome
                name='arrow-up'
                size={20}
                color={post.hasUpvoted ? '#8e44ad' : colors.icon}
              />
            </TouchableOpacity>
            <Text
              style={[
                HivePostScreenStyles.engagementText,
                { color: colors.text },
              ]}
            >
              {post.voteCount}
            </Text>
            <FontAwesome
              name='comment-o'
              size={16}
              color={colors.icon}
              style={HivePostScreenStyles.commentIcon}
            />
            <Text
              style={[
                HivePostScreenStyles.engagementText,
                { color: colors.text },
              ]}
            >
              {post.replyCount}
            </Text>
            <TouchableOpacity
              onPress={() => handleOpenReplyModal(post.author, post.permlink)}
              style={HivePostScreenStyles.replyButton}
            >
              <FontAwesome
                name='reply'
                size={16}
                color={colors.icon}
                style={HivePostScreenStyles.replyIcon}
              />
              <Text
                style={[HivePostScreenStyles.replyText, { color: colors.text }]}
              >
                Reply
              </Text>
            </TouchableOpacity>
            {/* Resnap button - follow same order as elsewhere: after Reply */}
            <TouchableOpacity
              onPress={handleResnap}
              accessibilityRole='button'
              accessibilityLabel='Resnap this post'
              style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}
            >
              <FontAwesome name='retweet' size={18} color={colors.icon} />
            </TouchableOpacity>
          </View>
          <Text
            style={[HivePostScreenStyles.payoutText, { color: colors.payout }]}
          >
            ${post.payout.toFixed(2)}
          </Text>
        </View>

        {/* Comments Section */}
        <View style={HivePostScreenStyles.commentsSection}>
          <View
            style={[
              HivePostScreenStyles.commentsHeader,
              {
                borderTopColor: colors.border,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                HivePostScreenStyles.commentsHeaderText,
                { color: colors.text },
              ]}
            >
              Comments ({post.replyCount})
            </Text>
            {commentsLoading && (
              <ActivityIndicator size='small' color={colors.button} />
            )}
          </View>

          {/* Comments Error */}
          {commentsError && (
            <View style={HivePostScreenStyles.commentsError}>
              <Text
                style={[
                  HivePostScreenStyles.commentsErrorText,
                  { color: colors.icon },
                ]}
              >
                {commentsError}
              </Text>
              <TouchableOpacity
                onPress={refreshAll}
                style={[
                  HivePostScreenStyles.retryCommentsButton,
                  { backgroundColor: colors.button },
                ]}
              >
                <Text
                  style={[
                    HivePostScreenStyles.retryCommentsButtonText,
                    { color: colors.buttonText },
                  ]}
                >
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Render Comments */}
          {!commentsLoading && !commentsError && filteredComments.length > 0 && (
            <View style={HivePostScreenStyles.commentsList}>
              {flattenComments(filteredComments).map(comment => (
                <Snap
                  key={
                    comment.author +
                    comment.permlink +
                    '-' +
                    comment.visualLevel
                  }
                  snap={{...comment, community: post?.category}}
                  onUpvotePress={handleCommentUpvotePress}
                  onReplyPress={handleOpenReplyModal}
                  onEditPress={(snapData: { author: string; permlink: string; body: string }) => {
                    console.log('Edit comment:', snapData);
                    // TODO: Implement edit functionality
                  }}
                  onUserPress={username => {
                    router.push(`/ProfileScreen?username=${username}` as any);
                  }}
                  onImagePress={handleImagePress}
                  currentUsername={currentUsername}
                  // Reply-specific props
                  visualLevel={comment.visualLevel}
                  isReply={true}
                  compactMode={true}
                  showAuthor={true}
                />
              ))}
            </View>
          )}

          {/* No Comments State */}
          {!commentsLoading && !commentsError && filteredComments.length === 0 && (
            <View style={HivePostScreenStyles.noCommentsContainer}>
              <FontAwesome name='comment-o' size={32} color={colors.icon} />
              <Text
                style={[
                  HivePostScreenStyles.noCommentsText,
                  { color: colors.icon },
                ]}
              >
                No comments yet. Be the first to comment!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Reply Modal */}
      <ContentModal
        isVisible={replyModalVisible}
        onClose={closeReplyModal}
        onSubmit={submitReply}
        mode='reply'
        target={replyTarget}
        text={replyText}
        onTextChange={setReplyText}
        image={replyImage}
        gif={replyGif}
        onImageRemove={() => setReplyImage(null)}
        onGifRemove={() => setReplyGif(null)}
        onAddImage={() => addReplyImage('reply')}
        onAddGif={() => handleOpenGifPicker('reply')}
        posting={replyPosting}
        uploading={replyUploading}
        processing={replyProcessing}
        error={replyError}
        currentUsername={currentUsername}
      />

      {/* Professional GIF Picker Modal */}
      <GifPickerModal
        visible={gifPicker.state.modalVisible}
        onClose={gifPicker.closePicker}
        onSelectGif={gifPicker.selectGif}
        searchQuery={gifPicker.state.searchQuery}
        onSearchQueryChange={gifPicker.setSearchQuery}
        onSearchSubmit={gifPicker.searchGifs}
        gifResults={gifPicker.state.results}
        loading={gifPicker.state.loading}
        error={gifPicker.state.error}
        colors={{
          background: colors.background,
          text: colors.text,
          inputBg: colors.border,
          inputBorder: colors.border,
          button: colors.button,
        }}
      />

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
