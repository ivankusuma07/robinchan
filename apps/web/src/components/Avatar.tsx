import { PodIcon } from '@/components/icons';

/**
 * Robinchan's avatar in the message list.
 *
 * The thin `companion-pink` ring echoes the character's ribbon color
 * (design.md §5) without letting pink bleed into the message content itself.
 * The glyph inside is a generic bot icon, not Zundamon's likeness — that's
 * on hold until the licensing items in design.md §9 clear, and swapping it
 * in later only touches this one place.
 */
export function Avatar({ size = 28 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-companion-pink/30 bg-surface-2 text-accent"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <PodIcon width={size * 0.55} height={size * 0.55} />
    </span>
  );
}
