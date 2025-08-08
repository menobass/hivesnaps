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
  TextInput,
  FlatList,
  Image,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import Modal from 'react-native-modal';
import SafeRenderHtml from '../components/SafeRenderHtml';
import { Dimensions } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useUserAuth } from '../hooks/useUserAuth';
import { useUpvote } from '../hooks/useUpvote';
import { useHiveData } from '../hooks/useHiveData';
import { useHivePostData } from '../hooks/useHivePostData';
import { HivePostScreenStyles } from '../styles/HivePostScreenStyles';
import { useReply, ReplyTarget } from '../hooks/useReply';
import { useGifPicker, GifMode } from '../hooks/useGifPicker';
import UpvoteModal from '../components/UpvoteModal';
import Reply from './components/Reply';
import ContentModal from './components/ContentModal';
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

  // GIF picker functionality
  const {
    gifModalVisible,
    gifSearchQuery,
    gifResults,
    gifLoading,
    openGifPicker,
    closeGifModal,
    setGifSearchQuery,
    searchGifs,
    selectGif,
  } = useGifPicker();

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
  const handleOpenReplyModal = useCallback((author: string, permlink: string) => {
    openReplyModal({ author, permlink });
  }, [openReplyModal]);

  // Handle GIF picker opening
  const handleOpenGifPicker = useCallback((mode: GifMode) => {
    openGifPicker(mode);
  }, [openGifPicker]);

  // Handle GIF selection
  const handleSelectGif = useCallback((gifUrl: string) => {
    selectGif(gifUrl);
    addReplyGif(gifUrl);
  }, [selectGif, addReplyGif]);

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
      const findComment = (comments: any[], author: string, permlink: string): any => {
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
      <SafeAreaViewSA style={[HivePostScreenStyles.safeArea, { backgroundColor: colors.background }]}>
        <View style={HivePostScreenStyles.loadingContainer}>
          <ActivityIndicator size='large' color={colors.button} />
          <Text style={[HivePostScreenStyles.loadingText, { color: colors.text }]}>
            Loading post...
          </Text>
        </View>
      </SafeAreaViewSA>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaViewSA style={[HivePostScreenStyles.safeArea, { backgroundColor: colors.background }]}>
        <View style={HivePostScreenStyles.errorContainer}>
          <FontAwesome
            name='exclamation-triangle'
            size={48}
            color={colors.icon}
          />
          <Text style={[HivePostScreenStyles.errorText, { color: colors.text }]}>
            {error || 'Post not found'}
          </Text>
          <TouchableOpacity
            onPress={handleRefresh}
            style={[HivePostScreenStyles.retryButton, { backgroundColor: colors.button }]}
          >
            <Text style={[HivePostScreenStyles.retryButtonText, { color: colors.buttonText }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaViewSA>
    );
  }

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
    <SafeAreaViewSA style={[HivePostScreenStyles.safeArea, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[HivePostScreenStyles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome name='arrow-left' size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[HivePostScreenStyles.headerTitle, { color: colors.text }]}>
          Hive Post
        </Text>
        <TouchableOpacity onPress={handleRefresh}>
          <FontAwesome name='refresh' size={20} color={colors.icon} />
        </TouchableOpacity>
      </View>

      <ScrollView style={HivePostScreenStyles.scrollContainer} contentContainerStyle={HivePostScreenStyles.contentContainer}>
        {/* Author Info */}
        <View style={HivePostScreenStyles.authorInfo}>
          <ExpoImage
            source={post.avatarUrl ? { uri: post.avatarUrl } : genericAvatar}
            style={HivePostScreenStyles.avatar}
            contentFit='cover'
          />
          <View style={HivePostScreenStyles.authorDetails}>
            <Text style={[HivePostScreenStyles.authorName, { color: colors.text }]}>
              {post.author}
            </Text>
            <Text style={[HivePostScreenStyles.timestamp, { color: colors.icon }]}>
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
        <View style={HivePostScreenStyles.contentBody}>
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
          <View style={HivePostScreenStyles.tagsContainer}>
            {post.tags.slice(0, 5).map((tag, index) => (
              <View
                key={index}
                style={[HivePostScreenStyles.tag, { backgroundColor: colors.button }]}
              >
                <Text style={[HivePostScreenStyles.tagText, { color: colors.buttonText }]}>
                  #{tag}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Engagement Metrics */}
        <View style={[HivePostScreenStyles.engagementMetrics, { borderTopColor: colors.border }]}>
          <View style={HivePostScreenStyles.engagementLeft}>
            <TouchableOpacity
              onPress={handleUpvotePress}
              disabled={post.active_votes?.some(
                (vote: any) =>
                  vote.voter === currentUsername && vote.percent > 0
              )}
              style={HivePostScreenStyles.upvoteButton}
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
            <Text style={[HivePostScreenStyles.engagementText, { color: colors.text }]}>
              {post.voteCount}
            </Text>
            <FontAwesome
              name='comment-o'
              size={16}
              color={colors.icon}
              style={HivePostScreenStyles.commentIcon}
            />
            <Text style={[HivePostScreenStyles.engagementText, { color: colors.text }]}>
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
              <Text style={[HivePostScreenStyles.replyText, { color: colors.text }]}>
                Reply
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[HivePostScreenStyles.payoutText, { color: colors.payout }]}>
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
              }
            ]}
          >
            <Text style={[HivePostScreenStyles.commentsHeaderText, { color: colors.text }]}>
              Comments ({post.replyCount})
            </Text>
            {commentsLoading && (
              <ActivityIndicator size="small" color={colors.button} />
            )}
          </View>

          {/* Comments Error */}
          {commentsError && (
            <View style={HivePostScreenStyles.commentsError}>
              <Text style={[HivePostScreenStyles.commentsErrorText, { color: colors.icon }]}>
                {commentsError}
              </Text>
              <TouchableOpacity
                onPress={refreshAll}
                style={[HivePostScreenStyles.retryCommentsButton, { backgroundColor: colors.button }]}
              >
                <Text style={[HivePostScreenStyles.retryCommentsButtonText, { color: colors.buttonText }]}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Render Comments */}
          {!commentsLoading && !commentsError && comments.length > 0 && (
            <View style={HivePostScreenStyles.commentsList}>
              {flattenComments(comments).map(comment => (
                <Reply
                  key={comment.author + comment.permlink + '-' + comment.visualLevel}
                  reply={comment}
                  onUpvotePress={handleCommentUpvotePress}
                  onReplyPress={handleOpenReplyModal}
                  onEditPress={(comment) => {
                    console.log('Edit comment:', comment);
                    // TODO: Implement edit functionality
                  }}
                  onImagePress={handleImagePress}
                  currentUsername={currentUsername}
                  colors={{
                    text: colors.text,
                    bubble: colors.background,
                    icon: colors.icon,
                    payout: colors.payout,
                    button: colors.button,
                    buttonText: colors.buttonText,
                  }}
                />
              ))}
            </View>
          )}

          {/* No Comments State */}
          {!commentsLoading && !commentsError && comments.length === 0 && (
            <View style={HivePostScreenStyles.noCommentsContainer}>
              <FontAwesome name="comment-o" size={32} color={colors.icon} />
              <Text style={[HivePostScreenStyles.noCommentsText, { color: colors.icon }]}>
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

      {/* GIF Picker Modal */}
      <Modal
        isVisible={gifModalVisible}
        onBackdropPress={closeGifModal}
        onBackButtonPress={closeGifModal}
        style={{ justifyContent: 'flex-start', margin: 0 }}
        useNativeDriver
      >
        <View style={[HivePostScreenStyles.gifModalContainer, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[HivePostScreenStyles.gifModalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[HivePostScreenStyles.gifModalTitle, { color: colors.text }]}>
              Choose a GIF
            </Text>
            <Pressable
              onPress={closeGifModal}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                padding: 4,
              })}
            >
              <FontAwesome name='times' size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Search Bar */}
          <View style={[HivePostScreenStyles.gifSearchContainer, { borderBottomColor: colors.border }]}>
            <View style={[HivePostScreenStyles.gifSearchInputContainer, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
              <FontAwesome
                name='search'
                size={16}
                color={colors.text}
                style={{ marginRight: 12 }}
              />
              <TextInput
                placeholder='Search GIFs...'
                placeholderTextColor={colors.text + '80'}
                value={gifSearchQuery}
                onChangeText={setGifSearchQuery}
                onSubmitEditing={() => searchGifs(gifSearchQuery)}
                style={[HivePostScreenStyles.gifSearchInput, { color: colors.text }]}
                returnKeyType='search'
              />
              {gifSearchQuery.length > 0 && (
                <Pressable
                  onPress={() => {
                    setGifSearchQuery('');
                    searchGifs('');
                  }}
                  style={HivePostScreenStyles.gifClearButton}
                >
                  <FontAwesome
                    name='times-circle'
                    size={16}
                    color={colors.text + '60'}
                  />
                </Pressable>
              )}
            </View>
          </View>

          {/* GIF Grid */}
          <View style={HivePostScreenStyles.gifGrid}>
            {gifLoading ? (
              <View style={HivePostScreenStyles.gifLoadingContainer}>
                <ActivityIndicator size='large' color={colors.icon} />
                <Text style={[HivePostScreenStyles.gifEmptyText, { color: colors.text }]}>
                  {gifSearchQuery.trim() ? 'Searching GIFs...' : 'Loading...'}
                </Text>
              </View>
            ) : gifResults.length > 0 ? (
              <FlatList
                data={gifResults}
                renderItem={({ item, index }) => {
                  const {
                    getBestGifUrl,
                    getGifPreviewUrl,
                  } = require('../utils/tenorApi');
                  const gifUrl = getBestGifUrl(item);
                  const previewUrl = getGifPreviewUrl(item);

                  return (
                    <Pressable
                      onPress={() => handleSelectGif(gifUrl)}
                      style={({ pressed }) => [
                        HivePostScreenStyles.gifItem,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Image
                        source={{ uri: previewUrl || gifUrl }}
                        style={[
                          HivePostScreenStyles.gifImage,
                          { backgroundColor: isDark ? '#333' : '#f0f0f0' }
                        ]}
                        resizeMode='cover'
                      />
                    </Pressable>
                  );
                }}
                numColumns={2}
                keyExtractor={(item, index) => index.toString()}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={HivePostScreenStyles.gifGridContent}
              />
            ) : (
              <View style={HivePostScreenStyles.gifEmptyContainer}>
                <FontAwesome name='search' size={48} color={colors.icon} />
                <Text style={[HivePostScreenStyles.gifEmptyText, { color: colors.text }]}>
                  {gifSearchQuery.trim()
                    ? 'No GIFs found. Try a different search.'
                    : 'Search for GIFs to add to your reply'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

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
