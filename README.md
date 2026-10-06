# rmt-open-tracker

Email open tracker. One small Vercel project, Upstash Redis, and ntfy push.

## Flow

1. The sender calls `POST /api/register` per email and gets a unique pixel URL.
2. The sender embeds the pixel in the HTML part of the email.
3. A pixel load hits `GET /o/<id>.gif`. The tracker filters noise, records the open, and pushes to ntfy.
4. When you ask Claude Code about the CRM, the plugin calls `GET /api/opens?since=` and updates the leads.

A push that fails is not lost: the open is still stored and appears in the next sync.

## Hit handling

| Hit | Treatment |
|---|---|
| Unknown id or `HEAD` request | Ignored |
| Within 45 seconds of send | Filtered, no push |
| Scanner or empty user agent | Filtered, no push |
| Anything else | Valid open. Pushes on the first one, then again only after 2 hours. |

## Endpoints

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/register` | `Bearer API_TOKEN` | Body `{lead_key, label, step}` returns `{id, url}` |
| `GET /o/<id>.gif` | none | Pixel |
| `GET /api/opens?since=` | `Bearer API_TOKEN` | Valid opens since an ISO time or epoch ms |

## Deploy

1. Import this folder as a Vercel project.
2. In the project, Storage, add Upstash Redis from the Marketplace. Its credentials are injected automatically.
3. Add two environment variables:
   - `API_TOKEN`: 32+ random characters, also given to the plugin.
   - `NTFY_TOPIC`: your private topic, 16+ random characters.
4. Deploy. The base URL comes from Vercel automatically. Optionally set `TRACKER_BASE_URL` to use your own domain.

## Smoke test

```
curl.exe -X POST https://<project>.vercel.app/api/register -H "Authorization: Bearer <API_TOKEN>" -H "Content-Type: application/json" -d "{\"lead_key\":\"TEST\",\"label\":\"Smoke test\",\"step\":1}"
```

Wait 60 seconds, open the returned `url` in a browser, and confirm the push arrives. Then call `/api/opens` and confirm one record.

## Limits

- Opens are weak evidence. Apple Mail Privacy Protection and some gateways load pixels without a human, and blocked images hide real reads. Replies are the reliable signal.
- The default `*.vercel.app` address is shared hosting. For low-volume follow-ups that is acceptable. A subdomain on your own domain protects deliverability better.
- The label you register is sent to ntfy.sh, a third party. Keep labels short.
- Use your phone's Do Not Disturb for quiet hours.
- Vercel's Hobby plan is for non-commercial use.
- Tests run against an in-memory store. The Redis adapter and Vercel handlers are covered only by the smoke test above.

## Development

```
npm install
npm run typecheck
npm test
```
