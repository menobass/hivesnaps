/**
 * Calculate accurate voting power including regeneration over time
 * 
 * Hive voting power (VP) regenerates at a rate of 20% per day (100% in 5 days).
 * This means: 0.833% per hour, 0.0139% per minute, 0.000231% per second
 * 
 * The blockchain stores a snapshot of VP at the time of last action.
 * To get current VP, we must calculate how much has regenerated since then.
 */

import type { ExtendedAccount } from '@hiveio/dhive';

// Constants from Hive blockchain
const HIVE_VOTING_MANA_REGENERATION_SECONDS = 5 * 24 * 60 * 60; // 5 days in seconds
const HIVE_100_PERCENT = 10000;

/**
 * Calculate current voting power with regeneration
 * 
 * @param account - Hive account object from API
 * @returns Current voting power (0-10000, where 10000 = 100%)
 */
export function calculateVotingPower(account: ExtendedAccount): number {
  // Try to use voting_manabar first (more accurate)
  if (account.voting_manabar) {
    const manabar = account.voting_manabar;
    // Robustly parse current_mana which can be string, number, or absent.
    const rawCurrentMana: unknown = manabar?.current_mana;
    let currentMana = 0;
    if (typeof rawCurrentMana === 'string') {
      const parsed = parseInt(rawCurrentMana, 10);
      currentMana = Number.isFinite(parsed) ? parsed : 0;
    } else if (typeof rawCurrentMana === 'number') {
      currentMana = Number.isFinite(rawCurrentMana) ? rawCurrentMana : 0;
    } else {
      currentMana = 0;
    }
    // Validate last_update_time (could be string, number, or missing).
    const rawLastUpdate: unknown = manabar?.last_update_time;
    // Default to now (no regeneration) if last update is invalid/missing
    let lastUpdateTime = Math.floor(Date.now() / 1000);
    if (typeof rawLastUpdate === 'string') {
      const parsed = parseInt(rawLastUpdate, 10);
      lastUpdateTime = Number.isFinite(parsed) ? parsed : lastUpdateTime;
    } else if (typeof rawLastUpdate === 'number') {
      lastUpdateTime = Number.isFinite(rawLastUpdate) ? Math.floor(rawLastUpdate) : lastUpdateTime;
    }

    // Calculate max mana (based on vesting shares)
    const maxMana = calculateMaxMana(account);

    // Guard: if maxMana is zero (new account with no vesting), avoid division by zero
    if (maxMana === 0) {
      // Fallback to snapshot voting_power if available, otherwise 0
      const snapshot = typeof account.voting_power === 'number' ? account.voting_power : 0;
      return Math.max(0, Math.min(HIVE_100_PERCENT, snapshot));
    }

    // Calculate elapsed time since last update
    const nowSeconds = Math.floor(Date.now() / 1000);
    // Ensure non-negative elapsed seconds to avoid NaN/negative regeneration
    const elapsedSeconds = Math.max(0, nowSeconds - lastUpdateTime);

    // Calculate regenerated mana
    const regeneratedMana = (elapsedSeconds * maxMana) / HIVE_VOTING_MANA_REGENERATION_SECONDS;

    // Current mana = stored mana + regenerated mana (capped at max)
    const totalMana = Math.min(maxMana, currentMana + regeneratedMana);

    // Convert to percentage (0-10000)
    const votingPower = Math.floor((totalMana / maxMana) * HIVE_100_PERCENT);

    return Math.min(HIVE_100_PERCENT, Math.max(0, votingPower));
  }

  // Fallback to simple voting_power field (less accurate, no regeneration)
  // This is the old method - just a snapshot
  return account.voting_power || 0;
}

/**
 * Calculate maximum mana based on vesting shares
 * Max mana = effective vesting shares (own + received delegations - delegated out)
 */
function calculateMaxMana(account: ExtendedAccount): number {
  const vestingShares = parseVestingShares(account.vesting_shares);
  const receivedVestingShares = parseVestingShares(account.received_vesting_shares);
  const delegatedVestingShares = parseVestingShares(account.delegated_vesting_shares);

  // Effective vesting = own + received - delegated
  const effectiveVestingShares = vestingShares + receivedVestingShares - delegatedVestingShares;

  return Math.max(0, effectiveVestingShares);
}

/**
 * Parse vesting shares string or Asset to number
 * Example: "123456.789012 VESTS" -> 123456789012 (in micro VESTS)
 * Or Asset object with amount property
 */
function parseVestingShares(vestingSharesValue: string | { amount: number | string } | undefined): number {
  if (!vestingSharesValue) return 0;

  let vestingStr: string;

  // Handle Asset object
  if (typeof vestingSharesValue === 'object' && 'amount' in vestingSharesValue) {
    vestingStr = vestingSharesValue.amount.toString();
  } else if (typeof vestingSharesValue === 'string') {
    vestingStr = vestingSharesValue;
  } else {
    return 0;
  }

  // Parse string - could be just a number or "123.456 VESTS" format
  const parts = vestingStr.split(' ');
  const value = parseFloat(parts[0]);

  if (isNaN(value)) return 0;

  // Convert to micro VESTS (multiply by 1,000,000)
  return Math.floor(value * 1_000_000);
}

/**
 * Format voting power for display
 * @param votingPower - Voting power (0-10000)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string (e.g., "98.5")
 */
export function formatVotingPower(votingPower: number, decimals: number = 1): string {
  // Guard against NaN or invalid values
  if (!Number.isFinite(votingPower)) {
    // For invalid values, show "--" to match FeedScreen and PR description
    return '--';
  }
  return (votingPower / 100).toFixed(decimals);
}
