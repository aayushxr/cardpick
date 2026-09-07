// POST /api/recommend
// Body: TransactionInput plus optional amountInr (for currency OTHER).
// Runs the rules engine only. No LLM. Bearer or cookie auth.

import { isAuthed, unauthorized } from "@/lib/auth";
import { coerceInput, runRecommend } from "@/lib/recommend-server";
import { getSettings } from "@/lib/settings";

export async function POST(req: Request) {
  if (!(await isAuthed(req))) return unauthorized();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const settings = await getSettings();
  const input = coerceInput(body, settings.defaultExpensed);
  if ("error" in input) return Response.json({ error: input.error }, { status: 400 });
  const override = body && Number.isFinite(Number(body.amountInr)) && Number(body.amountInr) > 0 ? Number(body.amountInr) : undefined;
  const result = await runRecommend(input, override);
  if ("needInr" in result) {
    return Response.json({ error: "amountInr required for this currency", needInr: true }, { status: 422 });
  }
  return Response.json(result);
}
