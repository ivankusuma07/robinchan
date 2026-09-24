import { cx } from '@/components/ui';

/**
 * The bar uses a gradient keyed to score tier, not a flat color (design.md §4).
 * High scores shift toward `down` — "hot" doesn't always mean good.
 *
 * On Home, bars grow in from 0 once the card scrolls into view (design.md
 * §10) rather than appearing pre-filled; on `/heat` it renders with `grow`
 * left at its default, already filled.
 */
export function HeatBar({
  score,
  grow = true,
  delayMs = 0,
  className,
}: {
  score: number;
  grow?: boolean;
  delayMs?: number;
  className?: string;
}) {
  const pct = Math.max(3, Math.min(100, score));
  const hot = score >= 70;
  const warm = score >= 45;

  return (
    <div className={cx('h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2', className)}>
      <div
        className={cx(
          'h-full rounded-full transition-[width] duration-700 ease-soft',
          hot
            ? 'bg-gradient-to-r from-accent to-down'
            : warm
              ? 'bg-gradient-to-r from-accent to-accent/55'
              : 'bg-accent/45',
        )}
        style={{ width: grow ? `${pct}%` : '0%', transitionDelay: `${delayMs}ms` }}
      />
    </div>
  );
}

/**
 * One component's share (0..1) as a small bar. `null` is a component that
 * isn't live yet (G5): drawn as a flat grey track with no fill, never as a
 * zero — "not measured" and "measured at zero" must not look alike.
 */
export function MiniBar({
  value,
  label,
  className,
}: {
  value: number | null;
  label: string;
  className?: string;
}) {
  const inactive = value == null;
  return (
    <div
      className={cx('h-1 w-full overflow-hidden rounded-full bg-surface-2', className)}
      role="img"
      aria-label={inactive ? `${label}: not active yet` : `${label}: ${Math.round(value * 100)} of 100`}
      title={inactive ? `${label} — not active yet` : `${label} ${Math.round(value * 100)}/100`}
    >
      {inactive ? (
        <div className="h-full w-full bg-[repeating-linear-gradient(90deg,#D5DED6_0_3px,transparent_3px_6px)]" />
      ) : (
        <div
          className="h-full rounded-full bg-accent-2"
          style={{ width: `${Math.max(4, Math.min(100, value * 100))}%` }}
        />
      )}
    </div>
  );
}
