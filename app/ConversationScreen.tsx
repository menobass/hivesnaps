import React, { useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, FlatList, useColorScheme, Image } from 'react-native';
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
  const [replyText, setReplyText] = useState('');

  // Use Expo Router's useLocalSearchParams to get navigation params
  const params = useLocalSearchParams();
  const author = params.author as string | undefined;
  const permlink = params.permlink as string | undefined;
  console.log('Expo Router params:', params); // Debug log
  if (!author || !permlink) {
    console.error('Missing navigation parameters: author and permlink');
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: isDark ? '#15202B' : '#fff' }]}> 
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <Text style={{ color: isDark ? '#D7DBDC' : '#0F1419', fontSize: 16 }}>Error: Missing conversation parameters.</Text>
        </View>
      </SafeAreaView>
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
        setSnap({
          author: post.author,
          avatarUrl: undefined, // TODO: fetch avatar if needed
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

  const handleCancel = () => {
    setReplyText('');
    setReplyImage(null);
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
    setReplyText('');
    setReplyImage(null);
  };

  // Render a single reply (flat, not threaded yet)
  const renderReply = ({ item }: { item: ReplyData }) => (
    <View style={[styles.replyBubble, { backgroundColor: colors.bubble }]}> 
      <Text style={[styles.replyAuthor, { color: colors.text }]}>{item.author}</Text>
      <Text style={[styles.replyBody, { color: colors.text }]}>{item.body}</Text>
      <View style={styles.replyMeta}>
        <FontAwesome name="arrow-up" size={16} color={colors.icon} />
        <Text style={[styles.replyMetaText, { color: colors.text }]}>{item.voteCount || 0}</Text>
        <FontAwesome name="comment-o" size={16} color={colors.icon} style={{ marginLeft: 12 }} />
        <Text style={[styles.replyMetaText, { color: colors.payout }]}>{item.payout ? `$${item.payout.toFixed(2)}` : ''}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDark ? '#15202B' : '#fff' }]}> 
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
      {/* Snap as post */}
      {loading ? (
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <FontAwesome name="hourglass-half" size={48} color={colors.icon} style={{ marginBottom: 12 }} />
          <Text style={{ color: colors.text, fontSize: 16 }}>Loading conversation...</Text>
        </View>
      ) : snap ? (
        <View style={[styles.snapPost, { borderColor: colors.border, backgroundColor: colors.background }]}> 
          <Text style={[styles.snapAuthor, { color: colors.text }]}>{snap.author}</Text>
          <Text style={[styles.snapBody, { color: colors.text }]}>{snap.body}</Text>
          <View style={styles.snapMeta}>
            <FontAwesome name="arrow-up" size={18} color={colors.icon} />
            <Text style={[styles.snapMetaText, { color: colors.text }]}>{snap.voteCount || 0}</Text>
            <FontAwesome name="comment-o" size={18} color={colors.icon} style={{ marginLeft: 12 }} />
            <Text style={[styles.snapMetaText, { color: colors.text }]}>{snap.replyCount || 0}</Text>
            <Text style={[styles.snapMetaText, { color: colors.payout }]}>{snap.payout ? `$${snap.payout.toFixed(2)}` : ''}</Text>
          </View>
        </View>
      ) : null}
      {/* Reply input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.replyInputBox, { backgroundColor: colors.bubble, borderColor: colors.border }]}> 
          <TextInput
            style={[styles.replyInput, { backgroundColor: isDark ? '#15202B' : '#fff', color: isDark ? '#D7DBDC' : '#0F1419', borderColor: isDark ? '#38444D' : '#ddd' }]}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Write a reply..."
            placeholderTextColor={isDark ? '#8899A6' : '#888'}
            multiline
          />
          {replyImage && (
            <Image source={{ uri: replyImage }} style={{ width: 80, height: 80, borderRadius: 8, marginTop: 8 }} />
          )}
          <View style={styles.replyInputButtonsRow}>
            <TouchableOpacity onPress={handleAddImage} style={styles.addImageButton} disabled={uploading}>
              <FontAwesome name="image" size={22} color={uploading ? '#ccc' : '#1DA1F2'} />
            </TouchableOpacity>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
      {/* Replies */}
      <FlatList
        data={replies}
        renderItem={renderReply}
        keyExtractor={(_, idx) => idx.toString()}
        contentContainerStyle={styles.repliesList}
        style={{ flex: 1 }}
      />
    </SafeAreaView>
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
  snapMeta: { flexDirection: 'row', alignItems: 'center' },
  snapMetaText: { marginLeft: 4, fontSize: 14 },
  replyInputBox: { padding: 12, borderBottomWidth: 1 },
  replyInput: { minHeight: 40, fontSize: 15, borderRadius: 8, padding: 8, borderWidth: 1 },
  replyInputButtonsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  addImageButton: { marginRight: 12, padding: 4 },
  cancelButton: { marginRight: 12 },
  cancelButtonText: { color: '#888' },
  submitButton: { backgroundColor: '#1DA1F2', borderRadius: 6, paddingHorizontal: 16, paddingVertical: 6 },
  submitButtonText: { color: '#fff', fontWeight: 'bold' },
  repliesList: { padding: 12 },
  replyBubble: { borderRadius: 12, padding: 10, marginBottom: 10 },
  replyAuthor: { fontWeight: 'bold', fontSize: 14, marginBottom: 2 },
  replyBody: { fontSize: 14, marginBottom: 4 },
  replyMeta: { flexDirection: 'row', alignItems: 'center' },
  replyMetaText: { marginLeft: 4, fontSize: 13 },
});

export default ConversationScreen;
