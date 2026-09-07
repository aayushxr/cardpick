// POST /api/auth   { secret }        -> sets the auth cookie
// DELETE /api/auth                   -> clears it
// PUT /api/auth    { next }          -> rotates the shared secret (must already be authed)

import { cookies } from "next/headers";
import { checkSecret, COOKIE, isAuthed, rotateSecret, unauthorized } from "@/lib/auth";

const YEAR = 60 * 60 * 24 * 365;

async function setCookie(value: string) {
  const jar = await cookies();
  jar.set(COOKIE, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: YEAR });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { secret?: unknown } | null;
  const secret = typeof body?.secret === "string" ? body.secret.trim() : "";
  if (!(await checkSecret(secret))) return Response.json({ error: "wrong secret" }, { status: 401 });
  await setCookie(secret);
  return Response.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(COOKIE);
  return Response.json({ ok: true });
}

export async function PUT(req: Request) {
  if (!(await isAuthed(req))) return unauthorized();
  const body = (await req.json().catch(() => null)) as { next?: unknown } | null;
  const next = typeof body?.next === "string" ? body.next.trim() : "";
  if (next.length < 16) return Response.json({ error: "secret must be at least 16 characters" }, { status: 400 });
  await rotateSecret(next);
  await setCookie(next);
  return Response.json({ ok: true });
}
