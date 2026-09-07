"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FxRates, Settings } from "@/lib/types";

export function SettingsForm({ initial, fx: initialFx, persistent }: { initial: Settings; fx: FxRates | null; persistent: boolean }) {
  const router = useRouter();
  const [s, setS] = useState<Settings>(initial);
  const [fx, setFx] = useState<FxRates | null>(initialFx);
  const [status, setStatus] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState("");

  async function save() {
    setStatus("Saving");
    const res = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
    setStatus(res.ok ? "Saved" : "Save failed");
  }

  async function refreshFx() {
    setStatus("Fetching rates");
    const res = await fetch("/api/fx", { method: "POST" });
    const d = await res.json();
    setFx(d.fx);
    setStatus(d.fx?.stale ? "Fetch failed, showing last cached" : "Rates refreshed");
  }

  async function rotate() {
    if (newSecret.length < 16) {
      setStatus("Secret must be at least 16 characters");
      return;
    }
    const res = await fetch("/api/auth", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ next: newSecret }) });
    setStatus(res.ok ? "Secret rotated. Update the Shortcut." : "Rotation failed");
    if (res.ok) setNewSecret("");
  }

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  const unit = (key: keyof Settings["unitValue"], label: string, hint?: string) => (
    <label className="flex items-center justify-between gap-3 py-2">
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <input
        inputMode="decimal"
        value={s.unitValue[key]}
        onChange={(e) => setS({ ...s, unitValue: { ...s.unitValue, [key]: Number(e.target.value) || 0 } })}
        className="num w-24 rounded-xl border border-line bg-panel-2 px-3 py-2 text-right outline-none focus:border-accent"
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      {!persistent && (
        <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-2 text-xs text-warn">No Redis configured. Settings reset on every restart.</p>
      )}

      <section className="rounded-2xl border border-line bg-panel px-4 py-2">
        <h2 className="pt-2 text-[11px] uppercase tracking-wider text-muted">Value per unit (INR)</h2>
        {unit("horizonMile", "Horizon EDGE Mile")}
        {unit("neoPoint", "Neo EDGE point")}
        {unit("sliceMonie", "slice Monie")}
        {unit("wowRp", "WOW Black RP", "Flights and hotels via FIRST Rewards Gallery redeem at 0.50")}
      </section>

      <section className="rounded-2xl border border-line bg-panel px-4 py-2">
        <h2 className="pt-2 text-[11px] uppercase tracking-wider text-muted">slice</h2>
        <label className="flex items-center justify-between gap-3 py-2">
          <span className="text-sm">Cashback rate (%)</span>
          <select value={s.sliceCashbackRate} onChange={(e) => setS({ ...s, sliceCashbackRate: Number(e.target.value) })} className="rounded-xl border border-line bg-panel-2 px-3 py-2">
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
        <p className="pb-2 text-xs text-muted">Steps up to 2% after 3 lakh cumulative Monies.</p>
      </section>

      <section className="rounded-2xl border border-line bg-panel px-4 py-2">
        <h2 className="pt-2 text-[11px] uppercase tracking-wider text-muted">FX overrides (INR per unit)</h2>
        {(["USD", "QAR"] as const).map((c) => (
          <label key={c} className="flex items-center justify-between gap-3 py-2">
            <span>
              <span className="block text-sm">{c}/INR</span>
              <span className="block text-xs text-muted">
                {fx ? `Fetched ${fx.rates[c]} on ${new Date(fx.fetchedAt).toLocaleString("en-IN")}${fx.stale ? ", stale" : ""}` : "No rate fetched yet"}
              </span>
            </span>
            <input
              inputMode="decimal"
              placeholder="auto"
              value={s.fxOverride[c] ?? ""}
              onChange={(e) => setS({ ...s, fxOverride: { ...s.fxOverride, [c]: e.target.value === "" ? null : Number(e.target.value) } })}
              className="num w-24 rounded-xl border border-line bg-panel-2 px-3 py-2 text-right outline-none focus:border-accent"
            />
          </label>
        ))}
        <button type="button" onClick={refreshFx} className="mb-2 text-xs text-accent underline-offset-4 hover:underline">
          Refresh rates now
        </button>
      </section>

      <section className="rounded-2xl border border-line bg-panel px-4 py-2">
        <label className="flex items-center justify-between gap-3 py-2">
          <span>
            <span className="block text-sm">Default expensed</span>
            <span className="block text-xs text-muted">Fees zeroed for ranking when the parser cannot tell.</span>
          </span>
          <input type="checkbox" checked={s.defaultExpensed} onChange={(e) => setS({ ...s, defaultExpensed: e.target.checked })} className="h-5 w-5 accent-[#e8d9a0]" />
        </label>
      </section>

      <button type="button" onClick={save} className="rounded-2xl bg-fg px-4 py-3 font-medium text-bg">
        Save
      </button>

      <section className="rounded-2xl border border-line bg-panel px-4 py-3">
        <h2 className="text-[11px] uppercase tracking-wider text-muted">Shared secret</h2>
        <p className="mt-1 text-xs text-muted">Rotating updates the cookie on this device. Update the iOS Shortcut header yourself.</p>
        <div className="mt-2 flex gap-2">
          <input type="password" value={newSecret} onChange={(e) => setNewSecret(e.target.value)} placeholder="new secret, 16+ chars" className="flex-1 rounded-xl border border-line bg-panel-2 px-3 py-2 outline-none focus:border-accent" />
          <button type="button" onClick={rotate} className="rounded-xl border border-line px-3 py-2 text-sm hover:border-accent">
            Rotate
          </button>
        </div>
        <button type="button" onClick={logout} className="mt-3 text-xs text-muted underline-offset-4 hover:underline">
          Sign out on this device
        </button>
      </section>

      {status && <p className="text-sm text-muted">{status}</p>}
    </div>
  );
}
