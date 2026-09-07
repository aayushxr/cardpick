"use client";

import type { CardResult } from "@/lib/types";
import type { RecommendResponse } from "@/lib/recommend-server";

function inr(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function Result({ result }: { result: RecommendResponse }) {
  const { top, ranked, fx } = result;
  return (
    <div className="flex flex-col gap-4">
      {fx.stale && result.input.currency !== "INR" && (
        <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-2 text-xs text-warn">
          FX rate is stale{fx.fetchedAt ? ` (last fetched ${new Date(fx.fetchedAt).toLocaleDateString("en-IN")})` : ""}. Override it in settings if needed.
        </p>
      )}

      {top ? (
        <section className="rounded-3xl border border-accent/50 bg-panel p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted">Use</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">{top.short}</h2>
          <p className={`num mt-2 text-2xl ${top.net >= 0 ? "text-good" : "text-bad"}`}>{top.net >= 0 ? "+" : ""}{inr(top.net)}</p>
          <p className="mt-3 text-sm leading-relaxed text-fg/90">{top.reason}</p>
          {top.warnings.length > 0 && <Warnings items={top.warnings} />}
          {top.reminder && <p className="mt-2 text-xs text-muted">{top.reminder}</p>}
        </section>
      ) : (
        <section className="rounded-3xl border border-bad/40 bg-panel p-5">
          <h2 className="text-xl font-semibold">No card works here</h2>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-wider text-muted">All cards</p>
        {ranked.map((c) => (
          <Row key={c.cardId} c={c} isTop={c.cardId === top?.cardId} />
        ))}
      </section>

      <p className="text-xs text-muted">Siri line: {result.speech}</p>
    </div>
  );
}

function Row({ c, isTop }: { c: CardResult; isTop: boolean }) {
  return (
    <details className={`rounded-2xl border bg-panel ${c.eligible ? "border-line" : "border-line/60 opacity-60"}`} open={isTop}>
      <summary className="flex cursor-pointer items-center gap-3 px-4 py-3">
        <span className="num w-5 text-xs text-muted">{c.rank}</span>
        <span className="flex-1">
          <span className="block text-sm font-medium">{c.name}</span>
          <span className="block text-xs text-muted">{c.eligible ? summary(c) : c.dropReason}</span>
        </span>
        <span className={`num text-sm ${!c.eligible ? "text-muted" : c.net > 0 ? "text-good" : c.net < 0 ? "text-bad" : "text-muted"}`}>{c.eligible ? inr(c.net) : "out"}</span>
      </summary>
      <div className="border-t border-line px-4 py-3 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted">Earn</dt>
          <dd className="num">{c.earn ? `${c.earn.units} ${c.earn.unitName} = ${inr(c.earn.valueInr)}` : "none"}{c.earn && <span className="ml-2 text-xs text-muted">{c.earn.rateLabel}</span>}</dd>
          <dt className="text-muted">Offer</dt>
          <dd className="num">{c.offer ? `${inr(c.offer.valueInr)} ` : "none"}{c.offer && <span className="text-xs text-muted">{c.offer.label}</span>}</dd>
          <dt className="text-muted">Fee</dt>
          <dd className="num">
            {c.fee.inr > 0 ? `${inr(c.fee.inr)} (${c.fee.markupPct}%${c.fee.gstOnMarkupPct ? ` + ${c.fee.gstOnMarkupPct}% GST = ${c.fee.effectivePct}%` : ""})` : "₹0"}
            {c.fee.reimbursed && <span className="ml-2 text-xs text-good">reimbursed by Qlub</span>}
          </dd>
          <dt className="text-muted">Net</dt>
          <dd className="num font-medium">{inr(c.net)}</dd>
        </dl>
        {c.warnings.length > 0 && <Warnings items={c.warnings} />}
        {c.offerHints.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
            {c.offerHints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
        {c.reminder && <p className="mt-2 text-xs text-muted">{c.reminder}</p>}
      </div>
    </details>
  );
}

function summary(c: CardResult): string {
  const bits: string[] = [];
  if (c.earn && c.earn.units > 0) bits.push(`${c.earn.units} ${c.earn.unitName}`);
  if (c.offer) bits.push(`${inr(c.offer.valueInr)} off`);
  if (c.fee.inr > 0) bits.push(`${inr(c.fee.inr)} fee${c.fee.reimbursed ? ", reimbursed" : ""}`);
  return bits.join(" · ") || "earns nothing";
}

function Warnings({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-1">
      {items.map((w) => (
        <li key={w} className="flex gap-2 text-xs text-warn">
          <span aria-hidden>!</span>
          <span>{w}</span>
        </li>
      ))}
    </ul>
  );
}
