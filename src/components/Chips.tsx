"use client";

import { useState } from "react";
import { CATEGORY_INFO } from "@/lib/categories";
import { CATEGORIES, type TransactionInput } from "@/lib/types";

type Key = "amount" | "currency" | "country" | "merchantName" | "category" | "rail" | "expensed" | "isEmi";

const RAIL: Record<TransactionInput["rail"], string> = { upi: "UPI", card_online: "Card online", card_pos: "Card in person", tap: "Tap" };
const COUNTRY: Record<TransactionInput["country"], string> = { IN: "India", QA: "Qatar", OTHER: "Elsewhere" };

export function Chips({ input, amountInr, fxRate, onChange, disabled }: { input: TransactionInput; amountInr?: number; fxRate: number | null; onChange: (patch: Partial<TransactionInput>) => void; disabled: boolean }) {
  const [editing, setEditing] = useState<Key | null>(null);
  const [draft, setDraft] = useState("");

  const open = (k: Key, current: string) => {
    setEditing(k);
    setDraft(current);
  };
  const commit = (patch: Partial<TransactionInput>) => {
    setEditing(null);
    onChange(patch);
  };

  const chip = (k: Key, label: string, current: string) => (
    <button
      key={k}
      type="button"
      disabled={disabled}
      onClick={() => open(k, current)}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${editing === k ? "border-accent text-fg" : "border-line bg-panel text-muted hover:text-fg"}`}
    >
      {label}
    </button>
  );

  const amountLabel = `${input.currency === "INR" ? "₹" : `${input.currency} `}${input.amount.toLocaleString("en-IN")}${input.currency !== "INR" && amountInr ? ` ≈ ₹${Math.round(amountInr).toLocaleString("en-IN")}` : ""}`;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] uppercase tracking-wider text-muted">Parsed as, tap to correct</p>
      <div className="flex flex-wrap gap-2">
        {chip("amount", amountLabel, String(input.amount))}
        {chip("currency", input.currency, input.currency)}
        {chip("country", COUNTRY[input.country], input.country)}
        {chip("category", CATEGORY_INFO[input.category].label, input.category)}
        {chip("rail", RAIL[input.rail], input.rail)}
        {chip("merchantName", input.merchantName ? input.merchantName : "no merchant", input.merchantName ?? "")}
        {chip("expensed", input.expensed ? "expensed" : "not expensed", String(input.expensed))}
        {chip("isEmi", input.isEmi ? "EMI" : "no EMI", String(input.isEmi))}
      </div>
      {fxRate && input.currency !== "INR" && <p className="text-[11px] text-muted">Rate used: 1 {input.currency} = ₹{fxRate}</p>}

      {editing && (
        <div className="rounded-2xl border border-line bg-panel p-3">
          {editing === "amount" && (
            <form onSubmit={(e) => { e.preventDefault(); const n = Number(draft); if (n > 0) commit({ amount: n }); }} className="flex gap-2">
              <input autoFocus inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} className="num flex-1 rounded-xl border border-line bg-panel-2 px-3 py-2 outline-none focus:border-accent" />
              <button className="rounded-xl bg-fg px-4 py-2 text-sm font-medium text-bg">Set</button>
            </form>
          )}
          {editing === "merchantName" && (
            <form onSubmit={(e) => { e.preventDefault(); commit({ merchantName: draft.trim() || undefined }); }} className="flex gap-2">
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Merchant" className="flex-1 rounded-xl border border-line bg-panel-2 px-3 py-2 outline-none focus:border-accent" />
              <button className="rounded-xl bg-fg px-4 py-2 text-sm font-medium text-bg">Set</button>
            </form>
          )}
          {editing === "currency" && <Options values={["INR", "QAR", "USD", "OTHER"]} labels={{}} current={input.currency} onPick={(v) => commit({ currency: v as TransactionInput["currency"] })} />}
          {editing === "country" && <Options values={["IN", "QA", "OTHER"]} labels={COUNTRY} current={input.country} onPick={(v) => commit({ country: v as TransactionInput["country"] })} />}
          {editing === "rail" && <Options values={["upi", "card_online", "card_pos", "tap"]} labels={RAIL} current={input.rail} onPick={(v) => commit({ rail: v as TransactionInput["rail"] })} />}
          {editing === "category" && (
            <Options values={[...CATEGORIES]} labels={Object.fromEntries(CATEGORIES.map((c) => [c, CATEGORY_INFO[c].label]))} current={input.category} onPick={(v) => commit({ category: v as TransactionInput["category"] })} />
          )}
          {editing === "expensed" && <Options values={["true", "false"]} labels={{ true: "Expensed (Qlub reimburses)", false: "Not expensed" }} current={String(input.expensed)} onPick={(v) => commit({ expensed: v === "true" })} />}
          {editing === "isEmi" && <Options values={["true", "false"]} labels={{ true: "Converting to EMI", false: "No EMI" }} current={String(input.isEmi)} onPick={(v) => commit({ isEmi: v === "true" })} />}
        </div>
      )}
    </div>
  );
}

function Options({ values, labels, current, onPick }: { values: string[]; labels: Record<string, string>; current: string; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          className={`rounded-xl border px-3 py-2 text-sm ${v === current ? "border-accent bg-panel-2" : "border-line bg-panel-2 hover:border-accent"}`}
        >
          {labels[v] ?? v}
        </button>
      ))}
    </div>
  );
}
