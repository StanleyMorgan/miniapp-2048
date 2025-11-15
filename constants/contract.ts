
// All season-specific configurations, including contract addresses and chain IDs,
// have been migrated to the `seasons` table in the database.
// This file now only contains the shared ABI for on-chain leaderboard contracts.

// --- SHARED LEADERBOARD ABI ---
// This ABI is assumed to be the same for all on-chain leaderboards.
export const LEADERBOARD_ABI = [
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"player","type":"address"},{"indexed":false,"internalType":"uint64","name":"score","type":"uint64"}],"name":"GameSubmitted","type":"event"},
  {"inputs":[],"name":"getLeaderboard","outputs":[{"components":[{"internalType":"address","name":"player","type":"address"},{"internalType":"uint64","name":"score","type":"uint64"}],"internalType":"struct GameLeaderboard.Leader[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"leaderboard","outputs":[{"internalType":"address","name":"player","type":"address"},{"internalType":"uint64","name":"score","type":"uint64"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"results","outputs":[{"internalType":"uint128","name":"packedBoard","type":"uint128"},{"internalType":"uint64","name":"score","type":"uint64"},{"internalType":"uint64","name":"startTime","type":"uint64"},{"internalType":"uint64","name":"endTime","type":"uint64"},{"internalType":"bytes32","name":"seed","type":"bytes32"},{"internalType":"bytes32","name":"randomness","type":"bytes32"},{"internalType":"bytes32","name":"movesHash","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint128","name":"packedBoard","type":"uint128"},{"internalType":"uint64","name":"score","type":"uint64"},{"internalType":"uint64","name":"startTime","type":"uint64"},{"internalType":"uint64","name":"endTime","type":"uint64"},{"internalType":"bytes32","name":"seed","type":"bytes32"},{"internalType":"bytes32","name":"randomness","type":"bytes32"},{"internalType":"bytes32","name":"movesHash","type":"bytes32"}],"name":"submitGame","outputs":[],"stateMutability":"nonpayable","type":"function"}
] as const;
