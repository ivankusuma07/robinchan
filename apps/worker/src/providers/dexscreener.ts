import { callProvider, fetchJson } from './adapter.js';

/**
 * $RCHAN on-chain price. The contract address only exists after launch on
 * Pons (brief §18, open decision #2), so without
 * `NEXT_PUBLIC_RCHAN_ADDRESS` this adapter's status is gray, not red.
 */
const BASE = 'https://api.dexscreener.com/latest/dex/tokens';

export type TokenStats = {
  priceUsd: number;
  changePct24h: number;
  volume24h: number;
  liquidityUsd: number;
};

type DexPair = {
  priceUsd?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
};

export async function fetchTokenStats(): Promise<TokenStats> {
  const address = process.env.NEXT_PUBLIC_RCHAN_ADDRESS || undefined;
  return callProvider({ id: 'dexscreener', configured: Boolean(address) }, async () => {
    const body = await fetchJson<{ pairs?: DexPair[] }>(`${BASE}/${address}`);
    const pair = body.pairs?.[0];
    if (!pair?.priceUsd) throw new Error('no pair found for this address');
    return {
      priceUsd: Number(pair.priceUsd),
      changePct24h: pair.priceChange?.h24 ?? 0,
      volume24h: pair.volume?.h24 ?? 0,
      liquidityUsd: pair.liquidity?.usd ?? 0,
    };
  });
}
