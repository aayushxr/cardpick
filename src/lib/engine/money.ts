// Small money helpers. Everything in the engine works in INR after conversion.

import type { Currency, SlabEarn } from "../types";

/** Rates map: INR per one unit of each currency. INR is always 1. */
export type RateMap = Partial<Record<Currency, number>> & { INR: 1 };

export function toInr(amount: number, currency: Currency, rates: RateMap): number {
  if (currency === "INR") return amount;
  const r = rates[currency];
  if (!r) {
    throw new Error(`No INR rate for ${currency}`);
  }
  return amount * r;
}

/** Per-transaction slab earn, rounded down. ₹259 at 2 per ₹100 earns 4. */
export function slabUnits(amountInr: number, rule: SlabEarn): number {
  return Math.floor(amountInr / rule.per) * rule.points;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function fmtInr(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const whole = Math.round(abs);
  return `${sign}₹${whole.toLocaleString("en-IN")}`;
}
