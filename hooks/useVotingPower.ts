import { useState, useEffect, useCallback } from 'react';
import { Client } from '@hiveio/dhive';
import { calculateVotingPower } from '../utils/calculateVotingPower';
import { useCurrentUser } from '../store/context';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export const useVotingPower = () => {
  const username = useCurrentUser(); // Get current user from global state
  const [votingPower, setVotingPower] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVotingPower = useCallback(async () => {
    // Only fetch if we have a logged-in user
    if (!username) {
      setVotingPower(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [account] = await client.database.getAccounts([username]);
      if (!account) {
        console.log('Account not found:', username);
        setLoading(false);
        return;
      }

      // Use the accurate voting power calculation with regeneration
      const vp = calculateVotingPower(account);
      setVotingPower(vp);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching voting power:', error);
      setLoading(false);
    }
  }, [username]);

  // Fetch voting power on mount and when username changes
  useEffect(() => {
    fetchVotingPower();
  }, [fetchVotingPower]);

  // Update voting power optimistically after upvoting
  const updateVotingPowerOptimistically = useCallback(
    (decreaseBy: number = 200) => {
      if (votingPower !== null) {
        const newVp = Math.max(0, votingPower - decreaseBy);
        setVotingPower(newVp);
      }
    },
    [votingPower]
  );

  // Refresh voting power (useful after upvoting)
  const refreshVotingPower = useCallback(() => {
    fetchVotingPower();
  }, [fetchVotingPower]);

  return {
    votingPower,
    loading,
    error,
    fetchVotingPower,
    updateVotingPowerOptimistically,
    refreshVotingPower,
  };
};
