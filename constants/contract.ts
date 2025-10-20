

// --- MONAD S0 CONTRACT DETAILS ---
// The contract address is now loaded from a Vite environment variable.
// Create a .env.local file in your project root and add:
// VITE_MONAD_CONTRACT_ADDRESS=0xYourContractAddressHere
export const MONAD_LEADERBOARD_ADDRESS = (import.meta as any).env.VITE_MONAD_CONTRACT_ADDRESS as `0x${string}`;

// --- BASE S0 CONTRACT DETAILS ---
// VITE_BASE_CONTRACT_ADDRESS=0x3a51F8B9d3489d0A6eDccf88565bFC9594129fd7
export const BASE_LEADERBOARD_ADDRESS = (import.meta as any).env.VITE_BASE_CONTRACT_ADDRESS as `0x${string}`;

// --- CELO S0 CONTRACT DETAILS ---
// VITE_CELO_CONTRACT_ADDRESS=0x7aD03C587f63165d4119D912D112E3a060694f78
export const CELO_LEADERBOARD_ADDRESS = (import.meta as any).env.VITE_CELO_CONTRACT_ADDRESS as `0x${string}`;

// --- SHARED LEADERBOARD ABI ---
// This ABI is assumed to be the same for Monad, Base, and Celo leaderboards.
export const LEADERBOARD_ABI = [
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"player","type":"address"},{"indexed":false,"internalType":"uint64","name":"score","type":"uint64"}],"name":"GameSubmitted","type":"event"},
  {"inputs":[],"name":"getLeaderboard","outputs":[{"components":[{"internalType":"address","name":"player","type":"address"},{"internalType":"uint64","name":"score","type":"uint64"}],"internalType":"struct GameLeaderboard.Leader[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"leaderboard","outputs":[{"internalType":"address","name":"player","type":"address"},{"internalType":"uint64","name":"score","type":"uint64"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"results","outputs":[{"internalType":"uint128","name":"packedBoard","type":"uint128"},{"internalType":"uint64","name":"score","type":"uint64"},{"internalType":"uint64","name":"startTime","type":"uint64"},{"internalType":"uint64","name":"endTime","type":"uint64"},{"internalType":"bytes32","name":"seed","type":"bytes32"},{"internalType":"bytes32","name":"randomness","type":"bytes32"},{"internalType":"bytes32","name":"movesHash","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint128","name":"packedBoard","type":"uint128"},{"internalType":"uint64","name":"score","type":"uint64"},{"internalType":"uint64","name":"startTime","type":"uint64"},{"internalType":"uint64","name":"endTime","type":"uint64"},{"internalType":"bytes32","name":"seed","type":"bytes32"},{"internalType":"bytes32","name":"randomness","type":"bytes32"},{"internalType":"bytes32","name":"movesHash","type":"bytes32"}],"name":"submitGame","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

// Helper type for on-chain season configuration
export type OnChainSeasonConfig = {
  address: `0x${string}`;
  abi: any;
  chainId: number;
  chainName: string;
};

// Map seasons to their on-chain configurations
export const onChainSeasonConfigs = {
  'monad-s0': {
    address: MONAD_LEADERBOARD_ADDRESS,
    abi: LEADERBOARD_ABI,
    chainId: 10143,
    chainName: 'Monad Testnet',
  },
  'base-s0': {
    address: BASE_LEADERBOARD_ADDRESS,
    abi: LEADERBOARD_ABI,
    chainId: 8453,
    chainName: 'Base',
  },
  'celo-s0': {
    address: CELO_LEADERBOARD_ADDRESS,
    abi: LEADERBOARD_ABI,
    chainId: 42220,
    chainName: 'Celo',
  },
};

// For backward compatibility where MONAD_LEADERBOARD_ABI is imported directly.
export const MONAD_LEADERBOARD_ABI = LEADERBOARD_ABI;
// --- END OF CONTRACT DETAILS ---
