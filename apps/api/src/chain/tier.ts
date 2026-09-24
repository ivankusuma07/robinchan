import type { TierId } from '@robinchan/shared';
import { TIER_UNLOCKS } from '@robinchan/shared';
import { cacheKey, getCache } from '@robinchan/store';

import { publicClient } from './client.js';

/** The two reads a tier check needs — nothing else, so no external ABI package. */
const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const;

const BALANCE_CACHE_TTL_SEC = 60;

// `decimals()` never changes for a deployed token — read once per process
// rather than on every balance check.
let decimalsCache: number | null = null;

export function rchanConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_RCHAN_ADDRESS);
}

/**
 * $RCHAN balance for `address`, as a human-readable decimal string (brief
 * §14: "read the balance from the contract via RPC, cache 60s per address;
 * never trust a balance the client sends"). Returns `"0"` if the token
 * address isn't configured yet (open decision #1) — that's a real, honest
 * answer, not an error: nobody can hold a token that doesn't exist yet.
 */
export async function rchanBalance(address: string): Promise<string> {
  const tokenAddress = process.env.NEXT_PUBLIC_RCHAN_ADDRESS;
  if (!tokenAddress) return '0';

  const key = cacheKey('tier-balance', address.toLowerCase());
  const cached = await getCache().get<string>(key);
  if (cached != null) return cached;

  const client = publicClient();
  const token = tokenAddress as `0x${string}`;
  const account = address as `0x${string}`;

  if (decimalsCache == null) {
    decimalsCache = await client.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'decimals',
    });
  }

  const raw = await client.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account],
  });

  const formatted = formatUnits(raw, decimalsCache);
  await getCache().set(key, formatted, BALANCE_CACHE_TTL_SEC);
  return formatted;
}

/** Minimal fixed-point → decimal string, no trailing zeros past the point. */
function formatUnits(raw: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = (raw % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** Env thresholds (brief §14: "belum final, pakai placeholder"). Empty = nobody qualifies yet. */
function threshold(name: 'TIER_1_MIN' | 'TIER_2_MIN' | 'TIER_3_MIN'): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : Number.POSITIVE_INFINITY;
}

/** Highest tier whose threshold the balance meets. */
export function tierForBalance(balance: string): TierId {
  const n = Number(balance);
  if (Number.isFinite(n) && n >= threshold('TIER_3_MIN')) return 'tier3';
  if (Number.isFinite(n) && n >= threshold('TIER_2_MIN')) return 'tier2';
  if (Number.isFinite(n) && n >= threshold('TIER_1_MIN')) return 'tier1';
  return 'free';
}

const TIER_ORDER: TierId[] = ['free', 'tier1', 'tier2', 'tier3'];

/** Tiers are cumulative — holding enough for Tier 2 keeps everything Tier 1 unlocked too. */
export function unlockedFor(tier: TierId): string[] {
  return TIER_ORDER.slice(0, TIER_ORDER.indexOf(tier) + 1).flatMap((t) => TIER_UNLOCKS[t]);
}
