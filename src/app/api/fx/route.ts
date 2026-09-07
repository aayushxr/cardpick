// GET /api/fx        -> cached rates (fetches if older than a day)
// POST /api/fx       -> force refresh

import { isAuthed, unauthorized } from "@/lib/auth";
import { forceRefreshFx, getFxRates } from "@/lib/fx-rates";

export async function GET(req: Request) {
  if (!(await isAuthed(req))) return unauthorized();
  return Response.json({ fx: await getFxRates() });
}

export async function POST(req: Request) {
  if (!(await isAuthed(req))) return unauthorized();
  return Response.json({ fx: await forceRefreshFx() });
}
