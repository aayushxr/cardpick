"use client";

import { useEffect, useState } from "react";
import type { FoldHistoryItem } from "@/lib/fold";

export function History({ merchant, category }: { merchant?: string; category: string }) {
  const [items, setItems] = useState<FoldHistoryItem[] | null>(null);

  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ category, ...(merchant ? { merchant } : {}) });
    fetch(`/api/history?${q}`)
      .then((r) => (r.ok ? r.json() : { enabled: false, items: [] }))
      .then((d) => live && setItems(d.enabled ? d.items : []))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [merchant, category]);

  if (!items || items.length === 0) return null;

  return (
    <details className="rounded-2xl border border-line bg-panel">
      <summary className="cursor-pointer px-4 py-3 text-sm">
        What you did before
        <span className="ml-2 text-xs text-muted">history from Fold, not advice</span>
      </summary>
      <ul className="border-t border-line px-4 py-2 text-xs">
        {items.map((i, idx) => (
          <li key={idx} className="flex justify-between gap-3 py-1.5">
            <span className="truncate">
              <span className="text-muted">{i.date}</span> {i.description}
            </span>
            <span className="shrink-0 text-muted">
              {i.account} <span className="num">₹{Math.round(i.amount).toLocaleString("en-IN")}</span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
