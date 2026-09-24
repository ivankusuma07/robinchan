'use client';

import type { TierId } from '@robinchan/shared';

import { useWallet } from '@/components/providers/WalletProvider';

export type TierView = {
  /** A wallet is connected AND has completed SIWE — not just `isConnected`. */
  connected: boolean;
  /** The server-verified tier; null without a signed-in wallet. */
  tier: TierId | null;
};

const ORDER: Record<TierId, number> = { free: 0, tier1: 1, tier2: 2, tier3: 3 };

/** Whether `view` meets `required`. Without a wallet, nothing is met. */
export function meetsTier(view: TierView, required: TierId): boolean {
  return view.tier != null && ORDER[view.tier] >= ORDER[required];
}

/**
 * The single source every `<WalletGate>` / `<TierGate>` reads (plan §3).
 * Backed by `<Web3Providers>`'s wallet context — one SIWE session, shared by
 * every gate on the page, the topbar button, and this hook.
 */
export function useTier(): TierView {
  const { status, tier } = useWallet();
  return { connected: status === 'signed-in', tier };
}
