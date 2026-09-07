// Glue between the HTTP layer and the engine: loads settings and FX, runs the
// engine, and turns NeedInrAmountError into a 422 the UI understands.

import { NeedInrAmountError, recommend } from "./engine";
import { buildRateMap, getFxRates } from "./fx-rates";
import { getSettings } from "./settings";
import type { Recommendation, TransactionInput } from "./types";
import { CATEGORIES } from "./types";

export type RecommendResponse = Recommendation & { fx: { stale: boolean; fetchedAt: string | null } };

export function coerceInput(body: unknown, defaultExpensed: boolean): TransactionInput | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "amount must be a positive number" };
  const currency = b.currency;
  if (!["INR", "QAR", "USD", "OTHER"].includes(String(currency))) return { error: "currency must be INR, QAR, USD or OTHER" };
  const country = b.country;
  if (!["IN", "QA", "OTHER"].includes(String(country))) return { error: "country must be IN, QA or OTHER" };
  const category = b.category;
  if (!CATEGORIES.includes(category as never)) return { error: "unknown category" };
  const rail = b.rail;
  if (!["upi", "card_online", "card_pos", "tap"].includes(String(rail))) return { error: "rail must be upi, card_online, card_pos or tap" };
  return {
    amount,
    currency: currency as TransactionInput["currency"],
    country: country as TransactionInput["country"],
    merchantName: typeof b.merchantName === "string" && b.merchantName.trim() ? b.merchantName.trim() : undefined,
    category: category as TransactionInput["category"],
    rail: rail as TransactionInput["rail"],
    expensed: typeof b.expensed === "boolean" ? b.expensed : defaultExpensed,
    isEmi: b.isEmi === true,
    notes: typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : undefined,
  };
}

export async function runRecommend(input: TransactionInput, amountInrOverride?: number): Promise<RecommendResponse | { needInr: true }> {
  const [settings, fx] = await Promise.all([getSettings(), getFxRates()]);
  const rates = buildRateMap(settings, fx);
  try {
    const rec = recommend(input, { settings, rates, amountInrOverride });
    return { ...rec, fx: { stale: fx?.stale ?? true, fetchedAt: fx?.fetchedAt ?? null } };
  } catch (e) {
    if (e instanceof NeedInrAmountError) return { needInr: true };
    throw e;
  }
}
