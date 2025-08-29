// Moderator configuration and tuning knobs for client-side moderation
// Start minimal: allowlist includes only 'snapie'; extendable later.

export const MOD_ALLOWLIST = ["snapie"]; // lowercased usernames

// How long a moderation decision stays fresh in memory (ms)
export const MOD_TTL_MS = 45 * 60 * 1000; // 45 minutes

// Limit concurrent voter lookups to avoid hammering nodes (not strictly enforced in v1)
export const MOD_MAX_CONCURRENCY = 4;
