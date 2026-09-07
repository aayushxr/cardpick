# Deploy

The live instance is at https://swipe.aayu.sh, on Vercel, with Upstash Redis from the Vercel Marketplace and DNS on Cloudflare.

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes | Parser. Only `/api/parse` and `/api/ask` use it. |
| `CARDPICK_SECRET` | yes | Shared secret. Web UI cookie and API bearer token. Rotating from settings stores the new one in Redis, which then wins. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | yes in prod | Upstash Redis REST. Set automatically when you add Upstash from the Vercel Marketplace. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work. Without Redis, settings and FX cache live in memory and reset on every cold start. |
| `FOLD_TOKEN` | no | Enables the "What you did before" panel. Absent or failing, the panel is hidden. |
| `FOLD_MCP_URL` | no | Defaults to `https://mcp.fold.money/mcp`. |
| `CARDPICK_PARSER_MODEL` | no | Defaults to `gpt-5.6-luna`. |

## Steps

1. Fork or clone the repo, edit `src/lib/cards.ts` for your cards, run `pnpm test`.
2. Create a Vercel project from the GitHub repo. Framework preset: Next.js. Nothing else to configure.
3. Add Upstash Redis: Vercel dashboard, Storage, Create, Upstash Redis (or `vercel integration add upstash`). Connect it to the project. This injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
4. Add `OPENAI_API_KEY` and `CARDPICK_SECRET` under Settings, Environment Variables, for Production. Generate the secret with `openssl rand -hex 32`.
5. Redeploy so the env vars take effect.
6. Custom domain. In Cloudflare, add a CNAME `swipe` pointing to `cname.vercel-dns.com`, proxy off (DNS only). Vercel needs to terminate TLS itself. In Vercel, Settings, Domains, add `swipe.aayu.sh`. The certificate issues within a minute or two once DNS resolves.
7. Open the domain, enter the secret once. Add to Home Screen from Safari's share sheet for the PWA.
8. Verify:

```bash
curl -s https://swipe.aayu.sh/api/recommend \
  -H "Authorization: Bearer $CARDPICK_SECRET" -H "content-type: application/json" \
  -d '{"amount":600,"currency":"INR","country":"IN","merchantName":"Zomato","category":"food_delivery","rail":"upi","expensed":false,"isEmi":false}' | jq .speech
```

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in OPENAI_API_KEY and CARDPICK_SECRET
pnpm dev
```

Without Redis env vars the app uses an in-memory store and the settings page says so. `pnpm test` runs the engine tests with no network.

## FX rates

Fetched once a day from open.er-api.com (free, no key, includes INR and QAR) and cached in Redis. If the fetch fails the last cached rate is served and the result shows a stale warning. Overrides in settings always win.
