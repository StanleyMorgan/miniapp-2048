
import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

// --- CHAIN DEFINITIONS ---

const monad = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MONAD', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://monad-testnet.drpc.org'] },
  },
  blockExplorers: {
    default: { name: 'MonadScan', url: 'https://monad-testnet.socialscan.io/' },
  },
});

const base = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.base.org'] },
  },
  blockExplorers: {
    default: { name: 'Basescan', url: 'https://basescan.org' },
  },
});

const celo = defineChain({
  id: 42220,
  name: 'Celo',
  nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://forno.celo.org'] },
  },
  blockExplorers: {
    default: { name: 'Celoscan', url: 'https://celoscan.io' },
  },
});
// --- END OF CHAIN DEFINITIONS ---

export const config = createConfig({
  chains: [monad, base, celo],
  transports: {
    [monad.id]: http(),
    [base.id]: http(),
    [celo.id]: http(),
  },
  connectors: [
    farcasterMiniApp()
  ]
});
