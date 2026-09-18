# Oracle deploy notes — session / screen-break (Head Hancho)

Short ops brief for putting the COGNATION **session + screen-break** API next to the static site on OCI without paid extras.

## What it is

- Path on box / repo: `cognation-site/server/` (Express, in-memory sessions).
- Proxied at **`/api/`** by nginx; static HTML/JS/CSS stay file-served.
- Demo login: any non-empty username; passwords are not stored or logged.
- After **20 minutes** cumulative active time (`SCREEN_LIMIT_MS`), client must complete a break within **15 seconds** (`BREAK_MS`) or the session is wiped (auto-logout).

## $0 footprint

| Piece | Always Free OK? |
|-------|-----------------|
| Ubuntu on Ampere A1 / free micro VM | Yes |
| nginx (static + reverse proxy) | Yes |
| Node 18+ listening on `127.0.0.1:3001` | Yes |
| Paid DB / Redis / Functions / WAF add-ons | **Not required** for v1 |

Restart of the Node unit **clears all sessions** — call that out in runbooks.

## Deploy sketch

1. Copy `cognation-site/` to e.g. `/var/www/cognation-site`.
2. `cd server && npm install --omit=dev`.
3. Install systemd unit from `server/README.md` (`cognation-session.service`).
4. nginx `location /api/` → `http://127.0.0.1:3001` (full example in README).
5. Set env: `ORIGIN=https://<your-host>`, `COOKIE_SECURE=true`, `TRUST_PROXY=true` when TLS terminates at nginx or an OCI LB.
6. Open only **80/443** publicly; keep Node bound to loopback.

## Client contract (for frontend wiring)

- Cookie: `cognation_sid` — `HttpOnly; SameSite=Lax` (+ `Secure` on HTTPS).
- Calls need `credentials: 'include'` when origin differs only if CORS `ORIGIN` lists that origin; same-origin via nginx is simplest.
- Poll `GET /api/session/status` and send `POST /api/session/activity` heartbeats while the user is interacting.
- On `breakRequired`, show puzzle UI; `POST /api/session/break/complete` with `{ puzzleToken }` (non-empty demo token).
- Missed deadline → treat as logged out (`authenticated: false`).

## Timers (defaults)

- `SCREEN_LIMIT_MS=1200000` (20 min)
- `BREAK_MS=15000` (15 s)

Override in the systemd unit for demos (e.g. shorter limits).

## Smoke check on the VM

```bash
cd /var/www/cognation-site/server && npm test
curl -s http://127.0.0.1:3001/healthz
```

Production path: hit `https://<host>/api/session/status` through nginx after login.
