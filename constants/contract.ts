

// All season-specific configurations, including contract addresses and chain IDs,
// have been migrated to the `seasons` table in the database.

// --- ABI DEFINITIONS ---

// Version 1 (Original)
const LEADERBOARD_ABI_V1 = [
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"player","type":"address"},{"indexed":false,"internalType":"uint64","name":"score","type":"uint64"}],"name":"GameSubmitted","type":"event"},
  {"inputs":[],"name":"getLeaderboard","outputs":[{"components":[{"internalType":"address","name":"player","type":"address"},{"internalType":"uint64","name":"score","type":"uint64"}],"internalType":"struct GameLeaderboard.Leader[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"leaderboard","outputs":[{"internalType":"address","name":"player","type":"address"},{"internalType":"uint64","name":"score","type":"uint64"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"results","outputs":[{"internalType":"uint128","name":"packedBoard","type":"uint128"},{"internalType":"uint64","name":"score","type":"uint64"},{"internalType":"uint64","name":"startTime","type":"uint64"},{"internalType":"uint64","name":"endTime","type":"uint64"},{"internalType":"bytes32","name":"seed","type":"bytes32"},{"internalType":"bytes32","name":"randomness","type":"bytes32"},{"internalType":"bytes32","name":"movesHash","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint128","name":"packedBoard","type":"uint128"},{"internalType":"uint64","name":"score","type":"uint64"},{"internalType":"uint64","name":"startTime","type":"uint64"},{"internalType":"uint64","name":"endTime","type":"uint64"},{"internalType":"bytes32","name":"seed","type":"bytes32"},{"internalType":"bytes32","name":"randomness","type":"bytes32"},{"internalType":"bytes32","name":"movesHash","type":"bytes32"}],"name":"submitGame","outputs":[],"stateMutability":"nonpayable","type":"function"}
] as const;

// Version 2 (Payable + Referrals)
const LEADERBOARD_ABI_V2 = [
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"player","type":"address"},{"indexed":true,"internalType":"address","name":"referrer","type":"address"},{"indexed":false,"internalType":"uint64","name":"score","type":"uint64"}],"name":"GameSubmitted","type":"event"},
  {"inputs":[],"name":"getLeaderboard","outputs":[{"components":[{"internalType":"address","name":"player","type":"address"},{"internalType":"uint64","name":"score","type":"uint64"}],"internalType":"struct GameLeaderboard.Leader[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"leaderboard","outputs":[{"internalType":"address","name":"player","type":"address"},{"internalType":"uint64","name":"score","type":"uint64"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"results","outputs":[{"internalType":"uint128","name":"packedBoard","type":"uint128"},{"internalType":"uint64","name":"score","type":"uint64"},{"internalType":"uint64","name":"startTime","type":"uint64"},{"internalType":"uint64","name":"endTime","type":"uint64"},{"internalType":"bytes32","name":"seed","type":"bytes32"},{"internalType":"bytes32","name":"randomness","type":"bytes32"},{"internalType":"bytes32","name":"movesHash","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"feeAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"referralPercent","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"defaultReferrer","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint128","name":"packedBoard","type":"uint128"},{"internalType":"uint64","name":"score","type":"uint64"},{"internalType":"uint64","name":"startTime","type":"uint64"},{"internalType":"uint64","name":"endTime","type":"uint64"},{"internalType":"bytes32","name":"seed","type":"bytes32"},{"internalType":"bytes32","name":"randomness","type":"bytes32"},{"internalType":"bytes32","name":"movesHash","type":"bytes32"},{"internalType":"address payable","name":"referrer","type":"address"}],"name":"submitGame","outputs":[],"stateMutability":"payable","type":"function"}
] as const;

// --- ABI VERSION MAPPING ---
// We use a union type for the ABI to allow different shapes
export const CONTRACT_VERSIONS: Record<string, any> = {
  'v1': LEADERBOARD_ABI_V1,
  'v2': LEADERBOARD_ABI_V2
};

// Default export for backward compatibility or default usage
export const LEADERBOARD_ABI = LEADERBOARD_ABI_V1;

export const getAbiForVersion = (version: string | null | undefined) => {
  const ver = version || 'v1';
  return CONTRACT_VERSIONS[ver] || LEADERBOARD_ABI_V1;
};
