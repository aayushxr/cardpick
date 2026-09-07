import { kv, KEYS } from "./kv";
import { DEFAULT_SETTINGS, type Settings } from "./types";

export async function getSettings(): Promise<Settings> {
  const saved = await kv().get<Partial<Settings>>(KEYS.settings);
  if (!saved) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    unitValue: { ...DEFAULT_SETTINGS.unitValue, ...(saved.unitValue ?? {}) },
    fxOverride: { ...DEFAULT_SETTINGS.fxOverride, ...(saved.fxOverride ?? {}) },
  };
}

export async function saveSettings(next: Settings): Promise<void> {
  await kv().set(KEYS.settings, next);
}

function num(v: unknown, fallback: number, min = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

/** Validate a settings payload from the UI. Unknown keys are dropped. */
export function sanitiseSettings(body: unknown): Settings {
  const b = (body ?? {}) as Record<string, unknown>;
  const uv = (b.unitValue ?? {}) as Record<string, unknown>;
  const fx = (b.fxOverride ?? {}) as Record<string, unknown>;
  const opt = (v: unknown): number | null => (v === null || v === "" || v === undefined ? null : num(v, 0) || null);
  const rate = num(b.sliceCashbackRate, DEFAULT_SETTINGS.sliceCashbackRate);
  return {
    unitValue: {
      horizonMile: num(uv.horizonMile, DEFAULT_SETTINGS.unitValue.horizonMile),
      neoPoint: num(uv.neoPoint, DEFAULT_SETTINGS.unitValue.neoPoint),
      sliceMonie: num(uv.sliceMonie, DEFAULT_SETTINGS.unitValue.sliceMonie),
      wowRp: num(uv.wowRp, DEFAULT_SETTINGS.unitValue.wowRp),
    },
    sliceCashbackRate: rate > 0 && rate <= 100 ? rate : DEFAULT_SETTINGS.sliceCashbackRate,
    fxOverride: { USD: opt(fx.USD), QAR: opt(fx.QAR) },
    defaultExpensed: b.defaultExpensed === true,
  };
}
