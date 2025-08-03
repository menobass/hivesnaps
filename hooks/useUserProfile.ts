import { useState, useEffect, useCallback } from 'react';
import { Client } from '@hiveio/dhive';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export const useUserProfile = (username: string | null) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hasUnclaimedRewards, setHasUnclaimedRewards] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async () => {
    if (!username) {
      setAvatarUrl(null);
      setHasUnclaimedRewards(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const accounts = await client.database.getAccounts([username]);
      if (accounts && accounts.length > 0) {
        const account = accounts[0];

        // Extract avatar URL from metadata
        let meta = null;
        if (account.posting_json_metadata) {
          try {
            meta = JSON.parse(account.posting_json_metadata);
          } catch {}
        }
        if (
          (!meta || !meta.profile || !meta.profile.profile_image) &&
          account.json_metadata
        ) {
          try {
            meta = JSON.parse(account.json_metadata);
          } catch {}
        }

        const avatar =
          meta && meta.profile && meta.profile.profile_image
            ? meta.profile.profile_image.replace(/[\\/]+$/, '')
            : null;

        setAvatarUrl(avatar);

        // Check for unclaimed rewards
        const unclaimedHbd = parseFloat(
          String(account.reward_hbd_balance || '0')
        );
        const unclaimedHive = parseFloat(
          String(account.reward_vesting_balance || '0')
        );
        const unclaimedVests = parseFloat(
          String(account.reward_vesting_hive || '0')
        );

        const hasRewards =
          unclaimedHbd > 0 || unclaimedHive > 0 || unclaimedVests > 0;
        setHasUnclaimedRewards(hasRewards);
      } else {
        setAvatarUrl(null);
        setHasUnclaimedRewards(false);
        setError('Account not found');
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError('Failed to fetch user profile');
      setAvatarUrl(null);
      setHasUnclaimedRewards(false);
    } finally {
      setLoading(false);
    }
  }, [username]);

  // Fetch profile on mount and when username changes
  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  // Refresh profile data
  const refreshProfile = useCallback(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  return {
    avatarUrl,
    hasUnclaimedRewards,
    loading,
    error,
    fetchUserProfile,
    refreshProfile,
  };
};
