import { AppShell } from '@/components/shell/AppShell';

/**
 * Dashboard shell — sidebar + topbar (brief §3) — for the working surfaces:
 * Robinchan and Market. Deliberately not applied to Home; see
 * `(marketing)/layout.tsx` and design.md §10.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
