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
import SnapieHivePostRenderer from '../components/SnapieHivePostRenderer';
import { Dimensions } from 'react-native';
import { useCurrentUser } from '../../store/context';
import { useUpvote } from '../../hooks/useUpvote';
import { useHiveData } from '../../hooks/useHiveData';
import { useHivePostData } from '../../hooks/useHivePostData';
import { HivePostScreenStyles } from '../../styles/HivePostScreenStyles';
import { useReply, ReplyTarget } from '../../hooks/useReply';
import { useGifPicker } from '../../hooks/useGifPickerV2';
import UpvoteModal from '../../components/UpvoteModal';
import { useMutedList } from '../../store/context';
import Snap from '../components/Snap';
import ContentModal from '../components/ContentModal';
import { GifPickerModal } from '../../components/GifPickerModalV2';
import genericAvatar from '../../assets/images/generic-avatar.png';

const HivePostScreen = () => {
  const { author, permlink } = useLocalSearchParams<{
    author: string;
    permlink: string;
  }>();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currentUsername = useCurrentUser();
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
    replyImages,
    replyGifs,
    replyTarget,
    posting: replyPosting,
    uploading: replyUploading,
    processing: replyProcessing,
    error: replyError,
    openReplyModal,
    closeReplyModal,
    setReplyText,
    setReplyImages,
    setReplyGifs,
    addReplyImage,
    removeReplyImage,
    addReplyGif,
    removeReplyGif,
    submitReply,
    addImage: addImage,
    addGif,
    clearError: clearReplyError,
  } = useReply(currentUsername, async () => {
    await refreshAll();
    return true; // Always return true since we refreshed
  });

  // GIF picker functionality - using new professional hook
  const gifPicker = useGifPicker({
    onGifSelected: (gifUrl: string) => {
      addGif(gifUrl);
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
    router.push({ pathname: '/screens/ComposeScreen', params: { resnapUrl: snapUrl } });
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

  // Show loading state during initial fetch, only show error after actual failure
  if (loading && !post && !error) {
    return (
      <SafeAreaViewSA
        style={[
          HivePostScreenStyles.safeArea,
          { backgroundColor: colors.background },
        ]}
      >
        <View
          style={HivePostScreenStyles.errorContainer}
          accessible={true}
          accessibilityLabel="Loading post"
          accessibilityHint="Please wait while the post content is being loaded"
        >
          <ActivityIndicator
            size="large"
            color={colors.icon}
            accessibilityLabel="Loading post content"
          />
          <Text
            style={[HivePostScreenStyles.errorText, { color: colors.text }]}
          >
            Loading post...
          </Text>
        </View>
      </SafeAreaViewSA>
    );
  }

  if (error || (!post && !loading)) {
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

  // Ensure post exists before rendering (should not happen due to above checks)
  if (!post) {
    return null;
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

      {/* Snapie.io WebView Renderer - takes all available space and scrolls internally */}
      <SnapieHivePostRenderer
        author={post.author}
        permlink={post.permlink}
        colors={{
          background: colors.background,
          text: colors.text,
        }}
        onExternalLink={(url) => {
          console.log('[HivePostScreen] External link clicked:', url);
          Linking.openURL(url);
        }}
      />

      {/* Reply Modal */}
      <ContentModal
        isVisible={replyModalVisible}
        onClose={closeReplyModal}
        onSubmit={submitReply}
        mode='reply'
        target={replyTarget}
        text={replyText}
        onTextChange={setReplyText}
        images={replyImages}
        gifs={replyGifs}
        onImageRemove={removeReplyImage}
        onGifRemove={removeReplyGif}
        onAddImage={() => addImage('reply')}
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
    </SafeAreaViewSA >
  );
};

export default HivePostScreen;

export const options = { headerShown: false };
