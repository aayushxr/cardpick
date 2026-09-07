"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ParsedTransaction, TransactionInput } from "@/lib/types";
import type { RecommendResponse } from "@/lib/recommend-server";
import { Chips } from "./Chips";
import { FollowUp, type FieldKey } from "./FollowUp";
import { Result } from "./Result";
import { History } from "./History";

type Phase = "idle" | "parsing" | "asking" | "recommending" | "done";

const EXAMPLES = ["Zomato order ₹600 on UPI", "Claude subscription $200, expensed", "Uber in Doha, 17 riyals", "Chennai to Doha on airindia.com, ₹35,000"];

export function Ask({ defaultExpensed }: { defaultExpensed: boolean }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [missing, setMissing] = useState<FieldKey[]>([]);
  const [input, setInput] = useState<TransactionInput | null>(null);
  const [amountInr, setAmountInr] = useState<number | undefined>(undefined);
  const [needInr, setNeedInr] = useState(false);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const runRecommend = useCallback(async (next: TransactionInput, inr?: number) => {
    setPhase("recommending");
    setError(null);
    setNeedInr(false);
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...next, amountInr: inr }),
    });
    const data = await res.json();
    if (res.status === 422 && data.needInr) {
      setNeedInr(true);
      setPhase("asking");
      return;
    }
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      setPhase("idle");
      return;
    }
    setResult(data as RecommendResponse);
    setPhase("done");
  }, []);

  function toInput(p: ParsedTransaction): TransactionInput | null {
    if (p.amount === null || p.currency === null || p.country === null || p.category === null || p.rail === null) return null;
    return {
      amount: p.amount,
      currency: p.currency,
      country: p.country,
      merchantName: p.merchantName ?? undefined,
      category: p.category,
      rail: p.rail,
      expensed: p.expensed ?? defaultExpensed,
      isEmi: p.isEmi ?? false,
      notes: p.notes ?? undefined,
    };
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    setPhase("parsing");
    setError(null);
    setResult(null);
    setInput(null);
    setAmountInr(undefined);
    const res = await fetch("/api/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Parser failed.");
      setPhase("idle");
      return;
    }
    const p = data.parsed as ParsedTransaction;
    setParsed(p);
    setMissing(data.missing as FieldKey[]);
    const full = toInput(p);
    if (full) {
      setInput(full);
      await runRecommend(full);
    } else {
      setPhase("asking");
    }
  }

  async function answerFollowUp(key: FieldKey, value: unknown) {
    if (key === "amountInr") {
      const n = Number(value);
      setAmountInr(n);
      if (input) await runRecommend(input, n);
      return;
    }
    if (!parsed) return;
    const p = { ...parsed, [key]: value } as ParsedTransaction;
    setParsed(p);
    const rest = missing.filter((m) => m !== key);
    setMissing(rest);
    const full = toInput(p);
    if (full) {
      setInput(full);
      await runRecommend(full, amountInr);
    }
  }

  async function correct(patch: Partial<TransactionInput>) {
    if (!input) return;
    const next = { ...input, ...patch };
    setInput(next);
    await runRecommend(next, amountInr);
  }

  useEffect(() => {
    box.current?.focus();
  }, []);

  const busy = phase === "parsing" || phase === "recommending";

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <textarea
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          enterKeyHint="go"
          placeholder="What are you about to pay for?"
          className="w-full resize-none rounded-2xl border border-line bg-panel px-4 py-3 text-base leading-relaxed outline-none placeholder:text-muted focus:border-accent"
        />
        <button type="submit" disabled={busy || !text.trim()} className="rounded-2xl bg-fg px-4 py-3 text-base font-medium text-bg transition disabled:opacity-40">
          {phase === "parsing" ? "Reading" : phase === "recommending" ? "Scoring" : "Which card?"}
        </button>
      </form>

      {phase === "idle" && !result && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-muted hover:text-fg"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && <p className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{error}</p>}

      {phase === "asking" && parsed && !needInr && missing[0] && <FollowUp field={missing[0]} parsed={parsed} onAnswer={answerFollowUp} />}
      {phase === "asking" && needInr && input && <FollowUp field="amountInr" parsed={parsed} onAnswer={answerFollowUp} />}

      {input && (
        <Chips input={input} amountInr={result?.amountInr} fxRate={result?.fxRateUsed ?? null} onChange={correct} disabled={busy} />
      )}

      {result && input && (
        <>
          <Result result={result} />
          <History merchant={input.merchantName} category={input.category} />
        </>
      )}
    </div>
  );
}
