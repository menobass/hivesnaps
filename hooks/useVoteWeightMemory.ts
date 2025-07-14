import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const VOTE_WEIGHT_KEY = 'hivesnaps_vote_weight';

export function useVoteWeightMemory(defaultValue = 100) {
  const [voteWeight, setVoteWeightState] = useState<number>(defaultValue);
  const [loading, setLoading] = useState(true);

  // Load from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(VOTE_WEIGHT_KEY)
      .then((val: string | null) => {
        if (val !== null) {
          setVoteWeightState(Number(val));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Only update local state, do not persist to AsyncStorage on every change
  const setVoteWeight = useCallback((val: number) => {
    setVoteWeightState(val);
  }, []);

  // Call this to persist the current voteWeight to AsyncStorage (e.g., after vote is cast)
  const persistVoteWeight = useCallback(() => {
    AsyncStorage.setItem(VOTE_WEIGHT_KEY, String(voteWeight));
  }, [voteWeight]);

  return { voteWeight, setVoteWeight, persistVoteWeight, loading };
}
