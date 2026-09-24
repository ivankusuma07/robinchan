'use client';

import { useState } from 'react';
import { TIER_LABELS, shortAddress } from '@robinchan/shared';

import { useWallet } from '@/components/providers/WalletProvider';
import { cx } from '@/components/ui';

/**
 * The topbar's wallet control (brief §14). One button that becomes, in
 * order: a connect prompt, a sequence of "doing something, wait" states
 * while the SIWE flow runs, and finally either the signed-in address or a
 * retry prompt if the user declined to sign.
 */
export function WalletButton() {
  const wallet = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);

  if (wallet.status === 'disconnected') {
    return (
      <button type="button" onClick={wallet.connect} className="btn-ghost h-11 px-4 text-sm">
        Connect wallet
      </button>
    );
  }

  if (wallet.status === 'connecting-wallet' || wallet.status === 'awaiting-signature' || wallet.status === 'verifying') {
    const label =
      wallet.status === 'connecting-wallet'
        ? 'Connecting…'
        : wallet.status === 'awaiting-signature'
          ? 'Check your wallet…'
          : 'Signing in…';
    return (
      <button type="button" disabled className="btn-ghost h-11 px-4 text-sm" aria-busy="true">
        {label}
      </button>
    );
  }

  if (wallet.status === 'rejected') {
    return (
      <button
        type="button"
        onClick={wallet.retry}
        title={wallet.errorMessage ?? 'You declined the sign-in request'}
        className="btn-ghost h-11 px-4 text-sm text-down"
      >
        Sign-in declined — retry
      </button>
    );
  }

  // signed-in
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="btn-ghost h-11 gap-2 px-4 text-sm"
      >
        {wallet.tier ? (
          <span className="rounded-full border border-accent-2/70 bg-accent/35 px-2 py-0.5 font-mono text-[11px] text-text">
            {TIER_LABELS[wallet.tier]}
          </span>
        ) : null}
        <span className="font-mono">{wallet.address ? shortAddress(wallet.address) : ''}</span>
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className={cx(
            'card absolute right-0 top-[calc(100%+8px)] z-20 min-w-[160px] overflow-hidden p-1',
          )}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              void wallet.signOut();
            }}
            className="row-dense flex min-h-[40px] w-full items-center px-3 text-left text-[13px] text-text-2 transition-colors hover:bg-surface-2 hover:text-text"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
