import { useState } from 'react';
import { Client, PrivateKey } from '@hiveio/dhive';
import * as SecureStore from 'expo-secure-store';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export const useRewardsManagement = (
  currentUsername: string | null,
  profile: any,
  isOwnProfile: boolean
) => {
  const [claimLoading, setClaimLoading] = useState(false);

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
        rewardVestingBalance,
      });

      // Broadcast the claim_reward_balance operation
      await client.broadcast.sendOperations(
        [
          [
            'claim_reward_balance',
            {
              account: currentUsername,
              reward_hive: rewardHiveBalance,
              reward_hbd: rewardHbdBalance,
              reward_vests: rewardVestingBalance,
            },
          ],
        ],
        postingKey
      );

      console.log('Rewards claimed successfully!');
    } catch (error) {
      console.error('Error claiming rewards:', error);
      throw error;
    } finally {
      setClaimLoading(false);
    }
  };

  return {
    claimLoading,
    handleClaimRewards,
  };
};
