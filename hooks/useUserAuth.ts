import { useState, useEffect, useCallback } from 'react';
import { Client } from '@hiveio/dhive';
import * as SecureStore from 'expo-secure-store';
import { useVotingPower } from './useVotingPower';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export interface UserProfile {
  username: string;
  avatarUrl: string;
  hasUnclaimedRewards: boolean;
  votingPower: number | null;
  vpLoading: boolean;
  vpError: string | null;
}

interface UseUserAuthReturn extends UserProfile {
  loading: boolean;
  error: string | null;
  fetchUser: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useUserAuth = (): UseUserAuthReturn => {
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [hasUnclaimedRewards, setHasUnclaimedRewards] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the existing voting power hook
  const { votingPower, loading: vpLoading, error: vpError } = useVotingPower(username);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const storedUsername = await SecureStore.getItemAsync('hive_username');
      console.log('Stored username:', storedUsername);
      
      if (!storedUsername) {
        setUsername('');
        setAvatarUrl('');
        setHasUnclaimedRewards(false);
        setLoading(false);
        return;
      }

      setUsername(storedUsername);
      
      const accounts = await client.database.getAccounts([storedUsername]);
      console.log('Hive account object:', accounts && accounts[0]);
      
      if (accounts && accounts[0]) {
        let profileImg = '';
        let meta = null;
        
        // Try posting_json_metadata first (most up-to-date)
        if (accounts[0].posting_json_metadata) {
          try {
            meta = JSON.parse(accounts[0].posting_json_metadata);
            console.log('posting_json_metadata:', accounts[0].posting_json_metadata);
          } catch (err) {
            console.log('Error parsing posting_json_metadata:', err);
          }
        }
        
        // If no profile image in posting_json_metadata, fallback to json_metadata
        if (!meta || !meta.profile || !meta.profile.profile_image) {
          if (accounts[0].json_metadata) {
            try {
              const jsonMeta = JSON.parse(accounts[0].json_metadata);
              meta = jsonMeta;
              console.log('json_metadata (fallback):', accounts[0].json_metadata);
            } catch (err) {
              console.log('Error parsing json_metadata:', err);
            }
          }
        }
        
        if (meta && meta.profile && meta.profile.profile_image) {
          profileImg = meta.profile.profile_image;
          // Sanitize avatar URL to remove trailing slashes or backslashes
          profileImg = profileImg.replace(/[\\/]+$/, '');
          console.log('Parsed profile_image:', profileImg);
        } else {
          console.log('No profile_image found in metadata.');
        }
        
        setAvatarUrl(profileImg);
        console.log('Avatar URL set to:', profileImg);

        // Check for unclaimed rewards
        const parseRewardBalance = (balance: any, symbol: string) => {
          if (!balance) return 0;
          if (typeof balance === 'object' && balance.amount !== undefined) {
            // Asset object format
            return parseFloat(balance.amount) || 0;
          } else if (typeof balance === 'string') {
            // String format like "0.000 HIVE"
            return parseFloat(balance.replace(` ${symbol}`, '')) || 0;
          } else {
            // Try converting to string and parsing
            return parseFloat(balance.toString().replace(` ${symbol}`, '')) || 0;
          }
        };

        const unclaimedHive = parseRewardBalance(accounts[0].reward_hive_balance, 'HIVE');
        const unclaimedHbd = parseRewardBalance(accounts[0].reward_hbd_balance, 'HBD');
        const unclaimedVests = parseRewardBalance(accounts[0].reward_vesting_balance, 'VESTS');

        const hasRewards = unclaimedHive > 0 || unclaimedHbd > 0 || unclaimedVests > 0;
        setHasUnclaimedRewards(hasRewards);
      }
    } catch (err) {
      setAvatarUrl('');
      setHasUnclaimedRewards(false);
      console.log('Error fetching Hive user:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user data');
    }
    
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      // Clear stored credentials
      await SecureStore.deleteItemAsync('hive_username');
      await SecureStore.deleteItemAsync('hive_posting_key');
      
      // Reset state
      setUsername('');
      setAvatarUrl('');
      setHasUnclaimedRewards(false);
      setError(null);
    } catch (err) {
      console.error('Logout failed:', err);
      setError(err instanceof Error ? err.message : 'Logout failed');
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch user data on mount
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    username,
    avatarUrl,
    hasUnclaimedRewards,
    votingPower,
    vpLoading,
    vpError,
    loading,
    error,
    fetchUser,
    logout,
    clearError,
  };
}; 