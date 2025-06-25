import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, useColorScheme, Dimensions } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

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

export default function FeedScreen() {
  const colorScheme = useColorScheme() || 'light';
  const colors = twitterColors[colorScheme];
  const username = 'meno'; // placeholder

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      {/* Top bar */}
      <View style={styles.topBar}>
        {/* User avatar instead of logo */}
        <Image source={require('../assets/images/avatar-placeholder.png')} style={styles.avatar} />
        <Text style={[styles.username, { color: colors.text }]}>{username}</Text>
        <TouchableOpacity style={styles.logoutBtn}>
          <FontAwesome name="sign-out" size={24} color={colors.icon} />
        </TouchableOpacity>
      </View>
      {/* Slogan row */}
      <View style={styles.sloganRow}>
        <Text style={[styles.slogan, { color: colors.text }]}>What's snappening today?</Text>
        <TouchableOpacity style={styles.bellBtn}>
          <FontAwesome name="bell" size={22} color={colors.icon} />
        </TouchableOpacity>
      </View>
      {/* Filter buttons */}
      <View style={styles.filterRow}>
        <TouchableOpacity style={[styles.filterBtn, { backgroundColor: colors.button }]}>
          <Text style={[styles.filterText, { color: colors.buttonText }]}>Following</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterBtn, { backgroundColor: colors.buttonInactive }]}> 
          <Text style={[styles.filterText, { color: colors.text }]}>Newest</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterBtn, { backgroundColor: colors.buttonInactive }]}> 
          <Text style={[styles.filterText, { color: colors.text }]}>Trending</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterBtn, { backgroundColor: colors.buttonInactive }]}> 
          <Text style={[styles.filterText, { color: colors.text }]}>My Snaps</Text>
        </TouchableOpacity>
      </View>
      {/* Placeholder for feed */}
      <View style={styles.feedPlaceholder}>
        <Text style={{ color: colors.text, opacity: 0.5 }}>Feed goes here...</Text>
      </View>
    </View>
  );
}

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
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  logoutBtn: {
    padding: 4,
    marginLeft: 8,
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
  feedPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
