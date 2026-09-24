import 'server-only';

/**
 * Page flags (trade-heat-portfolio plan §3). Server-only: read in server
 * components and passed down as props, so a flag can't be flipped from the
 * browser and pages that are off 404 before rendering anything.
 *
 * The values come from the repo-root `.env` (see next.config.mjs), the same
 * switches the API checks, so a page and its endpoints turn on together.
 */
export type PageFlags = {
  heat: boolean;
  portfolio: boolean;
  trade: boolean;
};

export function pageFlags(): PageFlags {
  return {
    heat: process.env.FEATURE_HEAT_PAGE === 'true',
    portfolio: process.env.FEATURE_PORTFOLIO_PAGE === 'true',
    // The Trade page has no flag of its own; it rides on FEATURE_TRADING.
    trade: process.env.FEATURE_TRADING === 'true',
  };
}
