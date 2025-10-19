// --- MONAD S0 CONTRACT DETAILS ---
// The contract address is now loaded from a Vite environment variable.
// Create a .env.local file in your project root and add:
// VITE_MONAD_CONTRACT_ADDRESS=0xYourContractAddressHere
// @FIX: Cast `import.meta` to `any` to avoid TypeScript error when accessing `env`.
export const MONAD_LEADERBOARD_ADDRESS = (import.meta as any).env.VITE_MONAD_CONTRACT_ADDRESS as `0x${string}`;

export const MONAD_LEADERBOARD_ABI = [
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"player","type":"address"},{"indexed":false,"internalType":"uint64","name":"score","type":"uint64"}],"name":"GameSubmitted","type":"event"},
  {"inputs":[],"name":"getLeaderboard","outputs":[{"components":[{"internalType":"address","name":"player","type":"address"},{"internalType":"uint64","name":"score","type":"uint64"}],"internalType":"struct GameLeaderboard.Leader[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"leaderboard","outputs":[{"internalType":"address","name":"player","type":"address"},{"internalType":"uint64","name":"score","type":"uint64"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"results","outputs":[{"internalType":"uint128","name":"packedBoard","type":"uint128"},{"internalType":"uint64","name":"score","type":"uint64"},{"internalType":"uint64","name":"startTime","type":"uint64"},{"internalType":"uint64","name":"endTime","type":"uint64"},{"internalType":"bytes32","name":"seed","type":"bytes32"},{"internalType":"bytes32","name":"randomness","type":"bytes32"},{"internalType":"bytes32","name":"movesHash","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint128","name":"packedBoard","type":"uint128"},{"internalType":"uint64","name":"score","type":"uint64"},{"internalType":"uint64","name":"startTime","type":"uint64"},{"internalType":"uint64","name":"endTime","type":"uint64"},{"internalType":"bytes32","name":"seed","type":"bytes32"},{"internalType":"bytes32","name":"randomness","type":"bytes32"},{"internalType":"bytes32","name":"movesHash","type":"bytes32"}],"name":"submitGame","outputs":[],"stateMutability":"nonpayable","type":"function"}
];
// --- END OF CONTRACT DETAILS ---
