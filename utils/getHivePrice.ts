// utils/getHivePrice.ts
// Utility to fetch the current HIVE price in USD from CoinGecko

export async function getHivePriceUSD(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=hive&vs_currencies=usd'
    );
    const data = await response.json();
    if (data && data.hive && typeof data.hive.usd === 'number') {
      return data.hive.usd;
    }
    return 0;
  } catch (err) {
    console.log('[HivePriceDebug] Error fetching HIVE price:', err);
    return 0;
  }
}
