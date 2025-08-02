import { useState, useEffect } from 'react';
import { Client } from '@hiveio/dhive';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export const useHiveData = () => {
  const [hivePrice, setHivePrice] = useState(1);
  const [globalProps, setGlobalProps] = useState<any>(null);
  const [rewardFund, setRewardFund] = useState<any>(null);

  // Initialize reward fund and hive price
  useEffect(() => {
    const initializeUpvoteData = async () => {
      try {
        // Fetch reward fund
        const fund = await client.database.call('get_reward_fund', ['post']);
        setRewardFund(fund);
        
        // Fetch global props
        const props = await client.database.getDynamicGlobalProperties();
        setGlobalProps(props);
        
        // Fetch hive price
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=hive&vs_currencies=usd');
        const data = await response.json();
        setHivePrice(data.hive?.usd || 1);
      } catch (error) {
        console.log('Error initializing upvote data:', error);
        setHivePrice(1);
      }
    };
    initializeUpvoteData();
  }, []);

  return {
    hivePrice,
    globalProps,
    rewardFund,
  };
}; 