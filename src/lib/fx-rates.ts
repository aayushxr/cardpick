// Daily FX rates. Source: open.er-api.com (free, no key, includes INR and QAR).
// Cached in KV for 24 hours. If the fetch fails the last cached value is served
// with stale = true so the UI can warn. Settings overrides win over fetched rates.

import { kv, KEYS } from "./kv";
import type { RateMap } from "./engine";
import type { FxRates, Settings } from "./types";

const SOURCE = "https://open.er-api.com/v6/latest/USD";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Cached = Omit<FxRates, "stale">;

async function fetchLive(): Promise<Cached> {
  const res = await fetch(SOURCE, { cache: "no-store" });
  if (!res.ok) throw new Error(`fx fetch failed: ${res.status}`);
  const json = (await res.json()) as { result: string; rates: Record<string, number> };
  if (json.result !== "success" || !json.rates?.INR || !json.rates?.QAR) {
    throw new Error("fx response missing INR or QAR");
  }
  const inrPerUsd = json.rates.INR;
  const inrPerQar = json.rates.INR / json.rates.QAR;
  return {
    rates: { USD: round4(inrPerUsd), QAR: round4(inrPerQar) },
    fetchedAt: new Date().toISOString(),
    source: "open.er-api.com",
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export async function getFxRates(): Promise<FxRates | null> {
  const cached = await kv().get<Cached>(KEYS.fx);
  const fresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < MAX_AGE_MS;
  if (fresh) return { ...cached, stale: false };
  try {
    const live = await fetchLive();
    await kv().set(KEYS.fx, live);
    return { ...live, stale: false };
  } catch {
    return cached ? { ...cached, stale: true } : null;
  }
}

export async function forceRefreshFx(): Promise<FxRates | null> {
  try {
    const live = await fetchLive();
    await kv().set(KEYS.fx, live);
    return { ...live, stale: false };
  } catch {
    const cached = await kv().get<Cached>(KEYS.fx);
    return cached ? { ...cached, stale: true } : null;
  }
}

/** Rates the engine should use: settings override first, then fetched. */
export function buildRateMap(settings: Settings, fx: FxRates | null): RateMap {
  const map: RateMap = { INR: 1 };
  const usd = settings.fxOverride.USD ?? fx?.rates.USD;
  const qar = settings.fxOverride.QAR ?? fx?.rates.QAR;
  if (usd) map.USD = usd;
  if (qar) map.QAR = qar;
  return map;
}
