'use client';

import type { ReactNode } from 'react';
import type { TierId } from '@robinchan/shared';
import { TIER_LABELS } from '@robinchan/shared';

import { useWallet } from '@/components/providers/WalletProvider';
import { LockIcon } from '@/components/icons';
import { cx } from '@/components/ui';
import { meetsTier, useTier } from '@/lib/useTier';

/**
 * Blurred stand-in content. Hidden from assistive tech and made inert, so
 * sample values under the blur can't be tabbed into, selected, or read out
 * as if they were the user's data.
 */
function Blurred({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden
      // `inert` keeps focus and clicks out of the sample content entirely.
      inert
      className={cx('pointer-events-none select-none blur-[6px] saturate-50', className)}
    >
      {children}
    </div>
  );
}

/**
 * Wallet gate (plan §3): the page's real layout, filled with blurred sample
 * data, with a connect prompt centred over it — so a visitor sees what
 * they'd get, not an empty "please log in" box.
 *
 * `sample` is shown blurred without a wallet; `children` renders once one
 * is signed in (SIWE, not just "a wallet is connected" — brief §14). Opens
 * the same connect flow as the topbar's `<WalletButton>`, from the same
 * `useWallet()` context, so the two can't disagree about state.
 */
export function WalletGate({
  sample,
  children,
  title,
  body,
  align = 'top',
  className,
}: {
  sample: ReactNode;
  children?: ReactNode;
  title: string;
  body: string;
  /** `top` for a whole page (prompt above the fold), `center` for an inline block. */
  align?: 'top' | 'center';
  className?: string;
}) {
  const { connected } = useTier();
  const wallet = useWallet();
  if (connected && children) return <>{children}</>;

  const busy =
    wallet.status === 'connecting-wallet' ||
    wallet.status === 'awaiting-signature' ||
    wallet.status === 'verifying';
  const rejected = wallet.status === 'rejected';

  return (
    <div className={cx('relative', className)}>
      <Blurred>{sample}</Blurred>
      <div
        className={cx(
          'absolute inset-0 flex justify-center px-4',
          align === 'top' ? 'items-start pt-[min(18vh,160px)]' : 'items-center py-4',
        )}
      >
        <div className="card-glass w-full max-w-[400px] p-6 text-center">
          <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-text-2">
            <LockIcon width={18} height={18} />
          </span>
          <h2 className="t-h3 mb-2">{title}</h2>
          <p className="t-small mb-5">{body}</p>
          <button
            type="button"
            onClick={rejected ? wallet.retry : wallet.connect}
            disabled={busy}
            className="btn-primary w-full text-sm"
          >
            {busy
              ? 'Check your wallet…'
              : rejected
                ? 'Sign-in declined — retry'
                : 'Connect wallet'}
          </button>
          <p className="mt-3 text-[11px] leading-relaxed text-text-3">
            Robinchan never holds your keys — signing in only proves the address is yours.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Tier gate (plan §3): the gated content blurred, with the tier it needs.
 * Reads the same `useTier()` as the wallet gate, so both flip together once
 * M3 lands.
 */
export function TierGate({
  requiredTier,
  children,
  className,
}: {
  requiredTier: TierId;
  children: ReactNode;
  className?: string;
}) {
  const view = useTier();
  if (meetsTier(view, requiredTier)) return <>{children}</>;

  return (
    <div className={cx('relative', className)}>
      <Blurred>{children}</Blurred>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 font-mono text-[11px] text-text-2 shadow-glow-soft">
          <LockIcon />
          {TIER_LABELS[requiredTier]}
          {view.connected ? ' required' : ' · connect a wallet'}
        </span>
      </div>
    </div>
  );
}
