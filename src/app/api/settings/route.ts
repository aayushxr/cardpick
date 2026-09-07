// GET /api/settings  -> { settings, fx, persistent }
// PUT /api/settings  -> saves sanitised settings
// Cookie or bearer auth.

import { isAuthed, unauthorized } from "@/lib/auth";
import { getFxRates } from "@/lib/fx-rates";
import { kv } from "@/lib/kv";
import { getSettings, sanitiseSettings, saveSettings } from "@/lib/settings";

export async function GET(req: Request) {
  if (!(await isAuthed(req))) return unauthorized();
  const [settings, fx] = await Promise.all([getSettings(), getFxRates()]);
  return Response.json({ settings, fx, persistent: kv().persistent });
}

export async function PUT(req: Request) {
  if (!(await isAuthed(req))) return unauthorized();
  const body = await req.json().catch(() => null);
  const next = sanitiseSettings(body);
  await saveSettings(next);
  return Response.json({ settings: next });
}
