import React, { useState } from 'react';
import { SafeAreaView as SafeAreaViewRN } from 'react-native';
import { SafeAreaView as SafeAreaViewSA, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, FlatList, useColorScheme, Image } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinaryFixed } from './utils/cloudinaryImageUploadFixed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Client } from '@hiveio/dhive';
import Modal from 'react-native-modal';
import Markdown from 'react-native-markdown-display';

// TODO: Replace these with your app's real auth/user context
const currentUsername = 'your_hive_username'; // e.g. from context or props
const postingKey = 'your_posting_key'; // e.g. from secure storage or wallet connect

// Placeholder Snap data type
interface SnapData {
  author: string;
  avatarUrl?: string;
  body: string;
  created: string;
  voteCount?: number;
  replyCount?: number;
  payout?: number;
  permlink?: string;
  hasUpvoted?: boolean;
}

// Placeholder reply type
interface ReplyData extends SnapData {
  replies?: ReplyData[];
}

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

const ConversationScreen = () => {
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Use Expo Router's useLocalSearchParams to get navigation params
  const params = useLocalSearchParams();
  const author = params.author as string | undefined;
  const permlink = params.permlink as string | undefined;
  console.log('Expo Router params:', params); // Debug log
  if (!author || !permlink) {
    console.error('Missing navigation parameters: author and permlink');
    return (
      <SafeAreaViewRN style={[styles.safeArea, { backgroundColor: isDark ? '#15202B' : '#fff' }]}> 
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <Text style={{ color: isDark ? '#D7DBDC' : '#0F1419', fontSize: 16 }}>Error: Missing conversation parameters.</Text>
        </View>
      </SafeAreaViewRN>
    );
  }

  const [snap, setSnap] = useState<SnapData | null>(null);
  const [replies, setReplies] = useState<ReplyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyImage, setReplyImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  // Track which reply (by author/permlink) is being replied to
  const [replyTarget, setReplyTarget] = useState<{author: string, permlink: string} | null>(null);

  // Recursively fetch replies, ensuring each reply has full content (including payout info)
  async function fetchRepliesTreeWithContent(author: string, permlink: string, depth = 0, maxDepth = 3): Promise<any[]> {
    if (depth > maxDepth) return [];
    // Fetch shallow replies
    const res = await fetch('https://api.hive.blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'condenser_api.get_content_replies',
        params: [author, permlink],
        id: 1,
      }),
    });
    const data = await res.json();
    const shallowReplies = data.result || [];
    // For each reply, fetch full content and recurse
    const fullReplies: ReplyData[] = [];
    for (const reply of shallowReplies) {
      // Fetch full content for this reply
      let fullReply;
      try {
        fullReply = await client.database.call('get_content', [reply.author, reply.permlink]);
      } catch (e) {
        fullReply = reply; // fallback
      }
      // Parse payout
      const payout = parseFloat(fullReply.pending_payout_value ? fullReply.pending_payout_value.replace(' HBD', '') : '0');
      // Recursively fetch children
      const childrenReplies = await fetchRepliesTreeWithContent(reply.author, reply.permlink, depth + 1, maxDepth);
      // Build reply object
      fullReplies.push({
        author: fullReply.author,
        body: fullReply.body,
        created: fullReply.created,
        voteCount: fullReply.net_votes,
        replyCount: fullReply.children,
        payout,
        permlink: fullReply.permlink,
        hasUpvoted: false, // TODO: check if user has upvoted
        replies: childrenReplies,
      });
    }
    return fullReplies;
  }

  React.useEffect(() => {
    const fetchSnapAndReplies = async () => {
      setLoading(true);
      try {
        // Fetch the main post
        const post = await client.database.call('get_content', [author, permlink]);
        // Fetch avatar robustly from account profile
        let avatarUrl: string | undefined = undefined;
        try {
          const accounts = await client.database.call('get_accounts', [[post.author]]);
          if (accounts && accounts[0]) {
            const meta = accounts[0].posting_json_metadata || accounts[0].json_metadata;
            if (meta) {
              let profile;
              try {
                profile = JSON.parse(meta).profile;
              } catch (e) {
                profile = undefined;
              }
              if (profile && profile.profile_image) {
                avatarUrl = profile.profile_image;
              }
            }
          }
        } catch (e) {
          // Avatar fetch fail fallback
        }
        setSnap({
          author: post.author,
          avatarUrl,
          body: post.body,
          created: post.created,
          voteCount: post.net_votes,
          replyCount: post.children,
          payout: parseFloat(post.pending_payout_value ? post.pending_payout_value.replace(' HBD', '') : '0'),
          permlink: post.permlink,
          hasUpvoted: false, // TODO: check if user has upvoted
        });
        // Fetch replies tree with full content (including payout info)
        const tree = await fetchRepliesTreeWithContent(author, permlink);
        setReplies(tree);
      } catch (e) {
        console.error('Error fetching snap and replies:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchSnapAndReplies();
  }, [author, permlink]);

  const colors = {
    background: isDark ? '#15202B' : '#fff',
    text: isDark ? '#D7DBDC' : '#0F1419',
    bubble: isDark ? '#22303C' : '#f7f9f9',
    border: isDark ? '#38444D' : '#eee',
    icon: '#1DA1F2',
    payout: '#17BF63',
  };

  const handleRefresh = () => {
    // TODO: Refresh replies from API
  };

  const handleAddImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploading(true);
        const asset = result.assets[0];
        const url = await uploadImageToCloudinaryFixed({
          uri: asset.uri,
          name: asset.fileName || 'reply.jpg',
          type: asset.type || 'image/jpeg',
        });
        setReplyImage(url);
      }
    } catch (e) {
      // Optionally show error
    } finally {
      setUploading(false);
    }
  };

  const handleOpenReplyModal = (author: string, permlink: string) => {
    setReplyTarget({ author, permlink });
    setReplyModalVisible(true);
  };
  const handleCloseReplyModal = () => {
    setReplyModalVisible(false);
    setReplyText('');
    setReplyImage(null);
    setReplyTarget(null);
  };

  const handleSubmitReply = async () => {
    if (!replyTarget || !replyText.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      let body = replyText.trim();
      if (replyImage) {
        body += `\n![image](${replyImage})`;
      }
      const parent_author = replyTarget.author;
      const parent_permlink = replyTarget.permlink;
      const author = currentUsername;
      const permlink = `re-${parent_author}-${parent_permlink}-${Date.now()}`;
      const json_metadata: any = {
        app: 'hivesnaps/1.0',
        format: 'markdown',
        tags: ['hivesnaps', 'reply'],
      };
      if (replyImage) {
        json_metadata.image = [replyImage];
      }
      // Uncomment below to enable real posting (make sure postingKey is correct and secure!)
      // await client.broadcast.comment({
      //   parent_author,
      //   parent_permlink,
      //   author,
      //   permlink,
      //   title: '',
      //   body,
      //   json_metadata: JSON.stringify(json_metadata),
      // }, postingKey);
      await new Promise(res => setTimeout(res, 1200)); // Simulate delay
      setReplyModalVisible(false);
      setReplyText('');
      setReplyImage(null);
      setPosting(false);
      setReplyTarget(null);
      handleRefresh();
    } catch (e: any) {
      setPostError(e.message || 'Failed to post reply.');
      setPosting(false);
    }
  };

  // Render a single reply (flat, not threaded yet)
  const renderReply = ({ item }: { item: ReplyData }) => {
    console.log('Reply payout:', item.payout, 'for', item.author, item.permlink);
    return (
      <View style={[styles.replyBubble, { backgroundColor: colors.bubble }]}> 
        <Text style={[styles.replyAuthor, { color: colors.text }]}>{item.author}</Text>
        <Markdown
          style={{
            body: { color: colors.text, fontSize: 14, marginBottom: 4 },
            link: { color: colors.icon },
          }}
        >
          {item.body}
        </Markdown>
        <View style={styles.replyMeta}>
          <FontAwesome name="arrow-up" size={16} color={colors.icon} />
          <Text style={[styles.replyMetaText, { color: colors.text }]}>{item.voteCount || 0}</Text>
          <FontAwesome name="comment-o" size={16} color={colors.icon} style={{ marginLeft: 12 }} />
          <Text style={[styles.replyMetaText, { color: colors.payout, marginLeft: 12 }]}>{item.payout !== undefined ? `$${item.payout.toFixed(2)}` : ''}</Text>
        </View>
      </View>
    );
  };

  // Custom markdown rules with 'any' types to silence TS warnings
  const markdownRules = {
    image: (
      node: any,
      children: any,
      parent: any,
      styles: any
    ) => {
      const { src, alt } = node.attributes;
      return (
        <Image
          key={src || alt}
          source={{ uri: src }}
          style={{ width: 220, height: 220, borderRadius: 10, marginVertical: 8, alignSelf: 'center' }}
          resizeMode="contain"
          accessible
          accessibilityLabel={alt || 'image'}
        />
      );
    },
  };

  // Add log for snap payout
  if (snap) {
    console.log('Snap payout:', snap.payout, 'for', snap.author, snap.permlink);
  }

  // Recursive threaded reply renderer
  const renderReplyTree = (reply: ReplyData, level = 0) => (
    <View key={reply.author + reply.permlink + '-' + level} style={{ marginLeft: level * 18, marginBottom: 10 }}>
      <View style={[styles.replyBubble, { backgroundColor: colors.bubble }]}> 
        <Text style={[styles.replyAuthor, { color: colors.text }]}>{reply.author}</Text>
        <Markdown
          style={{
            body: { color: colors.text, fontSize: 14, marginBottom: 4 },
            link: { color: colors.icon },
          }}
          rules={markdownRules}
        >
          {reply.body}
        </Markdown>
        <View style={styles.replyMeta}>
          <FontAwesome name="arrow-up" size={16} color={colors.icon} />
          <Text style={[styles.replyMetaText, { color: colors.text }]}>{reply.voteCount || 0}</Text>
          <FontAwesome name="comment-o" size={16} color={colors.icon} style={{ marginLeft: 12 }} />
          <Text style={[styles.replyMetaText, { color: colors.payout, marginLeft: 12 }]}>{reply.payout !== undefined ? `$${reply.payout.toFixed(2)}` : ''}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.replyButton} onPress={() => handleOpenReplyModal(reply.author, reply.permlink!)}>
            <FontAwesome name="reply" size={16} color={colors.icon} />
            <Text style={[styles.replyButtonText, { color: colors.icon }]}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Render children recursively */}
      {reply.replies && reply.replies.length > 0 && reply.replies.map((child, idx) => renderReplyTree(child, level + 1))}
    </View>
  );

  // Render the snap as a header for the replies list
  const renderSnapHeader = () => (
    snap ? (
      <View style={[styles.snapPost, { borderColor: colors.border, backgroundColor: colors.background }]}> 
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          {snap.avatarUrl ? (
            <Image source={{ uri: snap.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: isDark ? '#22303C' : '#eee', justifyContent: 'center', alignItems: 'center' }]}> 
              <FontAwesome name="user" size={22} color={isDark ? '#8899A6' : '#bbb'} />
            </View>
          )}
          <Text style={[styles.snapAuthor, { color: colors.text, marginLeft: 10 }]}>{snap.author}</Text>
          <Text style={[styles.snapTimestamp, { color: colors.text }]}>{snap.created ? new Date(snap.created).toLocaleString() : ''}</Text>
        </View>
        <Markdown
          style={{
            body: { color: colors.text, fontSize: 15, marginBottom: 8 },
            link: { color: colors.icon },
          }}
          rules={markdownRules}
        >
          {snap.body}
        </Markdown>
        <View style={[styles.snapMeta, { alignItems: 'center' }]}> 
          <FontAwesome name="arrow-up" size={18} color={colors.icon} />
          <Text style={[styles.snapMetaText, { color: colors.text }]}>{snap.voteCount || 0}</Text>
          <FontAwesome name="comment-o" size={18} color={colors.icon} style={{ marginLeft: 12 }} />
          <Text style={[styles.snapMetaText, { color: colors.text }]}>{snap.replyCount || 0}</Text>
          <Text style={[styles.snapMetaText, { color: colors.payout, marginLeft: 12 }]}>{snap.payout ? `$${snap.payout.toFixed(2)}` : ''}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.replyButton} onPress={() => handleOpenReplyModal(snap.author, snap.permlink!)}>
            <FontAwesome name="reply" size={18} color={colors.icon} />
            <Text style={[styles.replyButtonText, { color: colors.icon }]}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    ) : null
  );

  return (
    <SafeAreaViewRN style={[styles.safeArea, { backgroundColor: isDark ? '#15202B' : '#fff' }]}> 
      {/* Top bar */}
      <View style={[styles.topBar, { borderColor: colors.border, backgroundColor: colors.background }]}> 
        <TouchableOpacity onPress={() => router.back()} style={styles.topBarButton}>
          <FontAwesome name="arrow-left" size={24} color="#1DA1F2" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={handleRefresh} style={styles.topBarButton}>
          <FontAwesome name="refresh" size={24} color="#1DA1F2" />
        </TouchableOpacity>
      </View>
      {/* Conversation list (snap as header, replies as data) */}
      {loading ? (
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <FontAwesome name="hourglass-half" size={48} color={colors.icon} style={{ marginBottom: 12 }} />
          <Text style={{ color: colors.text, fontSize: 16 }}>Loading conversation...</Text>
        </View>
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <>
              {renderSnapHeader()}
              <View style={styles.repliesList}>
                {replies.map(reply => renderReplyTree(reply))}
              </View>
            </>
          }
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
      {/* Reply modal composer */}
      <Modal
        isVisible={replyModalVisible}
        onBackdropPress={posting ? undefined : handleCloseReplyModal}
        onBackButtonPress={posting ? undefined : handleCloseReplyModal}
        style={{ justifyContent: 'flex-end', margin: 0 }}
        useNativeDriver
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ backgroundColor: colors.background, padding: 16, borderTopLeftRadius: 18, borderTopRightRadius: 18 }}
        >
          <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
            Reply to {replyTarget?.author}
          </Text>
          <TextInput
            style={{
              minHeight: 60,
              color: colors.text,
              backgroundColor: colors.bubble,
              borderRadius: 10,
              padding: 10,
              fontSize: 15,
              marginBottom: 10,
            }}
            placeholder="Write your reply..."
            placeholderTextColor={isDark ? '#8899A6' : '#888'}
            multiline
            value={replyText}
            onChangeText={setReplyText}
            editable={!uploading && !posting}
          />
          {replyImage ? (
            <View style={{ marginBottom: 10 }}>
              <Image source={{ uri: replyImage }} style={{ width: 120, height: 120, borderRadius: 10 }} />
              <TouchableOpacity onPress={() => setReplyImage(null)} style={{ position: 'absolute', top: 4, right: 4 }} disabled={posting}>
                <FontAwesome name="close" size={20} color={colors.icon} />
              </TouchableOpacity>
            </View>
          ) : null}
          {postError ? (
            <Text style={{ color: 'red', marginBottom: 8 }}>{postError}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <TouchableOpacity onPress={handleAddImage} disabled={uploading || posting} style={{ marginRight: 16 }}>
              <FontAwesome name="image" size={22} color={colors.icon} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={handleSubmitReply}
              disabled={uploading || posting || !replyText.trim()}
              style={{
                backgroundColor: colors.icon,
                borderRadius: 20,
                paddingHorizontal: 18,
                paddingVertical: 8,
                opacity: uploading || posting || !replyText.trim() ? 0.6 : 1,
              }}
            >
              {posting ? (
                <FontAwesome name="spinner" size={16} color="#fff" style={{ marginRight: 8 }} />
              ) : null}
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{posting ? 'Posting...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaViewRN>
  );
};

export const options = { headerShown: false };

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  topBarButton: { padding: 6 },
  snapPost: { padding: 16, borderBottomWidth: 1 },
  snapAuthor: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  snapBody: { fontSize: 15, marginBottom: 8 },
  snapMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  snapMetaText: { marginLeft: 4, fontSize: 14 },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'auto',
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  replyButtonText: {
    marginLeft: 6,
    fontWeight: 'bold',
    fontSize: 15,
  },
  repliesList: { padding: 12 },
  replyBubble: { borderRadius: 12, padding: 10, marginBottom: 10 },
  replyAuthor: { fontWeight: 'bold', fontSize: 14, marginBottom: 2 },
  replyBody: { fontSize: 14, marginBottom: 4 },
  replyMeta: { flexDirection: 'row', alignItems: 'center' },
  replyMetaText: { marginLeft: 4, fontSize: 13 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  snapTimestamp: { fontSize: 12, color: '#8899A6', marginLeft: 8 },
});

export default ConversationScreen;
