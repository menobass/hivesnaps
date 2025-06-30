import React, { useState, useEffect } from 'react';
import { SafeAreaView as SafeAreaViewSA } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, Image, ScrollView } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Client } from '@hiveio/dhive';
import * as SecureStore from 'expo-secure-store';

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
}

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

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

  const colors = {
    background: isDark ? '#15202B' : '#fff',
    text: isDark ? '#D7DBDC' : '#0F1419',
    bubble: isDark ? '#22303C' : '#f7f9f9',
    border: isDark ? '#38444D' : '#eee',
    icon: '#1DA1F2',
    payout: '#17BF63',
    button: '#1DA1F2',
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

  // Fetch profile data
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
      
      // Method 2: Fetch reputation using dedicated reputation API
      let reputationValue = 0;
      try {
        const reputationResponse = await fetch('https://api.hive.blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'reputation_api.get_account_reputations',
            params: {
              account_lower_bound: username,
              limit: 1
            },
            id: 1,
          }),
        });
        const reputationData = await reputationResponse.json();
        if (reputationData.result && reputationData.result.reputations && reputationData.result.reputations[0]) {
          const reputationEntry = reputationData.result.reputations[0];
          if (reputationEntry.account === username) {
            reputationValue = parseInt(reputationEntry.reputation);
            console.log('Reputation API returned:', reputationEntry.reputation, 'for', username);
          }
        }
      } catch (e) {
        console.log('Reputation API failed:', e);
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
      const globalProps = await client.database.getDynamicGlobalProperties();
      console.log('Global props total_vesting_fund_hive:', globalProps.total_vesting_fund_hive);
      console.log('Global props total_vesting_shares:', globalProps.total_vesting_shares);
      console.log('Global props type check - total_vesting_fund_hive:', typeof globalProps.total_vesting_fund_hive);
      console.log('Global props type check - total_vesting_shares:', typeof globalProps.total_vesting_shares);
      
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

      // Calculate reputation using Ecency's exact method
      const parseReputation = (input: string | number): number => {
        const isHumanReadable = (input: number): boolean => {
          return Math.abs(input) > 0 && Math.abs(input) <= 100;
        };
        
        if (typeof input === 'number' && isHumanReadable(input)) {
          return Math.floor(input);
        }

        if (typeof input === 'string') {
          input = Number(input);
          if (isHumanReadable(input)) {
            return Math.floor(input);
          }
        }

        if (input === 0) {
          return 25;
        }

        let neg = false;
        if (input < 0) neg = true;

        let reputationLevel = Math.log10(Math.abs(input));
        reputationLevel = Math.max(reputationLevel - 9, 0);

        if (reputationLevel < 0) reputationLevel = 0;
        if (neg) reputationLevel *= -1;

        reputationLevel = reputationLevel * 9 + 25;

        return Math.floor(reputationLevel);
      };

      // Use the better reputation source (reputation API if available, otherwise dhive)
      const reputationSource = reputationValue !== 0 ? reputationValue : account.reputation;
      console.log('Using reputation from:', reputationValue !== 0 ? 'reputation API' : 'dhive API');
      console.log('Reputation source value:', reputationSource);
      
      const reputation = parseReputation(reputationSource);
      console.log('Calculated reputation using Ecency method:', reputation);
      
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
        
        console.log('vestsToHp calculation:');
        console.log('  vests:', vests);
        console.log('  totalVestingFundHive:', totalVestingFundHiveNum);
        console.log('  totalVestingShares:', totalVestingSharesNum);
        
        if (totalVestingSharesNum === 0) {
          return 0;
        }
        
        const hivePerVests = totalVestingFundHiveNum / totalVestingSharesNum;
        const hp = vests * hivePerVests;
        
        console.log('  hivePerVests:', hivePerVests);
        console.log('  calculated HP:', hp);
        
        return hp;
      };
      
      const hivePower = vestsToHp(effectiveVests, globalProps.total_vesting_fund_hive, globalProps.total_vesting_shares);
      
      console.log('Calculated Hive Power using Ecency method:', hivePower);

      setProfile({
        username: account.name,
        avatarUrl: profileMeta.profile_image,
        reputation: Math.round(reputation * 10) / 10,
        hivePower: Math.round(hivePower * 100) / 100,
        hbd: Math.round(hbdBalance * 100) / 100,
        displayName: profileMeta.name,
        about: profileMeta.about,
        location: profileMeta.location,
        website: profileMeta.website,
        followingCount: account.following_count,
        followersCount: account.follower_count,
      });
      
      console.log('=== FINAL CALCULATED VALUES ===');
      console.log('Final reputation:', Math.round(reputation * 10) / 10);
      console.log('Final Hive Power:', Math.round(hivePower * 100) / 100);
      console.log('Final HBD:', Math.round(hbdBalance * 100) / 100);
      console.log('===============================\n');

      // TODO: Check if current user is following this profile
      // TODO: Check if current user has muted this profile
      
    } catch (e) {
      console.error('Error fetching profile:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (username && currentUsername) {
      fetchProfileData();
    }
  }, [username, currentUsername]);

  // Action handlers
  const handleFollow = async () => {
    // TODO: Implement follow functionality
    console.log('Follow user:', username);
    setIsFollowing(true);
  };

  const handleUnfollow = async () => {
    // TODO: Implement unfollow functionality
    console.log('Unfollow user:', username);
    setIsFollowing(false);
  };

  const handleMute = async () => {
    // TODO: Implement mute functionality
    console.log('Mute user:', username);
    setIsMuted(true);
  };

  const handleUnmute = async () => {
    // TODO: Implement unmute functionality
    console.log('Unmute user:', username);
    setIsMuted(false);
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

            {/* Display Name */}
            {profile.displayName && (
              <Text style={[styles.displayName, { color: colors.text }]}>
                {profile.displayName}
              </Text>
            )}

            {/* Action Buttons */}
            {!isOwnProfile && (
              <View style={styles.actionButtons}>
                {isFollowing ? (
                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: colors.unfollowButton }]}
                    onPress={handleUnfollow}
                  >
                    <FontAwesome name="user-times" size={16} color="#fff" />
                    <Text style={styles.buttonText}>Unfollow</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: colors.followButton }]}
                    onPress={handleFollow}
                  >
                    <FontAwesome name="user-plus" size={16} color="#fff" />
                    <Text style={styles.buttonText}>Follow</Text>
                  </TouchableOpacity>
                )}

                {isMuted ? (
                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: colors.buttonInactive }]}
                    onPress={handleUnmute}
                  >
                    <FontAwesome name="volume-up" size={16} color={colors.text} />
                    <Text style={[styles.buttonText, { color: colors.text }]}>Unmute</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: colors.mutedButton }]}
                    onPress={handleMute}
                  >
                    <FontAwesome name="volume-off" size={16} color="#fff" />
                    <Text style={styles.buttonText}>Mute</Text>
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
          </View>
        </ScrollView>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Profile not found
          </Text>
        </View>
      )}
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
  displayName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
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
});
