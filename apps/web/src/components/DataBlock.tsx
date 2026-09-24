import type { ReactNode } from 'react';

import { cx } from '@/components/ui';

export type DataState = 'loading' | 'empty' | 'error' | 'stale' | 'ready';

/**
 * One wrapper for the four data states every block on Heat / Portfolio /
 * Trade has to handle (plan §3), so they behave identically everywhere:
 *
 * - `loading` → the caller's skeleton, sized to the real content so nothing
 *   jumps when data lands.
 * - `empty` → the caller's empty message.
 * - `error` → a plain line, never a stack trace or an alarming banner.
 * - `stale` → the real content, dimmed with the same `.is-stale` treatment
 *   Market uses (brief §8: stale data is dimmed, never hidden).
 */
export function DataBlock({
  state,
  skeleton,
  empty,
  error = "Couldn't load this right now. It'll retry on its own.",
  children,
  className,
}: {
  state: DataState;
  skeleton: ReactNode;
  empty: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  if (state === 'loading') {
    return (
      <div className={className} aria-busy="true">
        {skeleton}
      </div>
    );
  }
  if (state === 'empty') return <div className={className}>{empty}</div>;
  if (state === 'error') {
    return (
      <div className={cx('px-5 py-8 text-center text-[13px] text-text-3', className)} role="status">
        {error}
      </div>
    );
  }
  return <div className={cx(state === 'stale' && 'is-stale', className)}>{children}</div>;
}
