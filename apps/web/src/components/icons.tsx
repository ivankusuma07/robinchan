import {
  ArrowLeftRight,
  ArrowRight,
  AudioLines,
  Check,
  Bot,
  Briefcase,
  ExternalLink,
  Flame,
  Home,
  Image as ImageGlyph,
  KeyRound,
  LayoutGrid,
  LineChart,
  Lock,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Star,
  X,
  type LucideProps,
} from 'lucide-react';

/**
 * Icon set backed by lucide-react, re-exported under names that describe how
 * each one is used in this app. Each wrapper carries the default size that
 * fit the slot it was designed for — call sites can still override `size`,
 * `width`, `height`, or `className` as usual.
 */

function wrap(Icon: typeof Home, defaultSize: number, defaultStrokeWidth = 1.75) {
  function Wrapped(props: LucideProps) {
    return <Icon size={defaultSize} strokeWidth={defaultStrokeWidth} aria-hidden {...props} />;
  }
  Wrapped.displayName = `Icon(${Icon.displayName ?? Icon.name})`;
  return Wrapped;
}

export const HomeIcon = wrap(Home, 18);
/** Robinchan nav icon and chat avatar glyph — stands in for the character. */
export const PodIcon = wrap(Bot, 18);
export const MarketIcon = wrap(LineChart, 18);
export const TradeIcon = wrap(ArrowLeftRight, 18);
export const HeatIcon = wrap(Flame, 18);
export const PortfolioIcon = wrap(Briefcase, 18);
export const MenuIcon = wrap(Menu, 20);
export const CloseIcon = wrap(X, 20);
export const ArrowRightIcon = wrap(ArrowRight, 16);
export const LockIcon = wrap(Lock, 14);
export const WaveformIcon = wrap(AudioLines, 16);
export const ExternalIcon = wrap(ExternalLink, 14);

// Home feature-card glyphs (design.md §10) — not used in the dashboard.
export const GridIcon = wrap(LayoutGrid, 20);
export const ChatIcon = wrap(MessageSquareText, 20);
export const KeyIcon = wrap(KeyRound, 20);
export const BackgroundIcon = wrap(ImageGlyph, 16);
export const CheckIcon = wrap(Check, 14);
export const CollapseSidebarIcon = wrap(PanelLeftClose, 18);
export const ExpandSidebarIcon = wrap(PanelLeftOpen, 18);
/** Heat row watchlist toggle. */
export const StarIcon = wrap(Star, 16);
