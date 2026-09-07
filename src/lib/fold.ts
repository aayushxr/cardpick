// Fold (fold.money) history. Reference only. Never feeds the score.
//
// Talks to the Fold MCP server over Streamable HTTP with a bearer token.
// Pulls the most recent debits and matches merchant name or category locally,
// because list_transactions has no text search. Any failure hides the panel.

import type { Category } from "./types";
import { categoryLabel } from "./categories";

const MCP_URL = process.env.FOLD_MCP_URL ?? "https://mcp.fold.money/mcp";

export type FoldHistoryItem = {
  date: string;
  amount: number;
  description: string;
  account: string;
  category: string | null;
};

type Row = Record<string, unknown>;

async function rpc<T>(method: string, params: Record<string, unknown>, token: string, sessionId?: string): Promise<{ result: T; sessionId?: string }> {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`fold ${method} ${res.status}`);
  const sid = res.headers.get("mcp-session-id") ?? sessionId;
  const ctype = res.headers.get("content-type") ?? "";
  let body: { result?: T; error?: unknown };
  if (ctype.includes("text/event-stream")) {
    const text = await res.text();
    const dataLine = text.split("\n").reverse().find((l) => l.startsWith("data:"));
    body = JSON.parse(dataLine?.slice(5).trim() ?? "{}");
  } else {
    body = await res.json();
  }
  if (body.error) throw new Error(`fold ${method} error`);
  return { result: body.result as T, sessionId: sid };
}

type ToolResult = { content?: { type: string; text?: string }[]; structuredContent?: unknown; isError?: boolean };

function toolJson<T>(r: ToolResult): T {
  if (r.structuredContent) return r.structuredContent as T;
  const text = r.content?.find((c) => c.type === "text")?.text ?? "{}";
  return JSON.parse(text) as T;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function foldHistory(merchantName: string | undefined, category: Category, limit = 5): Promise<FoldHistoryItem[]> {
  const token = process.env.FOLD_TOKEN;
  if (!token) return [];
  try {
    const init = await rpc<unknown>(
      "initialize",
      { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "cardpick", version: "0.1" } },
      token,
    );
    const sid = init.sessionId;
    await fetch(MCP_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}`, ...(sid ? { "mcp-session-id": sid } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      signal: AbortSignal.timeout(4000),
    }).catch(() => undefined);

    const [txRes, ccRes, bankRes] = await Promise.all([
      rpc<ToolResult>("tools/call", { name: "list_transactions", arguments: { limit: 100, type: "debit", exclude_non_cashflow: true } }, token, sid),
      rpc<ToolResult>("tools/call", { name: "list_credit_cards", arguments: {} }, token, sid).catch(() => null),
      rpc<ToolResult>("tools/call", { name: "list_bank_accounts", arguments: {} }, token, sid).catch(() => null),
    ]);

    const accounts = new Map<string, string>();
    for (const r of [ccRes, bankRes]) {
      if (!r) continue;
      const data = toolJson<Row | Row[]>(r.result);
      const list = Array.isArray(data) ? data : ((data.credit_cards ?? data.accounts ?? data.items ?? []) as Row[]);
      for (const a of list) {
        const id = str(a.id) || str(a.account_id);
        const name = str(a.name) || str(a.card_name) || str(a.bank_name) || str(a.issuer);
        if (id) accounts.set(id, name || id);
      }
    }

    const data = toolJson<Row | Row[]>(txRes.result);
    const rows = Array.isArray(data) ? data : ((data.transactions ?? data.items ?? []) as Row[]);
    const needle = (merchantName ?? "").toLowerCase().trim();
    const catLabel = categoryLabel(category).toLowerCase();

    const items: FoldHistoryItem[] = rows.map((r) => {
      const cat = (r.category ?? null) as Row | null;
      return {
        date: str(r.date).slice(0, 10),
        amount: typeof r.amount === "number" ? r.amount : Number(r.amount) || 0,
        description: str(r.description) || str(r.merchant) || str(r.narration) || str(r.name) || "(no description)",
        account: accounts.get(str(r.account_id)) ?? str(r.account_name) ?? "unknown account",
        category: cat ? str(cat.name) || null : null,
      };
    });

    const byMerchant = needle ? items.filter((i) => i.description.toLowerCase().includes(needle)) : [];
    const byCategory = items.filter((i) => (i.category ?? "").toLowerCase().includes(catLabel.split(" ")[0]));
    const merged = [...byMerchant, ...byCategory.filter((c) => !byMerchant.includes(c))];
    return merged.slice(0, limit);
  } catch {
    return [];
  }
}
