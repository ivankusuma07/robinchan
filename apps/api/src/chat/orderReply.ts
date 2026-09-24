import type { OrderIntent, OrderParseResult, ParseField, ParseReason } from '@robinchan/shared';
import { TRADABLE_SYMBOLS, formatPrice } from '@robinchan/shared';

/**
 * Order-shaped chat messages get a deterministic reply, not a model-written
 * one (brief §12: "don't guess — a wrong guess here costs the user money").
 * `parseOrder()` already produced a grounded, checked result; this module
 * only turns that result into a sentence. Nothing here calls the LLM.
 *
 * Two shapes:
 * - `describeCompleteOrder`: restates exactly what was understood — no
 *   OrderPreviewCard, because there is no real quote behind it yet
 *   (`/api/order/quote` is M4). design.md is explicit that this card must
 *   never show fabricated numbers, so until quoting exists, chat says so in
 *   plain words instead of rendering a card with nothing real in it.
 * - `describeIncompleteOrder`: one clarifying question, for the single
 *   highest-priority missing field (brief flow: "Tanya balik yang kurang") —
 *   asking about every gap at once reads as an interrogation, not a
 *   conversation.
 */

function sideWord(intent: OrderIntent): string {
  return intent.side === 'buy' ? 'buy' : 'sell';
}

export function describeCompleteOrder(intent: OrderIntent): string {
  const amount = `${intent.qty} share${intent.qty === 1 ? '' : 's'} of ${intent.symbol}`;
  const type =
    intent.orderType === 'limit' && intent.limitPrice != null
      ? `as a limit order at ${formatPrice(intent.limitPrice)}`
      : 'at market price';

  return (
    `Got it — ${sideWord(intent)} ${amount} ${type}. ` +
    "I can't build or sign that order from chat yet — quoting and signing haven't shipped here. " +
    'Nothing has been placed; this is only what I understood from your message.'
  );
}

const QUESTION: Partial<Record<ParseField, Partial<Record<ParseReason, string>>>> = {
  side: {
    not_stated: 'Are you looking to buy or sell?',
    not_in_text: "I want to make sure I've got the right side — buy or sell?",
    side_conflict: "That reads as both a buy and a sell to me — which one did you mean?",
  },
  symbol: {
    not_stated: 'Which stock did you mean?',
    not_in_text: "I want to double check which one you meant — which stock?",
  },
  qty: {
    not_stated: 'How many shares?',
    not_in_text: "I couldn't match a share count to what you wrote — how many shares, exactly?",
    notional_amount:
      "I can only place orders by share count right now, not by a dollar amount — how many shares would that be?",
    relative_amount:
      "I can't check your balance from chat yet, so I can't work out a fraction of it — how many shares, as a number?",
    vague_amount: 'How many shares exactly?',
    ambiguous_number:
      "I want to make sure I read that number right — could you write it as plain digits, like \"1500\" or \"1.5\"?",
    qty_too_large:
      "That's a very large number of shares — did a comma or decimal point go missing? What's the exact count?",
  },
  orderType: {
    unused_price:
      "I noticed a price in there but wasn't sure if it's a limit order — should I treat it as one, at that price?",
  },
  limitPrice: {
    not_stated: 'What price should the limit order trigger at?',
    not_in_text: "I couldn't match a price to what you wrote — what's the exact limit price?",
    ambiguous_number: 'Could you confirm the limit price as a plain number, like "172" or "172.50"?',
  },
};

const FALLBACK_QUESTION: Record<ParseField, string> = {
  side: 'Buy or sell?',
  symbol: 'Which stock?',
  qty: 'How many shares?',
  orderType: 'Market order, or a limit at a specific price?',
  limitPrice: 'What price should the limit order trigger at?',
};

export function describeIncompleteOrder(result: Extract<OrderParseResult, { status: 'incomplete' }>): string {
  if (result.reasons.includes('multiple_orders')) {
    return "I can only take one order at a time here — could you send the first one on its own, and the rest after?";
  }

  const field = result.missing[0];
  if (!field) {
    // Shouldn't happen (incomplete implies at least one missing field), but
    // fail into a generic prompt rather than an empty reply.
    return "I didn't quite catch the order — could you say it again, with the stock, side, and how many shares?";
  }

  const reason = result.fieldReasons[field];
  const question =
    (reason && QUESTION[field]?.[reason]) ?? FALLBACK_QUESTION[field];

  if (field === 'symbol' && reason === 'unsupported_symbol') {
    return `I don't have that one set up to trade yet. I can currently trade: ${TRADABLE_SYMBOLS.join(', ')}. Which of those did you mean, if any?`;
  }

  // A short recap of what *was* understood, so the question doesn't read as
  // having ignored the rest of the sentence.
  const understood: string[] = [];
  if (result.partial.side) understood.push(sideWord({ side: result.partial.side } as OrderIntent));
  if (result.partial.symbol) understood.push(result.partial.symbol);
  if (result.partial.qty != null) understood.push(`${result.partial.qty} shares`);

  const recap = understood.length > 0 ? `Got the ${understood.join(', ')} part. ` : '';
  return `${recap}${question}`;
}

/** Single entry point the chat route calls once it has a grounded parse result. */
export function describeOrder(result: OrderParseResult): string | null {
  if (result.status === 'complete') return describeCompleteOrder(result.intent);
  if (result.status === 'incomplete') return describeIncompleteOrder(result);
  return null;
}
