import { PodIcon } from '@/components/icons';

/**
 * Avatar Robinchan di daftar pesan.
 *
 * Cincin tipis `companion-pink` mengikuti warna ribbon karakter aslinya
 * (design.md §5) tanpa membawa pink itu masuk ke isi pesan. Isinya masih glyph
 * polong edamame, bukan likeness Zundamon — itu ditunda sampai poin lisensi di
 * design.md §9 selesai, dan diganti di satu tempat ini saja.
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
