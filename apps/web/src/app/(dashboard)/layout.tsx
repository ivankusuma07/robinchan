import { AppShell } from '@/components/shell/AppShell';
import { pageFlags } from '@/lib/flags';

/**
 * Dashboard shell — sidebar + topbar (brief §3) — for the working surfaces:
 * Robinchan, Market, and the flag-gated Trade / Heat / Portfolio pages.
 * Deliberately not applied to Home; see `(marketing)/layout.tsx` and
 * design.md §10.
 *
 * Flags are read here, on the server, and handed to the client shell as a
 * plain object — the sidebar needs them to decide which items are live.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell flags={pageFlags()}>{children}</AppShell>;
}
