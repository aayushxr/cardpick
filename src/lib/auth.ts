// One shared secret. The web UI stores it in an httpOnly cookie; the API
// accepts it as a bearer token. Rotating from the settings page writes the new
// secret to KV, which then takes precedence over the env var.

import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { kv, KEYS } from "./kv";

export const COOKIE = "cardpick_auth";

export async function currentSecret(): Promise<string | null> {
  const rotated = await kv().get<string>(KEYS.secret);
  return rotated ?? process.env.CARDPICK_SECRET ?? null;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function checkSecret(candidate: string | null | undefined): Promise<boolean> {
  const secret = await currentSecret();
  if (!secret || !candidate) return false;
  return safeEqual(secret, candidate);
}

/** True when the request carries a valid bearer token or auth cookie. */
export async function isAuthed(req: Request): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
  if (bearer && (await checkSecret(bearer))) return true;
  const jar = await cookies();
  return checkSecret(jar.get(COOKIE)?.value);
}

export async function isAuthedPage(): Promise<boolean> {
  const jar = await cookies();
  return checkSecret(jar.get(COOKIE)?.value);
}

export async function rotateSecret(next: string): Promise<void> {
  await kv().set(KEYS.secret, next);
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
