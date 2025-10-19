import { http, createConfig } from 'wagmi';
// @FIX: `defineChain` is exported from `viem`, not `wagmi`.
import { defineChain } from 'viem';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

// --- MONAD CHAIN DEFINITION ---
// IMPORTANT: You must verify these details for the Monad network you are targeting.
// The values below are plausible placeholders for a testnet or future mainnet.
// Update the id, rpc URL, and explorer URL as needed.
const monad = defineChain({
  id: 10143, // Using Base chain ID as a placeholder. REPLACE with Monad's actual chain ID.
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MONAD', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://monad-testnet.drpc.org'] }, // REPLACE with the correct RPC URL for Monad.
  },
  blockExplorers: {
    default: { name: 'MonadScan', url: 'https://monad-testnet.socialscan.io/' }, // REPLACE with the correct block explorer URL.
  },
});
// --- END OF CHAIN DEFINITION ---

export const config = createConfig({
  chains: [monad],
  transports: {
    [monad.id]: http(),
  },
  connectors: [
    farcasterMiniApp()
  ]
});