import { useEffect, useState } from 'react';
import { Client } from '@hiveio/dhive';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

/**
 * Custom React hook to fetch and calculate Hive voting power for a user.
 * @param username Hive account name
 * @returns { votingPower, loading, error }
 */
export function useVotingPower(username: string | null) {
  const [votingPower, setVotingPower] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) {
      setVotingPower(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    client.database.getAccounts([username])
      .then(accounts => {
        if (!accounts || !accounts[0]) {
          setVotingPower(null);
          setError('Account not found');
          setLoading(false);
          return;
        }
        const account = accounts[0];
        // Hive voting power calculation
        const VOTING_MANA_REGEN_SECONDS = 5 * 24 * 60 * 60; // 5 days
        const MAX_VOTING_POWER = 10000;
        const lastVoteTime = new Date(account.last_vote_time + 'Z').getTime();
        const now = Date.now();
        const elapsedSeconds = (now - lastVoteTime) / 1000;
        let vp = account.voting_power;
        vp += (MAX_VOTING_POWER * elapsedSeconds) / VOTING_MANA_REGEN_SECONDS;
        if (vp > MAX_VOTING_POWER) vp = MAX_VOTING_POWER;
        setVotingPower(Math.floor(vp));
        setLoading(false);
      })
      .catch(err => {
        setVotingPower(null);
        setError(err?.message || 'Error fetching voting power');
        setLoading(false);
      });
  }, [username]);

  return { votingPower, loading, error };
}
