import { callProvider, fetchJson } from './adapter.js';

/**
 * Harga $RCHAN on-chain. Alamat kontraknya baru ada setelah launch di Pons
 * (brief §18, keputusan terbuka #2), jadi tanpa `NEXT_PUBLIC_RCHAN_ADDRESS`
 * adaptor ini berstatus abu, bukan merah.
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
    if (!pair?.priceUsd) throw new Error('tidak ada pair untuk alamat ini');
    return {
      priceUsd: Number(pair.priceUsd),
      changePct24h: pair.priceChange?.h24 ?? 0,
      volume24h: pair.volume?.h24 ?? 0,
      liquidityUsd: pair.liquidity?.usd ?? 0,
    };
  });
}
