// utils/calculateVoteValue.ts
// Utility function to estimate Hive vote value for a given user and vote weight.
// Returns value in HBD, with at least 3 decimal places.

/**
 * Calculates the estimated vote value for a Hive user.
 * @param account Hive account object (from dhive)
 * @param globalProps Dynamic global properties (from dhive)
 * @param rewardFund Reward fund object (from dhive)
 * @param voteWeight Vote weight (1-100)
 * @param hivePrice Current HIVE price in USD
 * @returns Estimated value in HIVE and USD (author's share, before curation split)
 */
export function calculateVoteValue(
  account: any,
  globalProps: any,
  rewardFund: any,
  voteWeight: number,
  hivePrice?: number // optional, defaults to 1
): { hbd: string, usd: string } {
  if (!account || !globalProps || !rewardFund || !voteWeight) return { hbd: '0.000', usd: '0.00' };

  // Debug logs for input
  console.log('[VoteCalcDebug] account:', account);
  console.log('[VoteCalcDebug] globalProps:', globalProps);
  console.log('[VoteCalcDebug] rewardFund:', rewardFund);
  console.log('[VoteCalcDebug] voteWeight:', voteWeight);

  // Parse vesting shares (VESTS)
  const vestingShares = parseFloat((account.vesting_shares || '0').replace(' VESTS', ''));
  const receivedVestingShares = parseFloat((account.received_vesting_shares || '0').replace(' VESTS', ''));
  const delegatedVestingShares = parseFloat((account.delegated_vesting_shares || '0').replace(' VESTS', ''));
  const effectiveVests = vestingShares + receivedVestingShares - delegatedVestingShares;

  // Get global blockchain parameters
  const totalVestingShares = parseFloat(globalProps.total_vesting_shares.replace(' VESTS', ''));
  const totalVestingFundHive = parseFloat(globalProps.total_vesting_fund_hive.replace(' HIVE', ''));

  // Convert HP to VESTS (if you want to use HP as input, otherwise use effectiveVests directly)
  // const hp = effectiveVests * (totalVestingFundHive / totalVestingShares);
  // const totalVests = (hp * totalVestingShares) / totalVestingFundHive;
  // For now, use effectiveVests as VESTS
  const totalVests = effectiveVests;

  // Voting power and vote weight
  const votingPower = account.voting_power || 10000; // out of 10000
  const voteWeightBP = Math.round(voteWeight * 100); // basis points (1-10000)

  // Calculate vote strength and weight as percent
  const voteStrength = Math.min(Math.max(votingPower / 100, 0), 100);
  const voteWeightPercent = Math.min(Math.max(voteWeightBP / 100, 0), 100);
  const votePowerFactor = (voteStrength / 100) * (voteWeightPercent / 100);

  // Official Hive rshares formula
  // rshares = voting_power * vests * 1e6 / 10000
  const finalVest = totalVests * 1e6;
  const power = (votePowerFactor * 10000) / 50;
  const rshares = (power * finalVest) / 10000;

  // Reward fund
  const recentClaims = parseFloat(rewardFund.recent_claims);
  const rewardBalance = parseFloat((rewardFund.reward_balance || '0').replace(' HIVE', ''));

  // Get Hive price (default 1 if not provided)
  const price = typeof hivePrice === 'number' && hivePrice > 0 ? hivePrice : 1;

  // Calculate vote value (full vote value as shown in frontends)
  let voteValueHIVE = 0;
  if (recentClaims > 0) {
    voteValueHIVE = (rshares / recentClaims) * rewardBalance;
  }
  // Full payout in HBD (dollars), matching Hive frontends
  const voteValueHBD = voteValueHIVE; // 1 HIVE = 1 HBD for display
  const voteValueUSD = voteValueHIVE * price;

  // Debug logs for verification
  console.log('[VoteCalcDebug] effectiveVests:', effectiveVests);
  console.log('[VoteCalcDebug] rshares:', rshares);
  console.log('[VoteCalcDebug] recentClaims:', recentClaims);
  console.log('[VoteCalcDebug] rewardBalance:', rewardBalance);
  console.log('[VoteCalcDebug] voteValueHIVE:', voteValueHIVE);
  console.log('[VoteCalcDebug] hivePriceUSD:', price);
  console.log('[VoteCalcDebug] voteValueUSD:', voteValueUSD);

  return {
    hbd: voteValueHBD.toFixed(3),
    usd: voteValueUSD.toFixed(2)
  };
}
