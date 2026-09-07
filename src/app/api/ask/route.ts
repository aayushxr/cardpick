// POST /api/ask
// Body: { text }. Bearer auth. Parses with the LLM, runs the engine, and
// returns { speech, top, ranked, parsed }. Built for the iOS Shortcut; see
// docs/shortcut.md for the exact contract.

import { isAuthed, unauthorized } from "@/lib/auth";
import { missingFields, parseTransaction } from "@/lib/parser";
import { coerceInput, runRecommend } from "@/lib/recommend-server";
import { getSettings } from "@/lib/settings";

export async function POST(req: Request) {
  if (!(await isAuthed(req))) return unauthorized();
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ error: "text required", speech: "I didn't catch what you're buying." }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OPENAI_API_KEY not set", speech: "The parser is not configured." }, { status: 500 });

  const settings = await getSettings();
  let parsed;
  try {
    parsed = await parseTransaction(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "parser failed";
    return Response.json({ error: msg, speech: "The parser failed, try again." }, { status: 502 });
  }

  // Fill what the Shortcut cannot ask about, so Siri still gets an answer.
  const filled = {
    ...parsed,
    currency: parsed.currency ?? "INR",
    country: parsed.country ?? (parsed.currency === "QAR" ? "QA" : "IN"),
    category: parsed.category ?? "other",
    rail: parsed.rail ?? "card_online",
    expensed: parsed.expensed ?? settings.defaultExpensed,
    isEmi: parsed.isEmi ?? false,
  };
  const missing = missingFields(parsed);
  if (filled.amount === null) {
    return Response.json({ error: "amount missing", missing, parsed, speech: "How much is it? Say the amount and try again." }, { status: 422 });
  }
  const input = coerceInput(filled, settings.defaultExpensed);
  if ("error" in input) return Response.json({ error: input.error, parsed, speech: "I couldn't understand that." }, { status: 400 });

  const result = await runRecommend(input);
  if ("needInr" in result) {
    return Response.json({ error: "no INR rate for that currency", parsed, speech: "I don't have a rate for that currency. Tell me the amount in rupees." }, { status: 422 });
  }
  const assumed = missing.filter((m) => m !== "amount");
  const speech = assumed.length ? `${result.speech} I assumed ${assumed.map((m) => `${m} ${String(filled[m])}`).join(", ")}.` : result.speech;
  return Response.json({ speech, top: result.top, ranked: result.ranked, parsed: filled, input: result.input, amountInr: result.amountInr, fx: result.fx });
}
