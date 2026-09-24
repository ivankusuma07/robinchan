import { defineChain } from 'viem';

/**
 * Robinhood Chain testnet, mirrored from `apps/api/src/chain/client.ts` —
 * kept as two small definitions rather than a shared package export because
 * the API's is a Node `viem` client and this one feeds wagmi's browser
 * config; duplicating ~10 lines is cheaper than a cross-cutting import for
 * something this small. If it drifts, `NEXT_PUBLIC_CHAIN_ID` mismatching
 * the API's configured value is exactly the failure `verifySiwe` checks for
 * (wrong-chain SIWE messages are rejected), so drift can't pass silently.
 */
export function robinhoodChain() {
  const id = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 46630);
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://rpc.testnet.chain.robinhood.com';
  return defineChain({
    id,
    name: id === 46630 ? 'Robinhood Chain Testnet' : `Robinhood Chain (${id})`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: {
      default: { name: 'Explorer', url: 'https://explorer.testnet.chain.robinhood.com' },
    },
  });
}
