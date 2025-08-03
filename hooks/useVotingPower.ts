import { useState, useEffect, useCallback } from 'react';
import { Client } from '@hiveio/dhive';
import * as SecureStore from 'expo-secure-store';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export const useVotingPower = (username: string | null) => {
  const [votingPower, setVotingPower] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVotingPower = useCallback(async () => {
    if (!username) {
      setVotingPower(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const accounts = await client.database.getAccounts([username]);
      if (accounts && accounts.length > 0) {
        const account = accounts[0];
        // Voting power is stored as a percentage (0-10000, where 10000 = 100%)
        const vp = account.voting_power || 0;
        setVotingPower(vp);
      } else {
        setVotingPower(null);
        setError('Account not found');
      }
    } catch (err) {
      console.error('Error fetching voting power:', err);
      setError('Failed to fetch voting power');
      setVotingPower(null);
    } finally {
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
