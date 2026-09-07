// GET /api/history?merchant=...&category=...
// Fold history for the "What you did before" panel. Returns { enabled, items }.
// enabled is false when FOLD_TOKEN is missing so the UI can hide the panel.

import { isAuthed, unauthorized } from "@/lib/auth";
import { foldHistory } from "@/lib/fold";
import { CATEGORIES, type Category } from "@/lib/types";

export async function GET(req: Request) {
  if (!(await isAuthed(req))) return unauthorized();
  if (!process.env.FOLD_TOKEN) return Response.json({ enabled: false, items: [] });
  const url = new URL(req.url);
  const merchant = url.searchParams.get("merchant") ?? undefined;
  const cat = url.searchParams.get("category") ?? "other";
  const category = (CATEGORIES.includes(cat as never) ? cat : "other") as Category;
  const items = await foldHistory(merchant, category);
  return Response.json({ enabled: true, items });
}
