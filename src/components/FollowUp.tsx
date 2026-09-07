"use client";

import { useState } from "react";
import { CATEGORY_INFO } from "@/lib/categories";
import { CATEGORIES, type ParsedTransaction } from "@/lib/types";

export type FieldKey = "amount" | "currency" | "country" | "category" | "rail" | "amountInr";

const QUESTIONS: Record<FieldKey, string> = {
  amount: "How much is it?",
  currency: "Which currency?",
  country: "Where is the merchant?",
  category: "What kind of purchase is this?",
  rail: "How are you paying?",
  amountInr: "No rate for that currency. Roughly how much in INR?",
};

export function FollowUp({ field, parsed, onAnswer }: { field: FieldKey; parsed: ParsedTransaction | null; onAnswer: (key: FieldKey, value: unknown) => void }) {
  const [num, setNum] = useState("");

  const opt = (label: string, value: unknown) => (
    <button key={String(value)} type="button" onClick={() => onAnswer(field, value)} className="rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm hover:border-accent">
      {label}
    </button>
  );

  return (
    <div className="rounded-2xl border border-accent/40 bg-panel p-4">
      <p className="mb-3 text-sm font-medium">{QUESTIONS[field]}</p>
      {(field === "amount" || field === "amountInr") && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(num);
            if (n > 0) onAnswer(field, n);
          }}
          className="flex gap-2"
        >
          <input
            autoFocus
            inputMode="decimal"
            value={num}
            onChange={(e) => setNum(e.target.value)}
            placeholder={field === "amountInr" ? "₹" : parsed?.currency ?? ""}
            className="num flex-1 rounded-xl border border-line bg-panel-2 px-3 py-2 outline-none focus:border-accent"
          />
          <button className="rounded-xl bg-fg px-4 py-2 text-sm font-medium text-bg">Go</button>
        </form>
      )}
      {field === "currency" && <div className="flex flex-wrap gap-2">{["INR", "QAR", "USD", "OTHER"].map((c) => opt(c, c))}</div>}
      {field === "country" && <div className="flex flex-wrap gap-2">{opt("India", "IN")}{opt("Qatar", "QA")}{opt("Elsewhere", "OTHER")}</div>}
      {field === "rail" && <div className="flex flex-wrap gap-2">{opt("UPI", "upi")}{opt("Card online", "card_online")}{opt("Card in person", "card_pos")}{opt("Tap", "tap")}</div>}
      {field === "category" && <div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => opt(CATEGORY_INFO[c].label, c))}</div>}
    </div>
  );
}
