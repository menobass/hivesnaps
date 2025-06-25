import React from 'react';
import { View, Text, Image, StyleSheet, useColorScheme } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

const twitterColors = {
  light: {
    background: '#FFFFFF',
    text: '#0F1419',
    bubble: '#F7F9F9',
    border: '#CFD9DE',
    icon: '#1DA1F2',
    payout: '#17BF63',
  },
  dark: {
    background: '#15202B',
    text: '#D7DBDC',
    bubble: '#22303C',
    border: '#38444D',
    icon: '#1DA1F2',
    payout: '#17BF63',
  },
};

interface SnapProps {
  author: string;
  avatarUrl?: string;
  body: string;
  created: string;
  voteCount?: number;
  replyCount?: number;
  payout?: number;
}

const Snap: React.FC<SnapProps> = ({ author, avatarUrl, body, created, voteCount = 0, replyCount = 0, payout = 0 }) => {
  const colorScheme = useColorScheme() || 'light';
  const colors = twitterColors[colorScheme];

  return (
    <View style={[styles.bubble, { backgroundColor: colors.bubble, borderColor: colors.border }]}> 
      {/* Top row: avatar, username, timestamp */}
      <View style={styles.topRow}>
        <Image source={avatarUrl ? { uri: avatarUrl } : require('../../assets/images/logo.jpg')} style={styles.avatar} />       
        <Text style={[styles.username, { color: colors.text }]}>{author}</Text>
        <Text style={[styles.timestamp, { color: colors.text }]}>{new Date(created).toLocaleString()}</Text>    
      </View>
      {/* Body */}
      <Text style={[styles.body, { color: colors.text }]}>{body}</Text>
      {/* VoteReplyBar */}
      <View style={styles.voteBar}>
        <FontAwesome name="arrow-up" size={18} color={colors.icon} style={styles.icon} />
        <Text style={[styles.voteCount, { color: colors.text }]}>{voteCount}</Text>
        <FontAwesome name="comment-o" size={18} color={colors.icon} style={styles.icon} />
        <Text style={[styles.replyCount, { color: colors.text }]}>{replyCount}</Text>
        <View style={{ flex: 1 }} />
        <Text style={[styles.payout, { color: colors.payout }]}>${payout.toFixed(2)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginVertical: 10,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#E1E8ED',
  },
  username: {
    fontWeight: 'bold',
    fontSize: 15,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 13,
    marginLeft: 'auto',
    opacity: 0.7,
  },
  body: {
    fontSize: 16,
    marginBottom: 10,
    marginLeft: 2,
  },
  voteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  icon: {
    marginRight: 4,
  },
  voteCount: {
    marginRight: 12,
    fontSize: 14,
  },
  replyCount: {
    marginRight: 12,
    fontSize: 14,
  },
  payout: {
    fontWeight: 'bold',
    fontSize: 15,
  },
});

export default Snap;
