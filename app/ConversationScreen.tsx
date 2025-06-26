import React, { useState } from 'react';
import { SafeAreaView as SafeAreaViewRN } from 'react-native';
import { SafeAreaView as SafeAreaViewSA, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, FlatList, useColorScheme, Image } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinaryFixed } from './utils/cloudinaryImageUploadFixed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Client } from '@hiveio/dhive';

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

  async function fetchRepliesTree(author: string, permlink: string, depth = 0, maxDepth = 3): Promise<any[]> {
    if (depth > maxDepth) return [];
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
    const replies = data.result || [];
    for (const reply of replies) {
      reply.childrenReplies = await fetchRepliesTree(reply.author, reply.permlink, depth + 1, maxDepth);
    }
    return replies;
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
        // Fetch replies tree
        const tree = await fetchRepliesTree(author, permlink);
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

  const handleSubmit = () => {
    // TODO: Submit reply logic
    setReplyImage(null);
  };

  // Render a single reply (flat, not threaded yet)
  const renderReply = ({ item }: { item: ReplyData }) => {
    console.log('Reply payout:', item.payout, 'for', item.author, item.permlink);
    return (
      <View style={[styles.replyBubble, { backgroundColor: colors.bubble }]}> 
        <Text style={[styles.replyAuthor, { color: colors.text }]}>{item.author}</Text>
        <Text style={[styles.replyBody, { color: colors.text }]}>{item.body}</Text>
        <View style={styles.replyMeta}>
          <FontAwesome name="arrow-up" size={16} color={colors.icon} />
          <Text style={[styles.replyMetaText, { color: colors.text }]}>{item.voteCount || 0}</Text>
          <FontAwesome name="comment-o" size={16} color={colors.icon} style={{ marginLeft: 12 }} />
          <Text style={[styles.replyMetaText, { color: colors.payout, marginLeft: 12 }]}>{item.payout !== undefined ? `$${item.payout.toFixed(2)}` : ''}</Text>
        </View>
      </View>
    );
  };

  // Add log for snap payout
  if (snap) {
    console.log('Snap payout:', snap.payout, 'for', snap.author, snap.permlink);
  }

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
        <Text style={[styles.snapBody, { color: colors.text }]}>{snap.body}</Text>
        <View style={[styles.snapMeta, { alignItems: 'center' }]}> 
          <FontAwesome name="arrow-up" size={18} color={colors.icon} />
          <Text style={[styles.snapMetaText, { color: colors.text }]}>{snap.voteCount || 0}</Text>
          <FontAwesome name="comment-o" size={18} color={colors.icon} style={{ marginLeft: 12 }} />
          <Text style={[styles.snapMetaText, { color: colors.text }]}>{snap.replyCount || 0}</Text>
          <Text style={[styles.snapMetaText, { color: colors.payout, marginLeft: 12 }]}>{snap.payout ? `$${snap.payout.toFixed(2)}` : ''}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.replyButton} onPress={() => {/* TODO: open reply modal */}}>
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
          data={replies}
          renderItem={renderReply}
          keyExtractor={(_, idx) => idx.toString()}
          contentContainerStyle={styles.repliesList}
          ListHeaderComponent={renderSnapHeader}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
      {/* Reply input removed; will use modal/composer */}
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
