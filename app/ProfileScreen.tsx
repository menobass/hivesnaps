import React, { useState, useEffect } from 'react';
import { SafeAreaView as SafeAreaViewSA } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, Image, ScrollView, Modal, Pressable, Platform, ActivityIndicator, TextInput, KeyboardAvoidingView } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Client, PrivateKey } from '@hiveio/dhive';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinaryFixed } from '../utils/cloudinaryImageUploadFixed';
import { invalidateAvatarCache } from './FeedScreen';

// Profile data interface
interface ProfileData {
  username: string;
  avatarUrl?: string;
  reputation: number;
  hivePower: number;
  hbd: number;
  displayName?: string;
  about?: string;
  location?: string;
  website?: string;
  followingCount?: number;
  followersCount?: number;
  // Unclaimed rewards
  unclaimedHive?: number;
  unclaimedHbd?: number;
  unclaimedVests?: number;
}

// User snap interface for profile bubbles
interface UserSnap {
  author: string;
  permlink: string;
  parent_author: string;
  parent_permlink: string;
  body: string;
  created: string;
  net_votes?: number;
  children?: number;
  pending_payout_value?: string;
  total_payout_value?: string;
  active_votes?: any[];
  [key: string]: any;
}

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

// Helper function to convert VESTS to Hive Power
const vestsToHp = (vests: number, totalVestingFundHive: any, totalVestingShares: any): number => {
  // Handle both string and Asset types from global props
  const totalVestingFundHiveStr = typeof totalVestingFundHive === 'string' 
    ? totalVestingFundHive 
    : totalVestingFundHive.toString();
  const totalVestingSharesStr = typeof totalVestingShares === 'string' 
    ? totalVestingShares 
    : totalVestingShares.toString();
    
  const totalVestingFundHiveNum = parseFloat(totalVestingFundHiveStr.replace(' HIVE', ''));
  const totalVestingSharesNum = parseFloat(totalVestingSharesStr.replace(' VESTS', ''));
  
  if (totalVestingSharesNum === 0) {
    return 0;
  }
  
  const hivePerVests = totalVestingFundHiveNum / totalVestingSharesNum;
  const hp = vests * hivePerVests;
  
  return hp;
};

const ProfileScreen = () => {
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Get username from params
  const username = params.username as string | undefined;
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [muteLoading, setMuteLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [globalProps, setGlobalProps] = useState<any>(null);
  // User snaps state
  const [userSnaps, setUserSnaps] = useState<UserSnap[]>([]);
  const [snapsLoading, setSnapsLoading] = useState(false);
  const [snapsError, setSnapsError] = useState<string | null>(null);
  const [snapsLoaded, setSnapsLoaded] = useState(false);
  
  // Profile image update state
  const [editAvatarModalVisible, setEditAvatarModalVisible] = useState(false);
  const [newAvatarImage, setNewAvatarImage] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUpdateLoading, setAvatarUpdateLoading] = useState(false);
  const [avatarUpdateSuccess, setAvatarUpdateSuccess] = useState(false);
  // Active key modal state (second step)
  const [activeKeyModalVisible, setActiveKeyModalVisible] = useState(false);
  const [activeKeyInput, setActiveKeyInput] = useState('');

  const colors = {
    background: isDark ? '#15202B' : '#fff',
    text: isDark ? '#D7DBDC' : '#0F1419',
    bubble: isDark ? '#22303C' : '#f7f9f9',
    border: isDark ? '#38444D' : '#eee',
    icon: '#1DA1F2',
    payout: '#17BF63',
    button: '#1DA1F2',
    buttonText: '#fff',
    buttonInactive: isDark ? '#22303C' : '#E1E8ED',
    mutedButton: '#E74C3C',
    followButton: '#1DA1F2',
    unfollowButton: '#8B9DC3',
  };

  // Load current user credentials
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const storedUsername = await SecureStore.getItemAsync('hive_username');
        setCurrentUsername(storedUsername);
      } catch (e) {
        console.error('Error loading credentials:', e);
      }
    };
    loadCredentials();
  }, []);

  // Fetch profile data (simplified approach for follow counts)
  // Updated to use Ecency's exact calculation methods for reputation and Hive Power
  const fetchProfileData = async () => {
    if (!username) return;
    
    setLoading(true);
    try {
      // Try multiple methods to get account data
      console.log('Fetching account data for:', username);
      
      // Method 1: dhive get_accounts
      const accounts = await client.database.call('get_accounts', [[username]]);
      if (!accounts || !accounts[0]) {
        throw new Error('Account not found');
      }
      
      const account = accounts[0];
      
      // Method 2: Fetch reputation using techcoderx.com API (much more reliable!)
      let reputation = 25; // fallback
      try {
        console.log('Fetching reputation from techcoderx.com API for:', username);
        const reputationResponse = await fetch(`https://techcoderx.com/reputation-api/accounts/${username}/reputation`);
        if (reputationResponse.ok) {
          const reputationText = await reputationResponse.text();
          const reputationNumber = parseInt(reputationText.trim(), 10);
          if (!isNaN(reputationNumber)) {
            reputation = reputationNumber;
            console.log('Successfully fetched reputation from API:', reputation);
          } else {
            console.log('Invalid reputation response from API:', reputationText);
          }
        } else {
          console.log('Failed to fetch reputation from API, status:', reputationResponse.status);
        }
      } catch (reputationError) {
        console.log('Error fetching reputation from API:', reputationError);
      }
      
      // 🔍 DEBUG: Log the raw account data
      console.log(`\n=== PROFILE DEBUG for @${username} ===`);
      console.log('Raw account object keys:', Object.keys(account));
      console.log('FULL ACCOUNT OBJECT:', JSON.stringify(account, null, 2));
      console.log('Raw reputation:', account.reputation);
      console.log('Raw reputation type:', typeof account.reputation);
      
      // Try alternative reputation field names
      console.log('account.rep:', account.rep);
      console.log('account.reputation_score:', account.reputation_score);
      console.log('account.user_reputation:', account.user_reputation);
      
      console.log('Raw balance:', account.balance);
      console.log('Raw HBD balance:', account.hbd_balance);
      console.log('Raw vesting_shares:', account.vesting_shares);
      console.log('Raw delegated_vesting_shares:', account.delegated_vesting_shares);
      console.log('Raw received_vesting_shares:', account.received_vesting_shares);
      console.log('Following count:', account.following_count);
      console.log('Follower count:', account.follower_count);
      
      // Fetch global dynamic properties for HP calculation
      const fetchedGlobalProps = await client.database.getDynamicGlobalProperties();
      setGlobalProps(fetchedGlobalProps);
      console.log('Global props total_vesting_fund_hive:', fetchedGlobalProps.total_vesting_fund_hive);
      console.log('Global props total_vesting_shares:', fetchedGlobalProps.total_vesting_shares);
      console.log('Global props type check - total_vesting_fund_hive:', typeof fetchedGlobalProps.total_vesting_fund_hive);
      console.log('Global props type check - total_vesting_shares:', typeof fetchedGlobalProps.total_vesting_shares);
      
      // Parse profile metadata
      let profileMeta: any = {};
      try {
        const metaString = account.posting_json_metadata || account.json_metadata;
        if (metaString) {
          profileMeta = JSON.parse(metaString).profile || {};
        }
      } catch (e) {
        console.log('Error parsing profile metadata:', e);
      }
      
      // Parse balances
      const hiveBalance = parseFloat(account.balance.replace(' HIVE', ''));
      const hbdBalance = parseFloat(account.hbd_balance.replace(' HBD', ''));
      
      console.log('Parsed HIVE balance:', hiveBalance);
      console.log('Parsed HBD balance:', hbdBalance);
      
      // More accurate Hive Power calculation
      const vestingShares = parseFloat(account.vesting_shares.replace(' VESTS', ''));
      const delegatedVests = parseFloat(account.delegated_vesting_shares.replace(' VESTS', ''));
      const receivedVests = parseFloat(account.received_vesting_shares.replace(' VESTS', ''));
      const effectiveVests = vestingShares - delegatedVests + receivedVests;
      
      console.log('Parsed vesting_shares:', vestingShares);
      console.log('Parsed delegated_vesting_shares:', delegatedVests);
      console.log('Parsed received_vesting_shares:', receivedVests);
      console.log('Calculated effective_vests:', effectiveVests);
      
      // Calculate Hive Power using Ecency's exact vestsToHp method
      const hivePower = vestsToHp(effectiveVests, fetchedGlobalProps.total_vesting_fund_hive, fetchedGlobalProps.total_vesting_shares);
      
      console.log('Calculated Hive Power using Ecency method:', hivePower);

      // Parse unclaimed rewards
      const unclaimedHive = parseFloat((account.reward_hive_balance || '0.000 HIVE').replace(' HIVE', ''));
      const unclaimedHbd = parseFloat((account.reward_hbd_balance || '0.000 HBD').replace(' HBD', ''));
      const unclaimedVests = parseFloat((account.reward_vesting_balance || '0.000000 VESTS').replace(' VESTS', ''));
      
      console.log('Unclaimed HIVE:', unclaimedHive);
      console.log('Unclaimed HBD:', unclaimedHbd);
      console.log('Unclaimed VESTS:', unclaimedVests);

      // Set profile with account object counts first (non-blocking)
      setProfile({
        username: account.name,
        avatarUrl: profileMeta.profile_image,
        reputation: reputation, // Direct from API - no need for rounding!
        hivePower: Math.round(hivePower * 100) / 100,
        hbd: Math.round(hbdBalance * 100) / 100,
        displayName: profileMeta.name,
        about: profileMeta.about,
        location: profileMeta.location,
        website: profileMeta.website,
        followingCount: account.following_count || 0,
        followersCount: account.follower_count || 0,
        unclaimedHive,
        unclaimedHbd,
        unclaimedVests,
      });

      console.log('Follow counts from account object:', { 
        following: account.following_count || 0, 
        followers: account.follower_count || 0 
      });
      
      console.log('=== FINAL CALCULATED VALUES ===');
      console.log('Final reputation:', reputation);
      console.log('Final Hive Power:', Math.round(hivePower * 100) / 100);
      console.log('Final HBD:', Math.round(hbdBalance * 100) / 100);
      console.log('===============================\n');

      // Check follow status after setting profile data (only for other users' profiles)
      if (currentUsername && username !== currentUsername) {
        await checkFollowStatus();
      }
      
    } catch (e) {
      console.error('Error fetching profile:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (username && currentUsername && username !== currentUsername) {
      fetchProfileData();
    } else if (username && username === currentUsername) {
      // For own profile, just fetch data without follow status
      fetchProfileData();
    }
  }, [username, currentUsername]);

  // Check if current user is following/muting the profile user
  const checkFollowStatus = async () => {
    if (!currentUsername || !username || currentUsername === username) return;
    
    try {
      // Check following status
      const following = await client.call('condenser_api', 'get_following', [currentUsername, username, 'blog', 1]);
      const isCurrentlyFollowing = Array.isArray(following) && 
        following.some((f: any) => f.following === username && f.what?.includes('blog'));
      setIsFollowing(isCurrentlyFollowing);

      // Check mute status
      const ignoring = await client.call('condenser_api', 'get_following', [currentUsername, username, 'ignore', 1]);
      const isCurrentlyMuting = Array.isArray(ignoring) && 
        ignoring.some((f: any) => f.following === username && f.what?.includes('ignore'));
      setIsMuted(isCurrentlyMuting);
      
    } catch (error) {
      console.log('Error checking follow/mute status:', error);
    }
  };

  // Fetch user's recent snaps from Hive blockchain
  const fetchUserSnaps = async () => {
    if (!username) return;
    
    setSnapsLoading(true);
    setSnapsError(null);
    
    try {
      console.log('Fetching recent snaps for user:', username);
      
      // Get latest posts by @peak.snaps (container account)
      const discussions = await client.database.call('get_discussions_by_blog', [{
        tag: 'peak.snaps',
        limit: 10
      }]);
      
      let userSnapsFound: UserSnap[] = [];
      
      // Search through all container posts for user's snaps
      for (const post of discussions) {
        try {
          const replies: UserSnap[] = await client.database.call('get_content_replies', [post.author, post.permlink]);
          
          // Filter replies to only those by the profile user
          const userReplies = replies.filter((reply) => reply.author === username);
          userSnapsFound = userSnapsFound.concat(userReplies);
        } catch (replyError) {
          console.log('Error fetching replies for post:', post.permlink, replyError);
        }
      }
      
      // Sort by created date descending (newest first)
      userSnapsFound.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      
      // Limit to 20 most recent snaps
      const limitedSnaps = userSnapsFound.slice(0, 20);
      
      setUserSnaps(limitedSnaps);
      setSnapsLoaded(true);
      console.log(`Found ${limitedSnaps.length} recent snaps for @${username}`);
      
    } catch (error) {
      console.error('Error fetching user snaps:', error);
      setSnapsError('Failed to load recent snaps');
    } finally {
      setSnapsLoading(false);
    }
  };

  // Handle upvote for profile snap bubbles
  const handleSnapUpvote = async (snap: UserSnap) => {
    if (!currentUsername) return;
    
    try {
      // Haptic feedback for user interaction
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Get posting key from secure storage
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) {
        throw new Error('No posting key found. Please log in again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Use 100% vote weight (10000)
      const weight = 10000;

      // Broadcast vote
      await client.broadcast.vote(
        {
          voter: currentUsername,
          author: snap.author,
          permlink: snap.permlink,
          weight,
        },
        postingKey
      );

      // Update the local snap data to reflect the vote
      setUserSnaps(prev => prev.map(s => 
        s.permlink === snap.permlink 
          ? { 
              ...s, 
              net_votes: (s.net_votes || 0) + 1,
              active_votes: [...(s.active_votes || []), { voter: currentUsername, percent: weight }]
            }
          : s
      ));

      // Success haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      console.log('Successfully upvoted snap:', snap.permlink);
    } catch (error) {
      // Error haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Error upvoting snap:', error);
      alert('Failed to upvote: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Handle reply to profile snap bubble
  const handleSnapReply = (snap: UserSnap) => {
    // Navigate to conversation screen for this snap
    router.push({ 
      pathname: '/ConversationScreen', 
      params: { 
        author: snap.author, 
        permlink: snap.permlink 
      } 
    });
  };

  // Handle snap bubble press (navigate to conversation)
  const handleSnapPress = (snap: UserSnap) => {
    router.push({ 
      pathname: '/ConversationScreen', 
      params: { 
        author: snap.author, 
        permlink: snap.permlink 
      } 
    });
  };

  // Extract text content from snap body (removing images and formatting)
  const extractSnapText = (body: string): string => {
    // Remove images
    let text = body.replace(/!\[.*?\]\(.*?\)/g, '');
    // Remove markdown links but keep the text
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    // Remove URLs
    text = text.replace(/https?:\/\/[^\s]+/g, '');
    // Remove extra whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // If no text remains, return a fallback
    if (!text) {
      return 'Snap contains media or links';
    }
    
    // Limit length
    return text.length > 120 ? text.substring(0, 120) + '...' : text;
  };

  // Check if current user has upvoted a snap
  const hasUserUpvoted = (snap: UserSnap): boolean => {
    if (!currentUsername || !snap.active_votes) return false;
    return snap.active_votes.some((vote: any) => vote.voter === currentUsername && vote.percent > 0);
  };

  // Action handlers
  const handleFollow = async () => {
    if (!currentUsername || !username || followLoading) return;
    
    setFollowLoading(true);
    try {
      // Get posting key from secure storage
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) {
        throw new Error('No posting key found. Please log in again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Create follow operation
      const followOp = [
        'follow',
        {
          follower: currentUsername,
          following: username,
          what: ['blog'] // Follow their blog posts
        }
      ];

      // Broadcast the follow operation
      await client.broadcast.json(
        {
          required_auths: [],
          required_posting_auths: [currentUsername],
          id: 'follow',
          json: JSON.stringify(followOp)
        },
        postingKey
      );

      setIsFollowing(true);
      console.log('Successfully followed:', username);
    } catch (error) {
      console.log('Error following user:', error);
      alert('Failed to follow user: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!currentUsername || !username || followLoading) return;
    
    setFollowLoading(true);
    try {
      // Get posting key from secure storage
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) {
        throw new Error('No posting key found. Please log in again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Create unfollow operation
      const unfollowOp = [
        'follow',
        {
          follower: currentUsername,
          following: username,
          what: [] // Empty array means unfollow
        }
      ];

      // Broadcast the unfollow operation
      await client.broadcast.json(
        {
          required_auths: [],
          required_posting_auths: [currentUsername],
          id: 'follow',
          json: JSON.stringify(unfollowOp)
        },
        postingKey
      );

      setIsFollowing(false);
      console.log('Successfully unfollowed:', username);
    } catch (error) {
      console.log('Error unfollowing user:', error);
      alert('Failed to unfollow user: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMute = async () => {
    if (!currentUsername || !username || muteLoading) return;
    
    setMuteLoading(true);
    try {
      // Get posting key from secure storage
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) {
        throw new Error('No posting key found. Please log in again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Create mute operation
      const muteOp = [
        'follow',
        {
          follower: currentUsername,
          following: username,
          what: ['ignore'] // Mute/ignore user
        }
      ];

      // Broadcast the mute operation
      await client.broadcast.json(
        {
          required_auths: [],
          required_posting_auths: [currentUsername],
          id: 'follow',
          json: JSON.stringify(muteOp)
        },
        postingKey
      );

      setIsMuted(true);
      console.log('Successfully muted:', username);
    } catch (error) {
      console.log('Error muting user:', error);
      alert('Failed to mute user: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setMuteLoading(false);
    }
  };

  const handleUnmute = async () => {
    if (!currentUsername || !username || muteLoading) return;
    
    setMuteLoading(true);
    try {
      // Get posting key from secure storage
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) {
        throw new Error('No posting key found. Please log in again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Create unmute operation (same as unfollow - empty array)
      const unmuteOp = [
        'follow',
        {
          follower: currentUsername,
          following: username,
          what: [] // Empty array removes all follow relationships including mute
        }
      ];

      // Broadcast the unmute operation
      await client.broadcast.json(
        {
          required_auths: [],
          required_posting_auths: [currentUsername],
          id: 'follow',
          json: JSON.stringify(unmuteOp)
        },
        postingKey
      );

      setIsMuted(false);
      console.log('Successfully unmuted:', username);
    } catch (error) {
      console.log('Error unmuting user:', error);
      alert('Failed to unmute user: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setMuteLoading(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!profile || !currentUsername || !isOwnProfile) return;
    
    const { unclaimedHive = 0, unclaimedHbd = 0, unclaimedVests = 0 } = profile;
    
    // Check if there are any rewards to claim
    if (unclaimedHive === 0 && unclaimedHbd === 0 && unclaimedVests === 0) {
      return;
    }
    
    setClaimLoading(true);
    
    try {
      // Get posting key from secure storage
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) {
        throw new Error('No posting key found. Please log in again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      // Format reward balances for the claim operation
      const rewardHiveBalance = `${unclaimedHive.toFixed(3)} HIVE`;
      const rewardHbdBalance = `${unclaimedHbd.toFixed(3)} HBD`;
      const rewardVestingBalance = `${unclaimedVests.toFixed(6)} VESTS`;

      console.log('Claiming rewards:', {
        rewardHiveBalance,
        rewardHbdBalance, 
        rewardVestingBalance
      });

      // Broadcast the claim_reward_balance operation
      await client.broadcast.sendOperations([
        ['claim_reward_balance', {
          account: currentUsername,
          reward_hive: rewardHiveBalance,
          reward_hbd: rewardHbdBalance,
          reward_vests: rewardVestingBalance,
        }]
      ], postingKey);

      console.log('Rewards claimed successfully!');
      
      // Refresh profile data to show updated balances and clear unclaimed rewards
      setTimeout(() => {
        fetchProfileData();
      }, 3000); // Wait 3 seconds for blockchain confirmation
      
    } catch (error) {
      console.error('Error claiming rewards:', error);
      alert('Failed to claim rewards: ' + (error instanceof Error ? error.message : JSON.stringify(error)));
    } finally {
      setClaimLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await SecureStore.deleteItemAsync('hive_username');
      await SecureStore.deleteItemAsync('hive_posting_key');
      // Navigate back to login screen
      router.replace('/');
    } catch (err) {
      alert('Logout failed: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (!username) {
    return (
      <SafeAreaViewSA style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Error: No username provided
          </Text>
        </View>
      </SafeAreaViewSA>
    );
  }

  // Avatar update functions
  const handleEditAvatarPress = () => {
    setNewAvatarImage(null);
    setAvatarUpdateSuccess(false);
    setActiveKeyInput(''); // Clear active key input
    setEditAvatarModalVisible(true);
  };

  const handleSelectNewAvatar = async () => {
    try {
      // Ask user: Take Photo or Choose from Gallery
      const options = [
        { text: 'Take Photo', value: 'camera' },
        { text: 'Choose from Gallery', value: 'gallery' },
        { text: 'Cancel', value: 'cancel', style: 'cancel' },
      ];
      let pickType: 'camera' | 'gallery' | 'cancel' = 'cancel';
      
      if (Platform.OS === 'ios') {
        const { ActionSheetIOS } = await import('react-native');
        await new Promise<void>(resolve => {
          ActionSheetIOS.showActionSheetWithOptions(
            {
              options: options.map(o => o.text),
              cancelButtonIndex: 2,
            },
            async (buttonIndex) => {
              if (buttonIndex === 0) pickType = 'camera';
              else if (buttonIndex === 1) pickType = 'gallery';
              resolve();
            }
          );
        });
      } else {
        pickType = await new Promise<'camera' | 'gallery' | 'cancel'>(resolve => {
          import('react-native').then(({ Alert }) => {
            Alert.alert(
              'Select Avatar Image',
              'Choose an option',
              [
                { text: 'Take Photo', onPress: () => resolve('camera') },
                { text: 'Choose from Gallery', onPress: () => resolve('gallery') },
                { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
              ],
              { cancelable: true }
            );
          });
        });
      }
      
      if (pickType === 'cancel') return;
      
      // Pick image
      let result;
      if (pickType === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          alert('Permission to access camera is required!');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.8,
          aspect: [1, 1], // Square aspect ratio for avatar
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          alert('Permission to access media library is required!');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          aspect: [1, 1], // Square aspect ratio for avatar
        });
      }
      
      if (!result || result.canceled || !result.assets || !result.assets[0]) return;
      
      const asset = result.assets[0];
      setAvatarUploading(true);
      
      try {
        const fileToUpload = {
          uri: asset.uri,
          name: `avatar-${currentUsername}-${Date.now()}.jpg`,
          type: 'image/jpeg',
        };
        const cloudinaryUrl = await uploadImageToCloudinaryFixed(fileToUpload);
        setNewAvatarImage(cloudinaryUrl);
      } catch (err) {
        alert('Image upload failed: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
      }
      
      setAvatarUploading(false);
    } catch (err) {
      setAvatarUploading(false);
      alert('Failed to pick image: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
    }
  };

  const handleNextStep = () => {
    // Move to active key input modal
    setEditAvatarModalVisible(false);
    setActiveKeyModalVisible(true);
  };

  const handleUpdateAvatar = async () => {
    if (!newAvatarImage || !currentUsername || !activeKeyInput.trim()) return;
    
    setAvatarUpdateLoading(true);
    setAvatarUpdateSuccess(false);
    
    try {
      // Validate and create active key
      let activeKey;
      try {
        const keyStr = activeKeyInput.trim();
        // Basic validation: should start with 5 and be roughly the right length
        if (!keyStr.startsWith('5') || keyStr.length < 50) {
          throw new Error('Invalid key format');
        }
        activeKey = PrivateKey.fromString(keyStr);
      } catch (err) {
        throw new Error('Invalid active key format. Please check your key and try again.');
      }
      
      // Get current account data to preserve existing metadata
      const accounts = await client.database.getAccounts([currentUsername]);
      if (!accounts || !accounts[0]) throw new Error('Account not found');
      
      const account = accounts[0];
      
      // Parse existing metadata and preserve it
      let postingMeta = {};
      let jsonMeta = {};
      
      // Parse posting_json_metadata
      if (account.posting_json_metadata) {
        try {
          postingMeta = JSON.parse(account.posting_json_metadata);
        } catch (err) {
          console.log('Error parsing existing posting_json_metadata:', err);
        }
      }
      
      // Parse json_metadata  
      if (account.json_metadata) {
        try {
          jsonMeta = JSON.parse(account.json_metadata);
        } catch (err) {
          console.log('Error parsing existing json_metadata:', err);
        }
      }
      
      // Update profile image in both metadata objects
      const updatedPostingMeta = {
        ...postingMeta,
        profile: {
          ...(postingMeta as any)?.profile,
          profile_image: newAvatarImage,
        },
      };
      
      const updatedJsonMeta = {
        ...jsonMeta,
        profile: {
          ...(jsonMeta as any)?.profile,
          profile_image: newAvatarImage,
        },
      };
      
      // Broadcast account update2 - required for posting_json_metadata support
      const operation = [
        'account_update2',
        {
          account: currentUsername,
          memo_key: account.memo_key,
          json_metadata: JSON.stringify(updatedJsonMeta),
          posting_json_metadata: JSON.stringify(updatedPostingMeta),
          extensions: [], // Required field for account_update2
        }
      ] as const;
      
      await client.broadcast.sendOperations([operation], activeKey);
      
      setAvatarUpdateLoading(false);
      setAvatarUpdateSuccess(true);
      
      // Clear sensitive data immediately
      setActiveKeyInput('');
      
      // Invalidate avatar cache for this user across all feeds
      invalidateAvatarCache(currentUsername);
      
      // Clear any cached avatar data and refresh profile
      setTimeout(async () => {
        setActiveKeyModalVisible(false);
        setEditAvatarModalVisible(false);
        setNewAvatarImage(null);
        setAvatarUpdateSuccess(false);
        
        // Refresh profile data to show new avatar
        await fetchProfileData();
      }, 2000);
      
    } catch (err) {
      setAvatarUpdateLoading(false);
      setAvatarUpdateSuccess(false);
      // Clear sensitive data on error too
      setActiveKeyInput('');
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      alert('Failed to update profile image: ' + errorMsg);
    }
  };

  const isOwnProfile = currentUsername === username;

  return (
    <SafeAreaViewSA style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <FontAwesome name="hourglass-half" size={48} color={colors.icon} style={{ marginBottom: 12 }} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading profile...</Text>
        </View>
      ) : profile ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Info Section */}
          <View style={styles.profileSection}>
            {/* Username */}
            <Text style={[styles.username, { color: colors.text }]}>
              @{profile.username}
            </Text>
            
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              {profile.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.largeAvatar} />
              ) : (
                <View style={[styles.largeAvatar, styles.defaultAvatar, { backgroundColor: colors.bubble }]}>
                  <FontAwesome name="user" size={60} color={colors.icon} />
                </View>
              )}
            </View>

            {/* Edit Profile Image Button (Only for own profile) */}
            {isOwnProfile && (
              <TouchableOpacity 
                style={styles.editAvatarButton}
                onPress={handleEditAvatarPress}
              >
                <FontAwesome name="camera" size={16} color={colors.icon} />
                <Text style={[styles.editAvatarText, { color: colors.icon }]}>
                  Edit Profile Image
                </Text>
              </TouchableOpacity>
            )}

            {/* Display Name */}
            {profile.displayName && (
              <Text style={[styles.displayName, { color: colors.text }]}>
                {profile.displayName}
              </Text>
            )}

            {/* Follower/Following Counts */}
            <View style={styles.socialStats}>
              <View style={styles.socialStatItem}>
                <Text style={[styles.socialStatNumber, { color: colors.text }]}>
                  {(profile.followersCount || 0).toLocaleString()}
                </Text>
                <Text style={[styles.socialStatLabel, { color: colors.text }]}>
                  Followers
                </Text>
              </View>
              <View style={styles.socialStatItem}>
                <Text style={[styles.socialStatNumber, { color: colors.text }]}>
                  {(profile.followingCount || 0).toLocaleString()}
                </Text>
                <Text style={[styles.socialStatLabel, { color: colors.text }]}>
                  Following
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            {!isOwnProfile && (
              <View style={styles.actionButtons}>
                {isFollowing ? (
                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: colors.unfollowButton, opacity: followLoading ? 0.6 : 1 }]}
                    onPress={handleUnfollow}
                    disabled={followLoading}
                  >
                    {followLoading ? (
                      <FontAwesome name="hourglass-half" size={16} color="#fff" />
                    ) : (
                      <FontAwesome name="user-times" size={16} color="#fff" />
                    )}
                    <Text style={styles.buttonText}>
                      {followLoading ? 'Unfollowing...' : 'Unfollow'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: colors.followButton, opacity: followLoading ? 0.6 : 1 }]}
                    onPress={handleFollow}
                    disabled={followLoading}
                  >
                    {followLoading ? (
                      <FontAwesome name="hourglass-half" size={16} color="#fff" />
                    ) : (
                      <FontAwesome name="user-plus" size={16} color="#fff" />
                    )}
                    <Text style={styles.buttonText}>
                      {followLoading ? 'Following...' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}

                {isMuted ? (
                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: colors.buttonInactive, opacity: muteLoading ? 0.6 : 1 }]}
                    onPress={handleUnmute}
                    disabled={muteLoading}
                  >
                    {muteLoading ? (
                      <FontAwesome name="hourglass-half" size={16} color={colors.text} />
                    ) : (
                      <FontAwesome name="volume-up" size={16} color={colors.text} />
                    )}
                    <Text style={[styles.buttonText, { color: colors.text }]}>
                      {muteLoading ? 'Unmuting...' : 'Unmute'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: colors.mutedButton, opacity: muteLoading ? 0.6 : 1 }]}
                    onPress={handleMute}
                    disabled={muteLoading}
                  >
                    {muteLoading ? (
                      <FontAwesome name="hourglass-half" size={16} color="#fff" />
                    ) : (
                      <FontAwesome name="volume-off" size={16} color="#fff" />
                    )}
                    <Text style={styles.buttonText}>
                      {muteLoading ? 'Muting...' : 'Mute'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* About Section */}
            {profile.about && (
              <View style={styles.aboutSection}>
                <Text style={[styles.aboutText, { color: colors.text }]}>
                  {profile.about}
                </Text>
              </View>
            )}

            {/* Stats Section */}
            <View style={[styles.statsSection, { backgroundColor: colors.bubble }]}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.text }]}>Reputation</Text>
                <Text style={[styles.statValue, { color: colors.payout }]}>
                  {profile.reputation}
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.text }]}>Hive Power</Text>
                <Text style={[styles.statValue, { color: colors.payout }]}>
                  {profile.hivePower.toLocaleString()} HP
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.text }]}>HBD</Text>
                <Text style={[styles.statValue, { color: colors.payout }]}>
                  ${profile.hbd.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Unclaimed Rewards Section - Only show for own profile with unclaimed rewards */}
            {isOwnProfile && profile.unclaimedHive !== undefined && profile.unclaimedHbd !== undefined && profile.unclaimedVests !== undefined && 
             (profile.unclaimedHive > 0 || profile.unclaimedHbd > 0 || profile.unclaimedVests > 0) && (
              <View style={[styles.unclaimedSection, { backgroundColor: colors.bubble, borderColor: colors.border }]}>
                <Text style={[styles.unclaimedTitle, { color: colors.text }]}>
                  Unclaimed Rewards
                </Text>
                
                <View style={styles.unclaimedRewards}>
                  {profile.unclaimedVests > 0 && (
                    <Text style={[styles.unclaimedText, { color: colors.payout }]}>
                      {vestsToHp(profile.unclaimedVests, globalProps?.total_vesting_fund_hive, globalProps?.total_vesting_shares).toFixed(3)} HP
                    </Text>
                  )}
                  {profile.unclaimedHbd > 0 && (
                    <Text style={[styles.unclaimedText, { color: colors.payout }]}>
                      {profile.unclaimedHbd.toFixed(3)} HBD
                    </Text>
                  )}
                </View>
                
                <TouchableOpacity 
                  style={[styles.claimButton, { backgroundColor: colors.icon }]}
                  onPress={handleClaimRewards}
                  disabled={claimLoading}
                >
                  {claimLoading ? (
                    <FontAwesome name="hourglass-half" size={16} color="#fff" />
                  ) : (
                    <FontAwesome name="dollar" size={16} color="#fff" />
                  )}
                  <Text style={styles.claimButtonText}>
                    {claimLoading ? 'Claiming...' : 'CLAIM NOW'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Additional Info */}
            {(profile.location || profile.website) && (
              <View style={styles.additionalInfo}>
                {profile.location && (
                  <View style={styles.infoRow}>
                    <FontAwesome name="map-marker" size={16} color={colors.icon} />
                    <Text style={[styles.infoText, { color: colors.text }]}>
                      {profile.location}
                    </Text>
                  </View>
                )}
                
                {profile.website && (
                  <View style={styles.infoRow}>
                    <FontAwesome name="link" size={16} color={colors.icon} />
                    <Text style={[styles.infoText, { color: colors.icon }]}>
                      {profile.website}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Recent Snaps Section */}
            <View style={styles.snapsSection}>
              <Text style={[styles.snapsSectionTitle, { color: colors.text }]}>
                Recent Snaps
              </Text>
              
              {!snapsLoaded ? (
                <TouchableOpacity 
                  style={[styles.loadSnapsButton, { backgroundColor: colors.button }]}
                  onPress={fetchUserSnaps}
                  disabled={snapsLoading}
                  activeOpacity={0.8}
                >
                  {snapsLoading ? (
                    <>
                      <FontAwesome name="hourglass-half" size={16} color={colors.buttonText} />
                      <Text style={[styles.loadSnapsButtonText, { color: colors.buttonText }]}>
                        Loading...
                      </Text>
                    </>
                  ) : (
                    <>
                      <FontAwesome name="comment" size={16} color={colors.buttonText} />
                      <Text style={[styles.loadSnapsButtonText, { color: colors.buttonText }]}>
                        Show Recent Snaps
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.snapsSectionHeader}>
                    <TouchableOpacity 
                      style={styles.refreshButton}
                      onPress={fetchUserSnaps}
                      disabled={snapsLoading}
                    >
                      <FontAwesome name="refresh" size={16} color={colors.icon} />
                    </TouchableOpacity>
                  </View>
                  
                  {snapsError ? (
                    <View style={styles.snapsErrorContainer}>
                      <FontAwesome name="exclamation-triangle" size={24} color="#E74C3C" />
                      <Text style={[styles.snapsErrorText, { color: colors.text }]}>
                        {snapsError}
                      </Text>
                      <TouchableOpacity 
                        style={[styles.retryButton, { backgroundColor: colors.button }]}
                        onPress={fetchUserSnaps}
                        disabled={snapsLoading}
                      >
                        <Text style={[styles.retryButtonText, { color: colors.buttonText }]}>
                          Try Again
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : userSnaps.length === 0 ? (
                    <View style={styles.snapsEmptyContainer}>
                      <FontAwesome name="comment-o" size={32} color={colors.buttonInactive} />
                      <Text style={[styles.snapsEmptyText, { color: colors.text }]}>
                        No recent snaps found
                      </Text>
                    </View>
                  ) : (
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.snapsScrollContainer}
                      style={styles.snapsScrollView}
                    >
                      {userSnaps.map((snap, index) => {
                        const snapText = extractSnapText(snap.body);
                        const hasUpvoted = hasUserUpvoted(snap);
                        const voteCount = snap.net_votes || 0;
                        const replyCount = snap.children || 0;
                        
                        return (
                          <TouchableOpacity
                            key={`${snap.author}-${snap.permlink}`}
                            style={[styles.snapBubble, { backgroundColor: colors.bubble, borderColor: colors.border }]}
                            onPress={() => handleSnapPress(snap)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.snapBubbleContent}>
                              <Text style={[styles.snapBubbleText, { color: colors.text }]} numberOfLines={4}>
                                {snapText}
                              </Text>
                              
                              <View style={styles.snapBubbleActions}>
                                <TouchableOpacity
                                  style={styles.snapBubbleAction}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleSnapUpvote(snap);
                                  }}
                                  disabled={!currentUsername}
                                >
                                  <FontAwesome 
                                    name="heart" 
                                    size={14} 
                                    color={hasUpvoted ? '#E74C3C' : colors.buttonInactive} 
                                  />
                                  <Text style={[styles.snapBubbleActionText, { 
                                    color: hasUpvoted ? '#E74C3C' : colors.buttonInactive
                                  }]}>
                                    {voteCount}
                                  </Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity
                                  style={styles.snapBubbleAction}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleSnapReply(snap);
                                  }}
                                >
                                  <FontAwesome name="reply" size={14} color={colors.buttonInactive} />
                                  <Text style={[styles.snapBubbleActionText, { color: colors.buttonInactive }]}>
                                    {replyCount}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                              
                              <Text style={[styles.snapBubbleDate, { color: colors.buttonInactive }]}>
                                {new Date(snap.created).toLocaleDateString()}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </>
              )}
            </View>

            {/* Logout Button - Only show for own profile */}
            {isOwnProfile && (
              <View style={styles.logoutSection}>
                <TouchableOpacity 
                  style={[styles.logoutButton, { backgroundColor: '#E74C3C' }]}
                  onPress={handleLogout}
                >
                  <FontAwesome name="sign-out" size={18} color="#fff" />
                  <Text style={styles.logoutButtonText}>
                    Log Out
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Profile not found
          </Text>
        </View>
      )}
      
      {/* Edit Avatar Modal */}
      <Modal
        visible={editAvatarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditAvatarModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 24, width: '90%', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              Update Profile Image
            </Text>
            
            {/* Current vs New Avatar Preview */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
              {/* Current Avatar */}
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, marginBottom: 8 }}>Current</Text>
                {profile?.avatarUrl ? (
                  <Image source={{ uri: profile.avatarUrl }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                ) : (
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.bubble, justifyContent: 'center', alignItems: 'center' }}>
                    <FontAwesome name="user" size={40} color={colors.icon} />
                  </View>
                )}
              </View>
              
              {/* Arrow */}
              <FontAwesome name="arrow-right" size={20} color={colors.icon} style={{ marginHorizontal: 16 }} />
              
              {/* New Avatar */}
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, marginBottom: 8 }}>New</Text>
                {newAvatarImage ? (
                  <Image source={{ uri: newAvatarImage }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                ) : (
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.buttonInactive, justifyContent: 'center', alignItems: 'center' }}>
                    <FontAwesome name="camera" size={30} color={colors.icon} />
                  </View>
                )}
              </View>
            </View>
            
            {/* Select Image Button */}
            {!newAvatarImage && (
              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.buttonInactive, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 16 }}
                onPress={handleSelectNewAvatar}
                disabled={avatarUploading || avatarUpdateLoading}
              >
                <FontAwesome name="image" size={20} color={colors.icon} style={{ marginRight: 8 }} />
                <Text style={{ color: colors.text, fontWeight: '600' }}>
                  {avatarUploading ? 'Uploading...' : 'Select New Image'}
                </Text>
                {avatarUploading && (
                  <ActivityIndicator size="small" color={colors.icon} style={{ marginLeft: 8 }} />
                )}
              </Pressable>
            )}
            
            {/* Change Image Button (if image already selected) */}
            {newAvatarImage && !avatarUpdateLoading && !avatarUpdateSuccess && (
              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.buttonInactive, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 16 }}
                onPress={handleSelectNewAvatar}
                disabled={avatarUploading}
              >
                <FontAwesome name="refresh" size={16} color={colors.icon} style={{ marginRight: 6 }} />
                <Text style={{ color: colors.text, fontWeight: '500', fontSize: 14 }}>
                  Change Image
                </Text>
              </Pressable>
            )}
            
            {/* Action Buttons or Loading/Success States */}
            {avatarUpdateLoading ? (
              <View style={{ marginTop: 8, alignItems: 'center' }}>
                <FontAwesome name="hourglass-half" size={32} color={colors.icon} />
                <Text style={{ color: colors.text, marginTop: 8 }}>Updating profile...</Text>
              </View>
            ) : avatarUpdateSuccess ? (
              <View style={{ marginTop: 8, alignItems: 'center' }}>
                <FontAwesome name="check-circle" size={32} color={colors.button} />
                <Text style={{ color: colors.text, marginTop: 8 }}>Profile updated!</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Pressable
                  style={{ flex: 1, marginRight: 8, backgroundColor: colors.buttonInactive, borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={() => {
                    setEditAvatarModalVisible(false);
                    setNewAvatarImage(null);
                    setActiveKeyInput(''); // Clear active key on cancel
                  }}
                  disabled={avatarUpdateLoading || avatarUploading}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={{ 
                    flex: 1, 
                    marginLeft: 8, 
                    backgroundColor: newAvatarImage ? colors.button : colors.buttonInactive, 
                    borderRadius: 8, 
                    padding: 12, 
                    alignItems: 'center' 
                  }}
                  onPress={handleNextStep}
                  disabled={!newAvatarImage || avatarUpdateLoading || avatarUploading}
                >
                  <Text style={{ 
                    color: newAvatarImage ? colors.buttonText : colors.text, 
                    fontWeight: '600' 
                  }}>
                    Next
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
      
      {/* Active Key Input Modal (Second Step) */}
      <Modal
        visible={activeKeyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setActiveKeyModalVisible(false);
          setActiveKeyInput('');
        }}
      >
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>
                Confirm Avatar Update
              </Text>
              
              {/* Security Notice */}
              <View style={{ backgroundColor: colors.bubble, borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <FontAwesome name="shield" size={20} color={colors.icon} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Security Notice</Text>
                </View>
                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
                  To change your avatar, your active key is needed. This will be used to sign the transaction only. 
                  It will not be stored on this phone for security reasons.
                </Text>
              </View>
              
              {/* Active Key Input */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.text, fontSize: 15, marginBottom: 8 }}>
                  Enter your active key:
                </Text>
                <View style={{ 
                  borderWidth: 1, 
                  borderColor: colors.buttonInactive, 
                  borderRadius: 8, 
                  backgroundColor: colors.background,
                  paddingHorizontal: 12,
                  paddingVertical: 8
                }}>
                  <TextInput
                    style={{ 
                      color: colors.text, 
                      fontSize: 16, 
                      minHeight: 40,
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    }}
                    placeholder="5K... (your active private key)"
                    placeholderTextColor={colors.buttonInactive}
                    value={activeKeyInput}
                    onChangeText={setActiveKeyInput}
                    secureTextEntry={true}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!avatarUpdateLoading}
                    multiline={true}
                    textAlignVertical="top"
                  />
                </View>
              </View>
              
              {/* Preview of change */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                {/* Current Avatar */}
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 12, marginBottom: 4 }}>Current</Text>
                  {profile?.avatarUrl ? (
                    <Image source={{ uri: profile.avatarUrl }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                  ) : (
                    <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.bubble, justifyContent: 'center', alignItems: 'center' }}>
                      <FontAwesome name="user" size={25} color={colors.icon} />
                    </View>
                  )}
                </View>
                
                {/* Arrow */}
                <FontAwesome name="arrow-right" size={16} color={colors.icon} style={{ marginHorizontal: 12 }} />
                
                {/* New Avatar */}
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 12, marginBottom: 4 }}>New</Text>
                  {newAvatarImage && (
                    <Image source={{ uri: newAvatarImage }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                  )}
                </View>
              </View>
              
              {/* Action Buttons or Loading/Success States */}
              {avatarUpdateLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <FontAwesome name="hourglass-half" size={32} color={colors.icon} />
                  <Text style={{ color: colors.text, marginTop: 8 }}>Signing transaction...</Text>
                </View>
              ) : avatarUpdateSuccess ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <FontAwesome name="check-circle" size={32} color={colors.button} />
                  <Text style={{ color: colors.text, marginTop: 8 }}>Avatar updated successfully!</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row' }}>
                  <Pressable
                    style={{ 
                      flex: 1, 
                      marginRight: 8, 
                      backgroundColor: colors.buttonInactive, 
                      borderRadius: 8, 
                      padding: 12, 
                      alignItems: 'center' 
                    }}
                    onPress={() => {
                      setActiveKeyModalVisible(false);
                      setActiveKeyInput('');
                      setEditAvatarModalVisible(true); // Go back to first modal
                    }}
                    disabled={avatarUpdateLoading}
                  >
                    <Text style={{ color: colors.text, fontWeight: '600' }}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={{ 
                      flex: 1, 
                      marginLeft: 8, 
                      backgroundColor: activeKeyInput.trim() ? colors.button : colors.buttonInactive, 
                      borderRadius: 8, 
                      padding: 12, 
                      alignItems: 'center' 
                    }}
                    onPress={handleUpdateAvatar}
                    disabled={!activeKeyInput.trim() || avatarUpdateLoading}
                  >
                    <Text style={{ 
                      color: activeKeyInput.trim() ? colors.buttonText : colors.text, 
                      fontWeight: '600' 
                    }}>
                      Sign Transaction
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaViewSA>
  );
};

export default ProfileScreen;

export const options = { headerShown: false };

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36, // Same width as back button to center title
  },
  content: {
    flex: 1,
  },
  profileSection: {
    padding: 24,
    alignItems: 'center',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  largeAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  defaultAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  editAvatarText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  socialStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 20,
  },
  socialStatItem: {
    alignItems: 'center',
  },
  socialStatNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  socialStatLabel: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  aboutSection: {
    marginBottom: 20,
    width: '100%',
  },
  aboutText: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  statsSection: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  additionalInfo: {
    width: '100%',
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
  unclaimedSection: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  unclaimedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  unclaimedRewards: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  unclaimedText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  claimButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoutSection: {
    width: '100%',
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    width: '100%',
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Snaps section styles
  snapsSection: {
    width: '100%',
    marginTop: 20,
  },
  snapsSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  snapsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  refreshButton: {
    position: 'absolute',
    right: 0,
    padding: 8,
  },
  snapsLoadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  snapsLoadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  snapsErrorContainer: {
    alignItems: 'center',
    padding: 40,
  },
  snapsErrorText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  snapsEmptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  snapsEmptyText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  snapsScrollView: {
    marginHorizontal: -24, // Offset parent padding
  },
  snapsScrollContainer: {
    paddingHorizontal: 24,
    paddingRight: 24,
  },
  snapBubble: {
    width: 180,
    minHeight: 140,
    maxHeight: 200,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  snapBubbleContent: {
    padding: 16,
    flex: 1,
    justifyContent: 'space-between',
  },
  snapBubbleText: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 12,
    flex: 1,
  },
  snapBubbleActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  snapBubbleAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  snapBubbleActionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  snapBubbleDate: {
    fontSize: 11,
    textAlign: 'right',
  },
  // Load snaps button styles
  loadSnapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    marginBottom: 20,
  },
  loadSnapsButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
