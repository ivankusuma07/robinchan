import { createPublicClient, defineChain, http, type PublicClient } from 'viem';

/**
 * Robinhood Chain testnet, defined by hand since it isn't in viem's built-in
 * chain list. Chain ID confirmed 24 Sep 2026 via `eth_chainId` against the
 * public RPC (0xb626 = 46630), matching Alchemy's published value —
 * https://www.alchemy.com/rpc/robinhood-testnet.
 *
 * Values are read from env so a later network change (or moving to
 * mainnet) doesn't need a code change, per brief §16.
 */
export function robinhoodChain() {
  const id = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 46630);
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://rpc.testnet.chain.robinhood.com';
  return defineChain({
    id,
    name: id === 46630 ? 'Robinhood Chain Testnet' : `Robinhood Chain (${id})`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: { default: { name: 'Explorer', url: 'https://explorer.testnet.chain.robinhood.com' } },
  });
}

let client: PublicClient | null = null;

/**
 * One shared client, used for SIWE signature verification (handles both
 * EOA and ERC-1271 smart-contract wallets) and, once `NEXT_PUBLIC_RCHAN_ADDRESS`
 * is set, for reading tier balances.
 */
export function publicClient(): PublicClient {
  if (!client) {
    client = createPublicClient({ chain: robinhoodChain(), transport: http() });
  }
  return client;
}
