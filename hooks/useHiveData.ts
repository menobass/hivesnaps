import { useState, useEffect, useCallback } from 'react';
import { Client } from '@hiveio/dhive';
import { getHivePriceUSD } from '../utils/getHivePrice';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

interface HiveDataState {
  hivePrice: number;
  globalProps: any | null;
  rewardFund: any | null;
  loading: boolean;
  error: string | null;
}

interface UseHiveDataReturn extends HiveDataState {
  refreshHivePrice: () => Promise<void>;
  refreshGlobalProps: () => Promise<void>;
  refreshRewardFund: () => Promise<void>;
  refreshAll: () => Promise<void>;
  clearError: () => void;
}

export const useHiveData = (): UseHiveDataReturn => {
  const [state, setState] = useState<HiveDataState>({
    hivePrice: 1,
    globalProps: null,
    rewardFund: null,
    loading: false,
    error: null,
  });

  const fetchHivePrice = useCallback(async () => {
    try {
      const price = await getHivePriceUSD();
      if (price > 0) {
        setState(prev => ({ ...prev, hivePrice: price }));
      }
    } catch (err) {
      console.log('[HivePriceDebug] Error fetching HIVE price:', err);
      setState(prev => ({ ...prev, hivePrice: 1 }));
    }
  }, []);

  const fetchGlobalProps = useCallback(async () => {
    try {
      const props = await client.database.getDynamicGlobalProperties();
      setState(prev => ({ ...prev, globalProps: props }));
    } catch (err) {
      console.log('Error fetching Hive globalProps:', err);
      setState(prev => ({ ...prev, globalProps: null }));
    }
  }, []);

  const fetchRewardFund = useCallback(async () => {
    try {
      const fund = await client.database.call('get_reward_fund', ['post']);
      setState(prev => ({ ...prev, rewardFund: fund }));
    } catch (err) {
      console.log('Error fetching Hive rewardFund:', err);
      setState(prev => ({ ...prev, rewardFund: null }));
    }
  }, []);

  const refreshHivePrice = useCallback(async () => {
    await fetchHivePrice();
  }, [fetchHivePrice]);

  const refreshGlobalProps = useCallback(async () => {
    await fetchGlobalProps();
  }, [fetchGlobalProps]);

  const refreshRewardFund = useCallback(async () => {
    await fetchRewardFund();
  }, [fetchRewardFund]);

  const refreshAll = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await Promise.all([
        fetchHivePrice(),
        fetchGlobalProps(),
        fetchRewardFund(),
      ]);
    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        error: err instanceof Error ? err.message : 'Failed to fetch Hive data' 
      }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [fetchHivePrice, fetchGlobalProps, fetchRewardFund]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Fetch data on mount
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return {
    ...state,
    refreshHivePrice,
    refreshGlobalProps,
    refreshRewardFund,
    refreshAll,
    clearError,
  };
}; 