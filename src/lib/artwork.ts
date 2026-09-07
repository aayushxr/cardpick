// Which cards have artwork on disk. Checked once per request on the server so
// the UI only draws the image layer (and its scrim) when the file exists.
// Looks for public/cards/<id>.<ext> in this order unless the card sets `image`.

import { existsSync } from "node:fs";
import path from "node:path";
import { CARDS } from "./cards";

const EXTENSIONS = ["png", "jpg", "jpeg", "webp", "avif"];

export type ArtworkMap = Record<string, string | null>;

export function artworkMap(): ArtworkMap {
  const out: ArtworkMap = {};
  for (const c of CARDS) {
    const candidates = c.image ? [c.image] : EXTENSIONS.map((e) => `/cards/${c.id}.${e}`);
    const hit = candidates.find((rel) => existsSync(path.join(process.cwd(), "public", rel)));
    out[c.id] = hit ?? null;
  }
  return out;
}
