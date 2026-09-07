// POST /api/parse
// Body: { text }. Returns ParsedTransaction with nulls for anything unclear,
// plus the list of missing required fields. Parser only, no scoring.

import { isAuthed, unauthorized } from "@/lib/auth";
import { missingFields, parseTransaction } from "@/lib/parser";
import { getSettings } from "@/lib/settings";

export async function POST(req: Request) {
  if (!(await isAuthed(req))) return unauthorized();
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ error: "text required" }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  try {
    const settings = await getSettings();
    const parsed = await parseTransaction(text);
    if (parsed.expensed === null) parsed.expensed = settings.defaultExpensed;
    if (parsed.isEmi === null) parsed.isEmi = false;
    return Response.json({ parsed, missing: missingFields(parsed) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "parser failed";
    return Response.json({ error: msg }, { status: 502 });
  }
}
