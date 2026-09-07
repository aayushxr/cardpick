// Offer matching and valuation.
//
// Match on merchantName first. When merchantName is missing, offers in the
// same category are returned as hints only; they are never scored, because
// the offer only exists at that one merchant.

import type { Card, Offer, TransactionInput } from "../types";
import { fmtInr } from "./money";

export type OfferMatch = {
  offer: Offer;
  valueInr: number;
  label: string;
  warnings: string[];
};

function normalise(s: string | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

export function merchantMatches(offer: Offer, merchantName: string | undefined): boolean {
  const m = normalise(merchantName);
  if (!m) return false;
  return offer.match.some((k) => m.includes(k));
}

/** Local weekday in Asia/Kolkata, 0 = Sunday. */
export function kolkataWeekday(now: Date): number {
  const s = now.toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Kolkata" });
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(s);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Rupee value of an offer on this spend, after cap and min spend. 0 when it does not apply. */
export function valueOffer(offer: Offer, amountInr: number, now: Date): { value: number; warnings: string[]; blocked?: string } {
  const warnings: string[] = [];
  if (offer.minSpend && amountInr < offer.minSpend) {
    return { value: 0, warnings, blocked: `needs ${fmtInr(offer.minSpend)} minimum` };
  }
  if (offer.weekday !== undefined && kolkataWeekday(now) !== offer.weekday) {
    return { value: 0, warnings, blocked: `${WEEKDAYS[offer.weekday]}s only` };
  }
  let raw: number;
  switch (offer.type) {
    case "flat":
      raw = offer.value;
      break;
    case "percent":
      raw = (amountInr * offer.value) / 100;
      break;
    case "bogo":
      raw = amountInr / 2;
      break;
  }
  const value = offer.cap !== undefined ? Math.min(raw, offer.cap) : raw;
  if (offer.cap !== undefined) {
    warnings.push(`Offer cap ${fmtInr(offer.cap)}, check you haven't used it this month`);
  } else if (offer.type !== "flat") {
    warnings.push(`${offer.merchant} offer has no cap listed, check before paying`);
  }
  if (offer.type === "flat" && offer.cap === undefined) {
    warnings.push(`Offer is ${offer.frequency}, check you haven't used it this month`);
  }
  if (offer.note) warnings.push(offer.note);
  return { value: Math.min(value, amountInr), warnings };
}

export function offerLabel(offer: Offer): string {
  const capText = offer.cap !== undefined ? ` up to ${fmtInr(offer.cap)}` : "";
  const minText = offer.minSpend ? ` on ${fmtInr(offer.minSpend)}+` : "";
  switch (offer.type) {
    case "flat":
      return `${offer.merchant}: flat ${fmtInr(offer.value)} off${minText} (${offer.frequency})`;
    case "percent":
      return `${offer.merchant}: ${offer.value}% off${capText}${minText} (${offer.frequency})`;
    case "bogo":
      return `${offer.merchant}: 1+1${capText} (${offer.frequency})`;
  }
}

/**
 * Best scored offer for this card and input, plus hints for category matches
 * when merchantName is absent or matches nothing.
 */
export function findOffers(card: Card, input: TransactionInput, amountInr: number, now: Date): { best: OfferMatch | null; hints: string[] } {
  const merchantHits = card.offers.filter(
    (o) => merchantMatches(o, input.merchantName) && o.categories.includes(input.category),
  );
  // If the merchant matches but the category does not (Cleartrip hotels vs
  // flights), fall back to any merchant match so the user still sees it.
  const candidates = merchantHits.length ? merchantHits : card.offers.filter((o) => merchantMatches(o, input.merchantName));

  let best: OfferMatch | null = null;
  const hints: string[] = [];
  for (const offer of candidates) {
    const v = valueOffer(offer, amountInr, now);
    if (v.blocked) {
      hints.push(`${offerLabel(offer)}: not applied, ${v.blocked}`);
      continue;
    }
    if (!best || v.value > best.valueInr) {
      best = { offer, valueInr: v.value, label: offerLabel(offer), warnings: v.warnings };
    }
  }

  if (!candidates.length) {
    for (const offer of card.offers) {
      if (offer.categories.includes(input.category)) {
        hints.push(`If this is ${offer.merchant}: ${offerLabel(offer)}`);
      }
    }
  }
  return { best, hints };
}
